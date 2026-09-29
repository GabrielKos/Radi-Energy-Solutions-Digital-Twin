import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, SUPABASE_CONFIG_ERROR } from './supabaseClient';

/**
 * The change trail.
 *
 * Every authorised write records who made it, what they changed, and the value
 * on each side of the change. The table is append-only by policy (see
 * `supabase/migrations/0004_station_positions_and_audit.sql`): the app can
 * insert and read, but there is no update or delete policy, so a trail entry
 * cannot be rewritten or erased from the client.
 *
 * The recorded email is self-declared in the authorisation dialog — it
 * identifies the person for a colleague reading the trail, it is not a verified
 * sign-in. Verified identity requires Supabase Auth; see
 * `0002_lock_down_rls.sql`.
 */

export type AuditAction = 'create' | 'update' | 'delete';

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorEmail: string;
  action: AuditAction;
  entity: string;
  recordId: string;
  recordLabel: string;
  changes: Record<string, FieldChange>;
}

const fromRow = (r: any): AuditEntry => ({
  id: r.id,
  at: r.at,
  actorEmail: r.actor_email ?? '',
  action: r.action,
  entity: r.entity,
  recordId: r.record_id ?? '',
  recordLabel: r.record_label ?? '',
  changes: (r.changes ?? {}) as Record<string, FieldChange>,
});

export interface RecordAuditInput {
  actorEmail: string;
  action: AuditAction;
  entity: string;
  recordId: string;
  recordLabel: string;
  changes?: Record<string, FieldChange>;
}

const LOCAL_AUDIT_KEY = 'radi_twin_audit_log';
const AUDIT_EVENT = 'radi_twin_audit_updated';

const INITIAL_AUDIT_LOGS: AuditEntry[] = [];

function getLocalAuditLog(): AuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_AUDIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any obsolete initial mock entries
        const clean = parsed.filter((p: any) => !p.id?.startsWith('audit-init-'));
        return clean;
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return [];
}

function saveLocalAuditLog(entries: AuditEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(entries.slice(0, 1000)));
    window.dispatchEvent(new CustomEvent(AUDIT_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

let isAuditTableAvailable: boolean | null = null;

/**
 * Writes one trail entry.
 *
 * Deliberately never throws. A change that succeeded must not be reported to
 * the operator as failed because the trail write came back with an error — that
 * would be a worse lie than a missing trail line. Failures are handled smoothly
 * with local fallback.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const newEntry: AuditEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actorEmail: input.actorEmail,
    action: input.action,
    entity: input.entity,
    recordId: input.recordId,
    recordLabel: input.recordLabel,
    changes: input.changes ?? {},
  };

  // Always save to local storage for immediate persistence & accessibility
  const current = getLocalAuditLog();
  saveLocalAuditLog([newEntry, ...current]);

  // Persist to embedded server database
  fetch('/api/db/audit_log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newEntry),
  }).catch(() => {});

  if (!isSupabaseConfigured || isAuditTableAvailable === false) return;
  try {
    const { error } = await supabase.from('audit_log').insert({
      actor_email: input.actorEmail,
      action: input.action,
      entity: input.entity,
      record_id: input.recordId,
      record_label: input.recordLabel,
      changes: input.changes ?? {},
    });
    if (error) {
      if (
        error.message?.includes('Could not find the table') ||
        error.message?.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST204'
      ) {
        isAuditTableAvailable = false;
        console.warn(
          '[audit] Table public.audit_log not found in Supabase. Using local audit trail. (Run migration 0004_station_positions_and_audit.sql to enable cloud sync).'
        );
      } else {
        console.warn('[audit] Supabase audit trail sync notice:', error.message);
      }
    } else {
      isAuditTableAvailable = true;
    }
  } catch (err: any) {
    isAuditTableAvailable = false;
    console.warn('[audit] Local trail maintained (Supabase audit write skipped).');
  }
}

/** Fields that carry no meaning for a human reading the trail. */
const IGNORED_FIELDS = new Set(['id', 'updatedAt', 'updated_at', 'totalCostUSD']);

/**
 * Reduces a patch to only the fields whose values actually moved.
 *
 * A CRUD form posts every field it rendered, changed or not, so recording the
 * raw patch would produce a trail entry claiming a dozen edits where the person
 * corrected a single number. `totalCostUSD` is excluded because it is derived
 * from `unitRateUSD × machinesCount` and would show as a phantom edit alongside
 * every genuine one.
 */
export function diffFields(
  before: Record<string, any> | null | undefined,
  after: Record<string, any>
): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};
  for (const [key, next] of Object.entries(after)) {
    if (IGNORED_FIELDS.has(key)) continue;
    const prev = before ? before[key] : undefined;
    if (isSameValue(prev, next)) continue;
    changes[key] = { from: before ? prev ?? null : null, to: next ?? null };
  }
  return changes;
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // A form returns "12" where the record holds 12; that is not an edit.
  if (typeof a === 'number' && typeof b === 'string') return a === parseFloat(b);
  if (typeof a === 'string' && typeof b === 'number') return parseFloat(a) === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => isSameValue(v, b[i]));
  }
  // Treat an absent value and an empty one as the same, so opening a form and
  // saving it unchanged does not manufacture a trail entry.
  const aBlank = a === null || a === undefined || a === '';
  const bBlank = b === null || b === undefined || b === '';
  return aBlank && bBlank;
}

export interface UseAuditTrailResult {
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Newest first, capped so a long-lived plant does not load its whole history. */
const TRAIL_PAGE_SIZE = 500;

/** Rejects if `promise` has not settled within `ms`. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error('The database did not respond within 15 seconds. Check the connection and retry.')),
        ms
      )
    ),
  ]);
}

export function useAuditTrail(): UseAuditTrailResult {
  const [entries, setEntries] = useState<AuditEntry[]>(() => {
    if (!isSupabaseConfigured) {
      return getLocalAuditLog();
    }
    return [];
  });
  const [loading, setLoading] = useState(!isSupabaseConfigured ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => {
    if (!isSupabaseConfigured) {
      setEntries(getLocalAuditLog());
      return;
    }
    setReloadKey(k => k + 1);
  }, []);

  useEffect(() => {
    let active = true;

    // Listen to local audit updates
    const handleLocalAudit = () => {
      if (!isSupabaseConfigured) {
        setEntries(getLocalAuditLog());
      }
    };
    window.addEventListener(AUDIT_EVENT, handleLocalAudit);
    window.addEventListener('storage', handleLocalAudit);

    if (!isSupabaseConfigured) {
      setEntries(getLocalAuditLog());
      setLoading(false);
      setError(null);
      fetch('/api/db/audit_log?orderBy=at')
        .then(res => res.json())
        .then(json => {
          if (!active) return;
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const mapped = json.data.map(fromRow);
            setEntries(mapped);
            saveLocalAuditLog(mapped);
          }
        })
        .catch(() => {});
      return () => {
        window.removeEventListener(AUDIT_EVENT, handleLocalAudit);
        window.removeEventListener('storage', handleLocalAudit);
      };
    }

    setLoading(true);

    (async () => {
      try {
        const { data, error: fetchError } = await withTimeout(
          supabase
            .from('audit_log')
            .select('*')
            .order('at', { ascending: false })
            .limit(TRAIL_PAGE_SIZE),
          15000
        );
        if (!active) return;
        if (fetchError) {
          if (
            fetchError.message?.includes('Could not find the table') ||
            fetchError.message?.includes('schema cache') ||
            fetchError.code === '42P01' ||
            fetchError.code === 'PGRST204'
          ) {
            isAuditTableAvailable = false;
          }
          // If remote fetch fails, fallback to local entries gracefully
          console.warn('[audit] Supabase fetch notice, maintaining local trail:', fetchError.message);
          setEntries(getLocalAuditLog());
          setError(null);
        } else {
          isAuditTableAvailable = true;
          setError(null);
          const remoteList = (data ?? []).map(fromRow);
          // Merge local and remote
          const localList = getLocalAuditLog();
          const combined = [...remoteList];
          for (const l of localList) {
            if (!combined.some(c => c.id === l.id)) {
              combined.push(l);
            }
          }
          combined.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
          setEntries(combined);
        }
      } catch (err: any) {
        if (!active) return;
        isAuditTableAvailable = false;
        setEntries(getLocalAuditLog());
        setError(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    // New entries appear without a refresh, including those made by colleagues.
    const channel = supabase
      .channel('public:audit_log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, payload => {
        const incoming = fromRow(payload.new);
        setEntries(prev => (prev.some(e => e.id === incoming.id) ? prev : [incoming, ...prev]));
      })
      .subscribe();

    return () => {
      active = false;
      window.removeEventListener(AUDIT_EVENT, handleLocalAudit);
      window.removeEventListener('storage', handleLocalAudit);
      supabase.removeChannel(channel);
    };
  }, [reloadKey]);

  return { entries, loading, error, refetch };
}
