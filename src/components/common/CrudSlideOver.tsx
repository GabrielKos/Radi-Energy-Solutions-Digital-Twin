import React, { useEffect, useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { ThemeMode } from '../../types/plant';

export interface CrudField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'color';
  options?: { value: string; label: string }[];
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  helpText?: string;
  /** Shown greyed-out and non-interactive — for computed preview values like totalCostUSD. */
  readOnly?: boolean;

  // --- validation ---
  // Before this existed, a bad value went straight to Postgres and came back as
  // a raw constraint-violation string ("new row for relation \"tariff_periods\"
  // violates check constraint ..."). These are checked here first, against the
  // same bounds the migration enforces.
  required?: boolean;
  /** Reject fractional input (machine counts, crew sizes, hours). */
  integer?: boolean;
  /** Custom rule; return an error message, or null when the value is fine. */
  validate?: (value: any, all: Record<string, any>) => string | null;
}

/** Runs a field list against a value map. Exported so callers can pre-check too. */
export function validateFields(
  fields: CrudField[],
  values: Record<string, any>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.readOnly) continue;
    const raw = values[f.key];

    const isBlank = raw === undefined || raw === null || raw === '';
    if (f.required && isBlank) {
      errors[f.key] = `${f.label} is required.`;
      continue;
    }
    if (isBlank) continue;

    if (f.type === 'number') {
      const n = typeof raw === 'number' ? raw : parseFloat(raw);
      if (Number.isNaN(n)) {
        errors[f.key] = `${f.label} must be a number.`;
        continue;
      }
      if (f.integer && !Number.isInteger(n)) {
        errors[f.key] = `${f.label} must be a whole number.`;
        continue;
      }
      if (f.min !== undefined && n < f.min) {
        errors[f.key] = `${f.label} cannot be below ${f.min}.`;
        continue;
      }
      if (f.max !== undefined && n > f.max) {
        errors[f.key] = `${f.label} cannot be above ${f.max}.`;
        continue;
      }
    }

    if (f.type === 'color' && typeof raw === 'string' && !/^#[0-9a-fA-F]{6}$/.test(raw)) {
      errors[f.key] = 'Use a 6-digit hex colour, e.g. #3B82F6.';
      continue;
    }

    const custom = f.validate?.(raw, values);
    if (custom) errors[f.key] = custom;
  }
  return errors;
}

interface CrudSlideOverProps {
  open: boolean;
  title: string;
  subtitle?: string;
  fields: CrudField[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
  saveLabel?: string;
  theme?: ThemeMode;
}

export const CrudSlideOver: React.FC<CrudSlideOverProps> = ({
  open,
  title,
  subtitle,
  fields,
  values,
  onChange,
  onSave,
  onCancel,
  busy = false,
  error = null,
  saveLabel = 'Save',
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Clear stale messages whenever the panel is (re)opened for a different row.
  useEffect(() => {
    if (open) setFieldErrors({});
  }, [open, title]);

  const handleSave = () => {
    const errors = validateFields(fields, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSave();
  };

  const handleChange = (key: string, value: any) => {
    // Drop a field's error as soon as the user starts correcting it.
    setFieldErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
    onChange(key, value);
  };

  // Escape closes the panel — expected of any slide-over, and the only way out
  // on a keyboard today.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const panel = isDark
    ? 'bg-[#111318] border-[#2D3139] text-[#D1D5DB]'
    : 'bg-[#FDFCFA] border-[#E7E3DC] text-slate-800';
  const divider = isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]';
  const labelCls = isDark ? 'text-gray-300' : 'text-slate-700';
  const helpCls = isDark ? 'text-gray-500' : 'text-slate-500';
  const inputCls = isDark
    ? 'bg-[#1A1D23] border-[#2D3139] text-white placeholder-gray-500'
    : 'bg-[#F6F5F2] border-[#DDD8CF] text-slate-900 placeholder-slate-400';

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end ${isDark ? 'bg-black/60' : 'bg-slate-900/30'} backdrop-blur-sm`}
      onMouseDown={e => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`w-full max-w-md h-full border-l shadow-2xl flex flex-col ${panel}`}>
        <div className={`p-4 border-b flex items-start justify-between ${divider}`}>
          <div>
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h2>
            {subtitle && <p className={`text-xs mt-0.5 ${helpCls}`}>{subtitle}</p>}
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className={`p-1 rounded transition-colors ${
              isDark ? 'text-gray-400 hover:text-white hover:bg-[#1A1D23]' : 'text-slate-500 hover:text-slate-900 hover:bg-[#F1EEE8]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {fields.map(field => {
            const id = `crud-${field.key}`;
            const fieldError = fieldErrors[field.key];
            const base = `w-full border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 disabled:opacity-60 ${
              fieldError ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
            } ${inputCls}`;
            return (
              <div key={field.key}>
                <label htmlFor={id} className={`text-xs font-semibold mb-1 block ${labelCls}`}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    id={id}
                    value={values[field.key] ?? ''}
                    disabled={field.readOnly}
                    onChange={e => handleChange(field.key, e.target.value)}
                    className={base}
                  >
                    {(field.options ?? []).map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    value={values[field.key] ?? ''}
                    disabled={field.readOnly}
                    onChange={e => handleChange(field.key, e.target.value)}
                    rows={3}
                    className={`${base} resize-none`}
                  />
                ) : field.type === 'color' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={id}
                      type="color"
                      value={values[field.key] || '#3B82F6'}
                      disabled={field.readOnly}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className={`h-9 w-14 rounded-lg border cursor-pointer ${isDark ? 'border-[#2D3139] bg-[#1A1D23]' : 'border-[#DDD8CF] bg-[#F6F5F2]'}`}
                    />
                    <input
                      type="text"
                      value={values[field.key] ?? ''}
                      disabled={field.readOnly}
                      onChange={e => handleChange(field.key, e.target.value)}
                      className={`${base} font-mono flex-1`}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      id={id}
                      type={field.type === 'number' ? 'number' : 'text'}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      value={values[field.key] ?? (field.type === 'number' ? 0 : '')}
                      disabled={field.readOnly}
                      onChange={e =>
                        handleChange(
                          field.key,
                          field.type === 'number'
                            ? // Keep the raw string while it is mid-typing ("", "-", "1.")
                              // so the caret does not jump; the parent coerces on save.
                              e.target.value === ''
                              ? ''
                              : Number.isNaN(parseFloat(e.target.value))
                              ? values[field.key]
                              : parseFloat(e.target.value)
                            : e.target.value
                        )
                      }
                      className={`${base} ${field.suffix ? 'pr-16' : ''} ${
                        field.readOnly ? 'font-mono' : ''
                      }`}
                    />
                    {field.suffix && (
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none ${helpCls}`}>
                        {field.suffix}
                      </span>
                    )}
                  </div>
                )}
                {fieldError ? (
                  <p className="text-[10px] mt-1 text-red-600 dark:text-red-400 font-semibold">{fieldError}</p>
                ) : (
                  field.helpText && <p className={`text-[10px] mt-1 ${helpCls}`}>{field.helpText}</p>
                )}
              </div>
            );
          })}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className={`p-4 border-t flex gap-2 ${divider}`}>
          <button
            onClick={onCancel}
            disabled={busy}
            className={`flex-1 py-2 rounded-lg text-xs font-bold border disabled:opacity-50 transition-colors ${
              isDark
                ? 'bg-[#1A1D23] border-[#2D3139] text-gray-300 hover:bg-[#252830]'
                : 'bg-white border-[#DDD8CF] text-slate-700 hover:bg-[#F6F5F2]'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{busy ? 'Saving…' : saveLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
