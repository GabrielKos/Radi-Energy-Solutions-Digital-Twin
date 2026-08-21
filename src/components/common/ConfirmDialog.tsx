import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ThemeMode } from '../../types/plant';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  theme?: ThemeMode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm ${
        isDark ? 'bg-black/70' : 'bg-slate-900/40'
      }`}
      onMouseDown={e => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`rounded-xl max-w-sm w-full p-5 shadow-2xl border ${
        isDark ? 'bg-[#15171C] border-[#2D3139] text-[#D1D5DB]' : 'bg-[#FDFCFA] border-[#E7E3DC] text-slate-700'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
            <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>{description}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className={isDark ? 'text-gray-500 hover:text-white p-1' : 'text-slate-400 hover:text-slate-900 p-1'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={busy}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 transition-colors ${
              isDark
                ? 'bg-[#1A1D23] border-[#2D3139] text-gray-300 hover:bg-[#252830]'
                : 'bg-white border-[#DDD8CF] text-slate-700 hover:bg-[#F6F5F2]'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 transition-colors"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
