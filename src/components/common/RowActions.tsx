import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { ThemeMode } from '../../types/plant';

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  label?: string;
  theme?: ThemeMode;
}

/**
 * The previous version used `text-gray-400` on both themes, which sits at
 * roughly 2.8:1 against a white table row — legible only if you already knew
 * the buttons were there. These tints hit AA in both themes.
 */
export const RowActions: React.FC<RowActionsProps> = ({ onEdit, onDelete, label, theme = 'light' }) => {
  const isDark = theme === 'dark';
  const base = 'p-1.5 rounded-lg transition-colors';
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={onEdit}
        title={label ? `Edit ${label}` : 'Edit'}
        aria-label={label ? `Edit ${label}` : 'Edit'}
        className={`${base} ${
          isDark
            ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10'
            : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onDelete}
        title={label ? `Delete ${label}` : 'Delete'}
        aria-label={label ? `Delete ${label}` : 'Delete'}
        className={`${base} ${
          isDark
            ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
            : 'text-slate-500 hover:text-red-700 hover:bg-red-50'
        }`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
