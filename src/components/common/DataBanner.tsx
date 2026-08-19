import React from 'react';
import { Loader2, AlertTriangle, Database, RotateCcw } from 'lucide-react';
import { ThemeMode } from '../../types/plant';
import { SeedStatus } from '../../lib/seedPlantData';

interface DataBannerProps {
  theme: ThemeMode;
  seedStatus: SeedStatus;
  seedError: string | null;
  /** A failed read from Supabase — wrong keys, network, or RLS. */
  loadError: string | null;
  isEmpty: boolean;
  onRetry: () => void;
  /** Anything the simulation had to clamp or default. */
  warnings: string[];
}

/**
 * A single strip that answers "why does this screen look wrong?".
 *
 * Empty tabs used to be indistinguishable from a broken build: no data, no
 * error, no next step. This says which of the three it is — still loading the
 * starting data, unable to reach the database, or running on values the model
 * had to clamp.
 */
export const DataBanner: React.FC<DataBannerProps> = ({
  theme,
  seedStatus,
  seedError,
  loadError,
  isEmpty,
  onRetry,
  warnings,
}) => {
  const isDark = theme === 'dark';

  const shell = (tone: 'info' | 'warn' | 'error') => {
    const base = 'px-4 py-2 text-xs flex items-center gap-2.5 border-b';
    if (tone === 'error') {
      return `${base} ${isDark ? 'bg-red-950/40 border-red-900/50 text-red-300' : 'bg-red-50 border-red-200 text-red-800'}`;
    }
    if (tone === 'warn') {
      return `${base} ${isDark ? 'bg-amber-950/40 border-amber-900/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-900'}`;
    }
    return `${base} ${isDark ? 'bg-blue-950/40 border-blue-900/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-900'}`;
  };

  const retryBtn = (label: string) => (
    <button
      onClick={onRetry}
      className="ml-auto shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
    >
      <RotateCcw className="w-3 h-3" /> {label}
    </button>
  );

  if (loadError) {
    return (
      <div className={shell('error')}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <strong>Cannot reach the database.</strong> {loadError} — check{' '}
          <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono">.env.local</code>,
          then restart the dev server.
        </span>
        {retryBtn('Retry')}
      </div>
    );
  }

  if (seedStatus === 'seeding') {
    return (
      <div className={shell('info')}>
        <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
        <span>Loading the plant's starting data into your database — this happens once.</span>
      </div>
    );
  }

  if (seedStatus === 'error') {
    return (
      <div className={shell('error')}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <strong>Could not load the starting data.</strong> {seedError} — the most likely cause is that the
          schema has not been applied yet: run{' '}
          <code className="font-mono">supabase/migrations/0001_init.sql</code> (and{' '}
          <code className="font-mono">0003_packs_per_cycle.sql</code>) in the Supabase SQL editor.
        </span>
        {retryBtn('Try again')}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={shell('warn')}>
        <Database className="w-4 h-4 shrink-0" />
        <span>Every table is empty. Load the plant's shipped machine census, warehouses, workforce, tariff and CapEx data?</span>
        {retryBtn('Load starting data')}
      </div>
    );
  }

  if (warnings.length > 0) {
    return (
      <div className={shell('warn')}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          <strong>Simulation guardrail:</strong> {warnings.join(' ')}
        </span>
      </div>
    );
  }

  return null;
};
