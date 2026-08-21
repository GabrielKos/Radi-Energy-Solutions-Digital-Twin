import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { KeyRound, Lock, ShieldAlert, X } from 'lucide-react';
import { ThemeMode } from '../types/plant';

/**
 * Engineering edit authorisation.
 *
 * Every change written back to the shared database — adding, editing or
 * deleting a machine, warehouse, workforce line, tariff period or CapEx item,
 * and unlocking the Floor Twin station layout — is put behind a challenge for
 * the engineering password. The challenge is raised on *each* write, not once
 * per session, so an unattended control-room screen cannot be quietly edited by
 * whoever walks up to it next.
 *
 * ── Scope, stated plainly ─────────────────────────────────────────────────
 * This is an operational guard against accidental and casual edits. It is NOT a
 * security boundary: the app ships as a static bundle, so the expected password
 * is readable by anyone who opens browser devtools, and a determined user could
 * call Supabase directly with the public anon key. The only real write boundary
 * is row-level security in the database — see
 * `supabase/migrations/0002_lock_down_rls.sql`, which requires a genuine
 * signed-in session for every write. Run that migration (and wire up Supabase
 * Auth) before this deployment is exposed beyond a trusted network.
 *
 * The challenge is held in a module-level store rather than React context so
 * that any layer — a screen, a hook, or the collection wrappers in App — can
 * raise it without the whole tree having to sit inside a provider.
 */

/** Override at build time with `VITE_EDIT_PASSWORD`; falls back to the plant default. */
export const EDIT_PASSWORD: string = import.meta.env.VITE_EDIT_PASSWORD || 'RADI2030';

/** Thrown when a challenge is dismissed. Callers surface `message` to the operator. */
export class EditAuthError extends Error {
  constructor(message = 'Change not saved — engineering password required.') {
    super(message);
    this.name = 'EditAuthError';
  }
}

export const isEditAuthError = (err: unknown): err is EditAuthError =>
  err instanceof EditAuthError || (err as { name?: string } | null)?.name === 'EditAuthError';

interface Challenge {
  /** Short description of the pending change, e.g. "Delete warehouse". */
  action: string;
  /** Supporting context, e.g. the table and record being written. */
  detail?: string;
  resolve: (authorised: boolean) => void;
}

// ---------------------------------------------------------------------------
// Module-level challenge store
// ---------------------------------------------------------------------------
let pendingChallenge: Challenge | null = null;
const subscribers = new Set<() => void>();

const notify = () => subscribers.forEach(fn => fn());
const subscribe = (fn: () => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};
const getSnapshot = () => pendingChallenge;

/**
 * Raises the password challenge and resolves true once the correct password is
 * entered, false if the operator cancels. Prefer {@link guardEdit}, which turns
 * a refusal into a thrown {@link EditAuthError}.
 */
export function requestEditAuthorization(action: string, detail?: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    // One challenge at a time. A second write raised while the first is still
    // on screen is refused rather than silently queued behind a dialog the
    // operator believes belongs to it.
    if (pendingChallenge) {
      resolve(false);
      return;
    }
    pendingChallenge = { action, detail, resolve };
    notify();
  });
}

function settleChallenge(authorised: boolean) {
  const current = pendingChallenge;
  pendingChallenge = null;
  notify();
  current?.resolve(authorised);
}

/**
 * Runs `mutate` only after the change has been authorised.
 * Throws {@link EditAuthError} if the operator cancels, which the CRUD screens
 * already catch and display without losing the form the operator was filling.
 */
export async function guardEdit<T>(
  action: string,
  detail: string | undefined,
  mutate: () => Promise<T> | T
): Promise<T> {
  const authorised = await requestEditAuthorization(action, detail);
  if (!authorised) throw new EditAuthError();
  return await mutate();
}

interface WritableCollection<T extends { id: string }> {
  insert: (item: any) => Promise<void>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Wraps a collection's three write methods in the password challenge.
 * Doing this once, at the point the collection is handed to a screen, means
 * there is exactly one place a persisted change can escape the guard.
 */
export function guardCollection<T extends { id: string }, C extends WritableCollection<T>>(
  label: string,
  table: string,
  api: C
): Pick<C, 'insert' | 'update' | 'remove'> {
  return {
    insert: ((item: any) => guardEdit(`Add ${label}`, `${table} · new record`, () => api.insert(item))) as C['insert'],
    update: ((id: string, patch: Partial<T>) =>
      guardEdit(`Update ${label}`, `${table} · ${id}`, () => api.update(id, patch))) as C['update'],
    remove: ((id: string) => guardEdit(`Delete ${label}`, `${table} · ${id}`, () => api.remove(id))) as C['remove'],
  };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

/**
 * Renders the pending challenge, if any. Mount exactly once, at the root of the
 * app, above every other overlay.
 */
export const EditAuthGate: React.FC<{ theme?: ThemeMode }> = ({ theme = 'light' }) => {
  const challenge = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const cancel = useCallback(() => settleChallenge(false), []);
  const succeed = useCallback(() => settleChallenge(true), []);

  if (!challenge) return null;

  return (
    <PasswordChallenge
      // Remounts (clearing any typed value and failure state) when a new change
      // raises a challenge, rather than inheriting the last one's.
      key={challenge.action + (challenge.detail ?? '')}
      action={challenge.action}
      detail={challenge.detail}
      theme={theme}
      onCancel={cancel}
      onSuccess={succeed}
    />
  );
};

const PasswordChallenge: React.FC<{
  action: string;
  detail?: string;
  theme: ThemeMode;
  onCancel: () => void;
  onSuccess: () => void;
}> = ({ action, detail, theme, onCancel, onSuccess }) => {
  const isDark = theme === 'dark';
  const [entry, setEntry] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entry === EDIT_PASSWORD) {
      onSuccess();
      return;
    }
    setEntry('');
    setFailedAttempts(n => n + 1);
  };

  // Escape abandons the change — the same way out every other dialog offers.
  React.useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const panel = isDark
    ? 'bg-[#111318] border-[#2D3139] text-[#D1D5DB]'
    : 'bg-[#FDFCFA] border-[#E7E3DC] text-slate-800';
  const divider = isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]';
  const inputCls = isDark
    ? 'bg-[#1A1D23] border-[#2D3139] text-white placeholder-gray-500'
    : 'bg-[#F6F5F2] border-[#DDD8CF] text-slate-900 placeholder-slate-400';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${
        isDark ? 'bg-black/70' : 'bg-slate-900/40'
      } backdrop-blur-sm`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Engineering authorisation required"
    >
      <form onSubmit={submit} className={`w-full max-w-sm border rounded-xl shadow-2xl ${panel}`}>
        <div className={`p-4 border-b flex items-start gap-3 ${divider}`}>
          <div className="mt-0.5 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Authorisation Required
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Enter the engineering password to commit this change.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel change"
            className={`p-1 rounded transition-colors ${
              isDark
                ? 'text-gray-400 hover:text-white hover:bg-[#1A1D23]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-[#F1EEE8]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className={`rounded-lg border px-3 py-2 ${isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
              Pending change
            </p>
            <p className={`text-xs font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{action}</p>
            {detail && (
              <p className={`text-[10px] font-mono mt-0.5 break-all ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {detail}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-auth-password"
              className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Engineering password
            </label>
            <input
              id="edit-auth-password"
              type="password"
              autoFocus
              autoComplete="off"
              value={entry}
              onChange={e => setEntry(e.target.value)}
              placeholder="••••••••"
              aria-invalid={failedAttempts > 0}
              className={`w-full border rounded-lg px-3 py-2 text-xs font-mono tracking-widest focus:outline-none focus:ring-2 ${
                failedAttempts > 0 && entry.length === 0
                  ? 'border-red-500 focus:ring-red-500'
                  : 'focus:ring-blue-500'
              } ${inputCls}`}
            />
            {failedAttempts > 0 && (
              <p className="text-[10px] mt-1 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 shrink-0" />
                Incorrect password — change not applied
                {failedAttempts > 1 ? ` (${failedAttempts} failed attempts).` : '.'}
              </p>
            )}
          </div>
        </div>

        <div className={`p-4 border-t flex gap-2 ${divider}`}>
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
              isDark
                ? 'bg-[#1A1D23] border-[#2D3139] text-gray-300 hover:bg-[#252830]'
                : 'bg-white border-[#DDD8CF] text-slate-700 hover:bg-[#F6F5F2]'
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={entry.length === 0}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Authorise</span>
          </button>
        </div>
      </form>
    </div>
  );
};
