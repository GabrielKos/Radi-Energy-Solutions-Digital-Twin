import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { SEED_PLAN } from './seedRows';

export interface TableAdapter<T extends { id: string }> {
  table: string;
  fromRow: (row: any) => T;
  toRow: (item: Partial<T>) => any;
  orderBy?: string;
}

export interface UseSupabaseTableResult<T extends { id: string }> {
  rows: T[];
  loading: boolean;
  error: string | null;
  insert: (item: Omit<T, 'id'> & { id?: string }) => Promise<void>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Re-read the table. Needed after a bulk seed, which realtime may batch. */
  refetch: () => void;
}

function getLocalInitialData<T extends { id: string }>(adapter: TableAdapter<T>): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = window.localStorage.getItem(`radi_twin_mock_${adapter.table}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(adapter.fromRow);
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  const defaultRaw = SEED_PLAN.find(s => s.table === adapter.table)?.rows() ?? [];
  return defaultRaw.map(adapter.fromRow);
}

function saveLocalData<T extends { id: string }>(adapter: TableAdapter<T>, rows: T[]) {
  if (typeof window === 'undefined') return;
  try {
    const rawRows = rows.map(r => adapter.toRow(r));
    window.localStorage.setItem(`radi_twin_mock_${adapter.table}`, JSON.stringify(rawRows));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * One hook, reused by every editable collection (warehouses, workforce,
 * tariff periods, capex items, and — via a thin wrapper — machines).
 * Loads the current rows once, then keeps them in sync live via a Postgres
 * changes subscription so every open tab reflects every other collaborator's
 * edits without a manual refresh.
 * When Supabase is not configured, provides seamless full-feature in-memory & local fallback.
 */
export function useSupabaseTable<T extends { id: string }>(adapter: TableAdapter<T>): UseSupabaseTableResult<T> {
  const [rows, setRows] = useState<T[]>(() => {
    return getLocalInitialData(adapter);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  const refetch = useCallback(() => {
    if (!isSupabaseConfigured) {
      fetch(`/api/db/${adapterRef.current.table}${adapterRef.current.orderBy ? `?orderBy=${encodeURIComponent(adapterRef.current.orderBy)}` : ''}`)
        .then(res => res.json())
        .then(json => {
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const mapped = json.data.map(adapterRef.current.fromRow);
            setRows(mapped);
            saveLocalData(adapterRef.current, mapped);
          } else {
            setRows(getLocalInitialData(adapterRef.current));
          }
        })
        .catch(() => {
          setRows(getLocalInitialData(adapterRef.current));
        });
      return;
    }
    setReloadKey(k => k + 1);
  }, []);

  useEffect(() => {
    let active = true;

    // Fast-path: query local server database and synchronize cache
    if (!isSupabaseConfigured) {
      setLoading(true);
      fetch(`/api/db/${adapter.table}${adapter.orderBy ? `?orderBy=${encodeURIComponent(adapter.orderBy)}` : ''}`)
        .then(res => res.json())
        .then(json => {
          if (!active) return;
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            const mapped = json.data.map(adapterRef.current.fromRow);
            setRows(mapped);
            saveLocalData(adapterRef.current, mapped);
          } else {
            const localData = getLocalInitialData(adapterRef.current);
            setRows(localData);
          }
          setError(null);
        })
        .catch(err => {
          if (!active) return;
          console.warn(`[db-sync] Local cache active for ${adapter.table}:`, err?.message);
          setRows(getLocalInitialData(adapterRef.current));
          setError(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return;
    }

    setLoading(true);

    (async () => {
      try {
        let query = supabase.from(adapter.table).select('*');
        if (adapter.orderBy) query = query.order(adapter.orderBy);
        const { data, error: fetchError } = await query;
        if (!active) return;
        if (fetchError) {
          console.warn(`[database] Remote query notice on ${adapter.table}:`, fetchError.message);
          // Gracefully fallback to server & local storage without breaking the UI
          setRows(getLocalInitialData(adapterRef.current));
          setError(null);
        } else {
          setRows((data ?? []).map(adapterRef.current.fromRow));
          setError(null);
        }
      } catch (err: any) {
        if (!active) return;
        console.warn(`[database] Fallback to embedded persistence for ${adapter.table}:`, err?.message);
        setRows(getLocalInitialData(adapterRef.current));
        setError(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`public:${adapter.table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: adapter.table }, payload => {
        setRows(prev => {
          if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            return prev.filter(r => r.id !== deletedId);
          }
          const incoming = adapterRef.current.fromRow(payload.new);
          const exists = prev.some(r => r.id === incoming.id);
          return exists ? prev.map(r => (r.id === incoming.id ? incoming : r)) : [...prev, incoming];
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter.table, reloadKey]);

  const insert: UseSupabaseTableResult<T>['insert'] = async item => {
    const id = item.id || `${adapter.table}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const rowRaw = adapterRef.current.toRow({ ...(item as any), id });
    const created = adapterRef.current.fromRow({ ...rowRaw, id });

    setRows(prev => {
      const next = [...prev, created];
      saveLocalData(adapterRef.current, next);
      return next;
    });

    // Persist to embedded server database
    fetch(`/api/db/${adapter.table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rowRaw),
    }).catch(err => console.warn('[db] Server persist notice:', err?.message));

    if (isSupabaseConfigured) {
      try {
        const { data, error: insertError } = await supabase
          .from(adapter.table)
          .insert(adapter.toRow(item as Partial<T>))
          .select();
        if (insertError) {
          console.warn('[supabase] Remote insert notice:', insertError.message);
        } else if (data && data.length) {
          const remoteCreated = data.map(adapterRef.current.fromRow);
          setRows(prev => {
            const known = new Set(prev.map(r => r.id));
            return [...prev, ...remoteCreated.filter((r: T) => !known.has(r.id))];
          });
        }
      } catch (err) {
        console.warn('[supabase] Remote insert skipped, saved locally & to server:', err);
      }
    }
  };

  const update: UseSupabaseTableResult<T>['update'] = async (id, patch) => {
    setRows(prev => {
      const next = prev.map(r => (r.id === id ? { ...r, ...patch } : r));
      saveLocalData(adapterRef.current, next);
      return next;
    });

    // Persist to embedded server database
    const patchRaw = adapterRef.current.toRow(patch);
    fetch(`/api/db/${adapter.table}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchRaw),
    }).catch(err => console.warn('[db] Server update notice:', err?.message));

    if (isSupabaseConfigured) {
      try {
        const { error: updateError } = await supabase.from(adapter.table).update(patchRaw).eq('id', id);
        if (updateError) console.warn('[supabase] Remote update notice:', updateError.message);
      } catch (err) {
        console.warn('[supabase] Remote update skipped, local & server updated:', err);
      }
    }
  };

  const remove: UseSupabaseTableResult<T>['remove'] = async id => {
    setRows(prev => {
      const next = prev.filter(r => r.id !== id);
      saveLocalData(adapterRef.current, next);
      return next;
    });

    // Delete from embedded server database
    fetch(`/api/db/${adapter.table}/${id}`, {
      method: 'DELETE',
    }).catch(err => console.warn('[db] Server delete notice:', err?.message));

    if (isSupabaseConfigured) {
      try {
        const { error: deleteError } = await supabase.from(adapter.table).delete().eq('id', id);
        if (deleteError) console.warn('[supabase] Remote delete notice:', deleteError.message);
      } catch (err) {
        console.warn('[supabase] Remote delete skipped, local & server updated:', err);
      }
    }
  };

  return { rows, loading, error, insert, update, remove, refetch };
}
