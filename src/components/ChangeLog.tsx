import React, { useMemo, useState } from 'react';
import { History, Search, Plus, Pencil, Trash2, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AuditEntry, AuditAction, useAuditTrail } from '../lib/auditLog';
import { ThemeMode } from '../types/plant';

/**
 * The change trail, read-only.
 *
 * Entries are written by `guardCollection` and the station-position saver the
 * moment an authorised change lands. Nothing here can edit or delete them —
 * the table has no update or delete policy at all, so the trail cannot be
 * rewritten from any browser (see
 * `supabase/migrations/0004_station_positions_and_audit.sql`).
 */

interface ChangeLogProps {
  theme?: ThemeMode;
}

/** How each table is named for someone who has never seen the schema. */
const ENTITY_LABELS: Record<string, string> = {
  machines: 'Machine Census',
  warehouses: 'Warehouses',
  workforce: 'Workforce',
  tariff_periods: 'Tariff & Energy',
  capex_items: 'CapEx',
  station_positions: 'Floor Layout',
  zones: 'Zones',
};

/** Field names, as an engineer reading the trail would say them aloud. */
const FIELD_LABELS: Record<string, string> = {
  cycleTimeSec: 'Cycle time (s)',
  machinesCount: 'Units',
  unitRateUSD: 'Unit rate (USD)',
  utilizationPct: 'Utilisation (%)',
  packsPerCycle: 'Packs per cycle',
  wbsCode: 'WBS code',
  zoneId: 'Zone',
  areaSqm: 'Floor area (m²)',
  capacityUnits: 'Capacity (units)',
  currentStockPct: 'Stock (%)',
  rackingCostUSD: 'Racking CapEx (USD)',
  daysOfBuffer: 'Buffer (days)',
  dailyProductionTarget: 'Daily target',
  safetyRating: 'Safety rating',
  mheAssigned: 'MHE assigned',
  zoneOrFunction: 'Zone / function',
  shiftCrew: 'Shift crew',
  monthlySalaryUSD: 'Monthly salary (USD)',
  annualPayrollUSD: 'Annual payroll (USD)',
  machineUnits: 'Machine units',
  attendedUnits: 'Attended units',
  startHour: 'Start hour',
  endHour: 'End hour',
  rateUGX: 'Rate (UGX)',
  rateUSD: 'Rate (USD)',
  recommendedTask: 'Recommended task',
  costUSD: 'Cost (USD)',
  position: 'Position (x, y)',
};

const labelForField = (key: string) =>
  FIELD_LABELS[key] ??
  // camelCase / snake_case -> "Sentence case"
  key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

const ACTION_META: Record<AuditAction, { label: string; icon: React.ElementType; tone: string }> = {
  create: { label: 'Created', icon: Plus, tone: 'emerald' },
  update: { label: 'Updated', icon: Pencil, tone: 'blue' },
  delete: { label: 'Deleted', icon: Trash2, tone: 'red' },
};

/** "3 min ago" up to a day, then the calendar date. Full stamp is on hover. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ChangeLog: React.FC<ChangeLogProps> = ({ theme = 'light' }) => {
  const isDark = theme === 'dark';
  const { entries, loading, error, refetch } = useAuditTrail();

  const [query, setQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<'all' | AuditAction>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const actors = useMemo(
    () => Array.from(new Set(entries.map(e => e.actorEmail).filter(Boolean))).sort(),
    [entries]
  );
  const entities = useMemo(
    () => Array.from(new Set(entries.map(e => e.entity))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(e => {
      if (entityFilter !== 'all' && e.entity !== entityFilter) return false;
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (actorFilter !== 'all' && e.actorEmail !== actorFilter) return false;
      if (!q) return true;
      const haystack = [
        e.actorEmail,
        e.recordLabel,
        e.recordId,
        ENTITY_LABELS[e.entity] ?? e.entity,
        ...Object.keys(e.changes).map(labelForField),
        ...Object.values(e.changes).flatMap(c => [formatValue(c.from), formatValue(c.to)]),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query, entityFilter, actionFilter, actorFilter]);

  const card = isDark ? 'bg-[#111318]/90 border-[#2D3139]' : 'bg-[#FDFCFA]/95 border-[#E7E3DC]';
  const headCls = isDark ? 'bg-[#16191F] text-gray-400' : 'bg-[#F1EEE8] text-slate-600';
  const rowHover = isDark ? 'hover:bg-[#16191F]' : 'hover:bg-[#F6F5F2]';
  const divider = isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]';
  const muted = isDark ? 'text-gray-500' : 'text-slate-500';
  const inputCls = isDark
    ? 'bg-[#1A1D23] border-[#2D3139] text-white placeholder-gray-500'
    : 'bg-white border-[#DDD8CF] text-slate-900 placeholder-slate-400';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl border backdrop-blur-xl p-4 ${card}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30">
              <History className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Change Log
              </h2>
              <p className={`text-xs mt-0.5 ${muted}`}>
                Every authorised change to the shared plant record — who, what and when.
              </p>
            </div>
          </div>
          <button
            onClick={refetch}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
              isDark
                ? 'bg-[#1A1D23] border-[#2D3139] text-gray-300 hover:bg-[#252830]'
                : 'bg-white border-[#DDD8CF] text-slate-700 hover:bg-[#F6F5F2]'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 ${
            isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
          <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
            This trail is append-only — entries cannot be edited or removed from the app. The email on
            each entry is the one the person entered when authorising, not a verified sign-in;
            verified identity arrives with Supabase Auth.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-xl border backdrop-blur-xl p-3 ${card}`}>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${muted}`} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search person, record or value…"
              aria-label="Search the change log"
              className={`w-full border rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
            />
          </div>

          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            aria-label="Filter by area"
            className={`border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
          >
            <option value="all">All areas</option>
            {entities.map(en => (
              <option key={en} value={en}>
                {ENTITY_LABELS[en] ?? en}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as 'all' | AuditAction)}
            aria-label="Filter by action"
            className={`border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
          >
            <option value="all">All actions</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>

          <select
            value={actorFilter}
            onChange={e => setActorFilter(e.target.value)}
            aria-label="Filter by person"
            className={`border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputCls}`}
          >
            <option value="all">Everyone</option>
            {actors.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <p className={`text-[10px] mt-2 ${muted}`}>
          Showing {filtered.length.toLocaleString()} of {entries.length.toLocaleString()} recorded
          {entries.length === 500 ? ' (most recent 500)' : ''}
        </p>
      </div>

      {/* Trail */}
      <div className={`rounded-xl border backdrop-blur-xl overflow-hidden ${card}`}>
        {error ? (
          <div className="p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                The change log could not be loaded.
              </p>
              <p className={`text-xs mt-1 ${muted}`}>{error}</p>
              <p className={`text-xs mt-2 ${muted}`}>
                If this says the relation does not exist, run{' '}
                <code className="font-mono">supabase/migrations/0004_station_positions_and_audit.sql</code>{' '}
                in the Supabase SQL editor. Changes still save normally until then — they are simply
                not recorded here.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className={`p-10 text-center text-xs ${muted}`}>Loading the change log…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <History className={`w-8 h-8 mx-auto mb-2 ${muted}`} />
            <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              {entries.length === 0 ? 'No changes recorded yet.' : 'Nothing matches these filters.'}
            </p>
            <p className={`text-xs mt-1 ${muted}`}>
              {entries.length === 0
                ? 'The first authorised edit to a machine, warehouse or the floor layout will appear here.'
                : 'Try clearing the search or widening the filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className={`text-[10px] uppercase tracking-wider ${headCls}`}>
                <tr>
                  <th className="px-4 py-2 font-bold sticky top-0">When</th>
                  <th className="px-4 py-2 font-bold sticky top-0">Who</th>
                  <th className="px-4 py-2 font-bold sticky top-0">Action</th>
                  <th className="px-4 py-2 font-bold sticky top-0">Area</th>
                  <th className="px-4 py-2 font-bold sticky top-0">Record</th>
                  <th className="px-4 py-2 font-bold sticky top-0">What changed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <ChangeRow key={entry.id} entry={entry} isDark={isDark} divider={divider} rowHover={rowHover} muted={muted} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const ChangeRow: React.FC<{
  entry: AuditEntry;
  isDark: boolean;
  divider: string;
  rowHover: string;
  muted: string;
}> = ({ entry, isDark, divider, rowHover, muted }) => {
  const meta = ACTION_META[entry.action] ?? ACTION_META.update;
  const Icon = meta.icon;
  const changeKeys = Object.keys(entry.changes);

  const tone =
    meta.tone === 'emerald'
      ? isDark
        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : meta.tone === 'red'
      ? isDark
        ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : 'bg-red-50 text-red-700 border-red-200'
      : isDark
      ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <tr className={`border-t text-xs align-top ${divider} ${rowHover} transition-colors`}>
      <td className={`px-4 py-2.5 whitespace-nowrap ${muted}`} title={new Date(entry.at).toLocaleString()}>
        {relativeTime(entry.at)}
      </td>
      <td className={`px-4 py-2.5 font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
        {entry.actorEmail || <span className={muted}>unattributed</span>}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${tone}`}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </span>
      </td>
      <td className={`px-4 py-2.5 whitespace-nowrap ${muted}`}>{ENTITY_LABELS[entry.entity] ?? entry.entity}</td>
      <td className={`px-4 py-2.5 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {entry.recordLabel || <span className={`font-mono font-normal ${muted}`}>{entry.recordId}</span>}
      </td>
      <td className="px-4 py-2.5">
        {changeKeys.length === 0 ? (
          <span className={muted}>{entry.action === 'delete' ? 'Record removed' : 'No field values recorded'}</span>
        ) : (
          <div className="space-y-0.5">
            {changeKeys.map(key => {
              const change = entry.changes[key];
              return (
                <div key={key} className="flex flex-wrap items-baseline gap-1.5">
                  <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                    {labelForField(key)}
                  </span>
                  {entry.action === 'create' ? (
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatValue(change.to)}
                    </span>
                  ) : (
                    <>
                      <span className={`font-mono line-through ${muted}`}>{formatValue(change.from)}</span>
                      <span className={muted}>→</span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatValue(change.to)}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </td>
    </tr>
  );
};
