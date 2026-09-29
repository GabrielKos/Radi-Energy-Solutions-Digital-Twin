import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { Lock, Mail, User, ShieldAlert, X } from 'lucide-react';
import { ThemeMode } from '../types/plant';
import { diffFields, recordAudit, AuditAction, FieldChange } from './auditLog';

/**
 * Engineering edit authorisation, and the identity behind the change trail.
 *
 * Every change written back to the plant model — adding, editing or deleting a
 * machine, warehouse, workforce line, tariff period or CapEx item, repositioning
 * a station on the Floor Twin, or adding audit notes — requires the operator's
 * Full Name, Work Email, and Engineering Password.
 *
 * The operator's Name and Email are remembered locally per browser for convenience,
 * but the Engineering Password must be entered on every change to prevent
 * unauthorized or unintended modifications.
 */

/** Override at build time with `VITE_EDIT_PASSWORD`; default is RADI2030. */
export const EDIT_PASSWORD: string = import.meta.env.VITE_EDIT_PASSWORD || 'RADI2030';

const ACTOR_NAME_KEY = 'radi-twin-actor-name';
const ACTOR_EMAIL_KEY = 'radi-twin-actor-email';

/** Thrown when a challenge is dismissed. Callers surface `message` to the operator. */
export class EditAuthError extends Error {
  constructor(message = 'Change not saved — engineering authorisation required.') {
    super(message);
    this.name = 'EditAuthError';
  }
}

export const isEditAuthError = (err: unknown): err is EditAuthError =>
  err instanceof EditAuthError || (err as { name?: string } | null)?.name === 'EditAuthError';

export interface AuthorizationResult {
  authorised: boolean;
  /** Name and Email of the authorising operator, or empty string when dismissed. */
  actorEmail: string;
  actorName?: string;
}

interface Challenge {
  /** Short description of the pending change, e.g. "Move Stacker Station". */
  action: string;
  /** Supporting context, e.g. the table and record being written. */
  detail?: string;
  resolve: (result: AuthorizationResult) => void;
}

// ---------------------------------------------------------------------------
// Remembered identity
// ---------------------------------------------------------------------------

export function getRememberedName(): string {
  try {
    return window.localStorage.getItem(ACTOR_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setRememberedName(name: string): void {
  try {
    window.localStorage.setItem(ACTOR_NAME_KEY, name.trim());
  } catch {
    // Storage quota or private mode
  }
  notify();
}

export function getRememberedEmail(): string {
  try {
    return window.localStorage.getItem(ACTOR_EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setRememberedEmail(email: string): void {
  try {
    window.localStorage.setItem(ACTOR_EMAIL_KEY, email.trim());
  } catch {
    // Storage quota or private mode
  }
  notify();
}

export function clearRememberedIdentity(): void {
  try {
    window.localStorage.removeItem(ACTOR_NAME_KEY);
    window.localStorage.removeItem(ACTOR_EMAIL_KEY);
  } catch {
    /* nothing to clear */
  }
  notify();
}

/** Deliberately permissive: enough to catch a typo, not to police addresses. */
export const isPlausibleEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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
 * Raises the challenge and resolves once it is answered or cancelled.
 */
export function requestEditAuthorization(action: string, detail?: string): Promise<AuthorizationResult> {
  return new Promise<AuthorizationResult>(resolve => {
    if (pendingChallenge) {
      resolve({ authorised: false, actorEmail: '', actorName: '' });
      return;
    }
    pendingChallenge = { action, detail, resolve };
    notify();
  });
}

function settleChallenge(result: AuthorizationResult) {
  const current = pendingChallenge;
  pendingChallenge = null;
  notify();
  current?.resolve(result);
}

/**
 * Runs `mutate` only after the change is authorised, then hands the
 * authorising identity to `onAudited` so the caller can record the trail entry.
 */
export async function guardEdit<T>(
  action: string,
  detail: string | undefined,
  mutate: () => Promise<T> | T,
  onAudited?: (actorEmail: string, result: T) => void | Promise<void>
): Promise<T> {
  const { authorised, actorEmail } = await requestEditAuthorization(action, detail);
  if (!authorised) throw new EditAuthError();
  const result = await mutate();
  await onAudited?.(actorEmail, result);
  return result;
}

interface WritableCollection<T extends { id: string }> {
  insert: (item: any) => Promise<void>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export interface GuardedCollectionOptions<T extends { id: string }> {
  label: string;
  entity: string;
  rows: T[];
  describe: (row: Partial<T>) => string;
}

export function guardCollection<T extends { id: string }, C extends WritableCollection<T>>(
  options: GuardedCollectionOptions<T>,
  api: C
): Pick<C, 'insert' | 'update' | 'remove'> {
  const { label, entity, rows, describe } = options;
  const find = (id: string) => rows.find(r => r.id === id);

  const audit = (
    actorEmail: string,
    action: AuditAction,
    recordId: string,
    recordLabel: string,
    changes?: Record<string, FieldChange>
  ) => recordAudit({ actorEmail, action, entity, recordId, recordLabel, changes });

  return {
    insert: ((item: any) =>
      guardEdit(
        `Add ${label}`,
        `${entity} · new record`,
        () => api.insert(item),
        actorEmail =>
          audit(actorEmail, 'create', item?.id ?? '', describe(item), diffFields(null, item ?? {}))
      )) as C['insert'],

    update: ((id: string, patch: Partial<T>) => {
      const before = find(id);
      const name = describe({ ...(before ?? {}), ...patch } as Partial<T>);
      return guardEdit(
        `Update ${label}`,
        `${entity} · ${name || id}`,
        () => api.update(id, patch),
        actorEmail =>
          audit(actorEmail, 'update', id, name, diffFields(before as Record<string, any>, patch))
      );
    }) as C['update'],

    remove: ((id: string) => {
      const before = find(id);
      const name = before ? describe(before) : '';
      return guardEdit(
        `Delete ${label}`,
        `${entity} · ${name || id}`,
        () => api.remove(id),
        actorEmail => audit(actorEmail, 'delete', id, name)
      );
    }) as C['remove'],
  };
}

// ---------------------------------------------------------------------------
// UI Component
// ---------------------------------------------------------------------------

export const EditAuthGate: React.FC<{ theme?: ThemeMode }> = ({ theme = 'light' }) => {
  const challenge = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const cancel = useCallback(() => settleChallenge({ authorised: false, actorEmail: '', actorName: '' }), []);
  const succeed = useCallback((actorName: string, actorEmail: string) => {
    setRememberedName(actorName);
    setRememberedEmail(actorEmail);
    const combinedActor = actorName.trim()
      ? `${actorName.trim()} <${actorEmail.trim()}>`
      : actorEmail.trim();
    settleChallenge({ authorised: true, actorEmail: combinedActor, actorName });
  }, []);

  if (!challenge) return null;

  return (
    <PasswordChallenge
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
  onSuccess: (name: string, email: string) => void;
}> = ({ action, detail, theme, onCancel, onSuccess }) => {
  const isDark = theme === 'dark';
  const rememberedName = getRememberedName();
  const rememberedEmail = getRememberedEmail();

  const [name, setName] = useState(rememberedName);
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [isEditingIdentity, setIsEditingIdentity] = useState(!rememberedName || !rememberedEmail);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Full name is required for audit trail tracking.');
      hasError = true;
    } else {
      setNameError(null);
    }

    const trimmedEmail = email.trim();
    if (!isPlausibleEmail(trimmedEmail)) {
      setEmailError('Please enter a valid work or engineering email address.');
      hasError = true;
    } else {
      setEmailError(null);
    }

    if (hasError) {
      setIsEditingIdentity(true);
      return;
    }

    if (password === EDIT_PASSWORD) {
      setPasswordError(null);
      onSuccess(trimmedName, trimmedEmail);
      return;
    }

    setPassword('');
    setPasswordError('Incorrect password. Access denied.');
    setFailedAttempts(n => n + 1);
  };

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
  const labelCls = isDark ? 'text-gray-300' : 'text-slate-700';
  const mutedCls = isDark ? 'text-gray-400' : 'text-slate-500';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${
        isDark ? 'bg-black/75' : 'bg-slate-900/50'
      } backdrop-blur-sm`}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Engineering authorisation required"
    >
      <form onSubmit={submit} className={`w-full max-w-md border rounded-xl shadow-2xl ${panel}`}>
        <div className={`p-4 border-b flex items-start gap-3 ${divider}`}>
          <div className="mt-0.5 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Engineering Authorisation Required
            </h2>
            <p className={`text-xs mt-0.5 ${mutedCls}`}>
              Enter your credentials to apply and record this modification.
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

        <div className="p-5 space-y-4">
          <div className={`rounded-lg border px-3 py-2 ${isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>
              Target Modification
            </p>
            <p className={`text-xs font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{action}</p>
            {detail && (
              <p className={`text-[10px] font-mono mt-0.5 break-all ${mutedCls}`}>{detail}</p>
            )}
          </div>

          {/* User Identity Fields */}
          {isEditingIdentity ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-auth-name" className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${labelCls}`}>
                  <User className="w-3.5 h-3.5" />
                  Full Name
                </label>
                <input
                  id="edit-auth-name"
                  type="text"
                  autoFocus={!name}
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                  placeholder="e.g. Eng. Sarah Namubiru"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 ${
                    nameError ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
                  } ${inputCls}`}
                />
                {nameError && (
                  <p className="text-[10px] mt-1 text-red-500 font-semibold">{nameError}</p>
                )}
              </div>

              <div>
                <label htmlFor="edit-auth-email" className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${labelCls}`}>
                  <Mail className="w-3.5 h-3.5" />
                  Work Email
                </label>
                <input
                  id="edit-auth-email"
                  type="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder="e.g. snamubiru@radienergy.ug"
                  className={`w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 ${
                    emailError ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
                  } ${inputCls}`}
                />
                {emailError && (
                  <p className="text-[10px] mt-1 text-red-500 font-semibold">{emailError}</p>
                )}
              </div>
            </div>
          ) : (
            <div className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
            }`}>
              <div className="min-w-0">
                <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{name}</p>
                <p className={`text-[11px] truncate ${mutedCls}`}>{email}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingIdentity(true)}
                className="text-xs text-blue-500 hover:text-blue-400 font-semibold shrink-0"
              >
                Change
              </button>
            </div>
          )}

          {/* Password Input (No hints whatsoever) */}
          <div>
            <label htmlFor="edit-auth-password" className={`text-xs font-semibold mb-1 flex items-center gap-1.5 ${labelCls}`}>
              <Lock className="w-3.5 h-3.5" />
              Engineering Password
            </label>
            <input
              id="edit-auth-password"
              type="password"
              autoFocus={!isEditingIdentity}
              autoComplete="current-password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
              placeholder="••••••••"
              className={`w-full border rounded-lg px-3 py-2 text-xs font-mono tracking-widest focus:outline-none focus:ring-2 ${
                passwordError ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
              } ${inputCls}`}
            />
            {passwordError && (
              <p className="text-[10px] mt-1.5 text-red-500 font-semibold flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 shrink-0" />
                {passwordError} {failedAttempts > 1 ? `(${failedAttempts} failed attempts)` : ''}
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
            disabled={password.length === 0 || !name.trim() || !email.trim()}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Verify & Authorise</span>
          </button>
        </div>
      </form>
    </div>
  );
};
