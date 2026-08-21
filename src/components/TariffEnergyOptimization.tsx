import React, { useState } from 'react';
import { ThemeMode, TariffPeriod } from '../types/plant';
import { Zap, Clock, Plus } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { CrudSlideOver, CrudField } from './common/CrudSlideOver';
import { ConfirmDialog } from './common/ConfirmDialog';
import { formatHourRange } from '../lib/derived';

interface TariffEnergyOptimizationProps {
  periods: TariffPeriod[];
  theme?: ThemeMode;
  onAddPeriod: (period: Omit<TariffPeriod, 'id'>) => Promise<void>;
  onUpdatePeriod: (id: string, patch: Partial<TariffPeriod>) => Promise<void>;
  onDeletePeriod: (id: string) => Promise<void>;
}

const emptyPeriodForm = () => ({
  name: '',
  startHour: 0,
  endHour: 6,
  rateUSD: 0.05,
  rateUGX: 0,
  recommendedTask: '',
});

const UGX_PER_USD = 3750;

/** Handles periods that wrap past midnight (e.g. start 22, end 6). */
function hourInPeriod(hour: number, startHour: number, endHour: number): boolean {
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

export const TariffEnergyOptimization: React.FC<TariffEnergyOptimizationProps> = ({
  periods,
  theme = 'light',
  onAddPeriod,
  onUpdatePeriod,
  onDeletePeriod,
}) => {
  const [useOffPeakShift, setUseOffPeakShift] = useState<boolean>(true);
  const isDark = theme === 'dark';
  // One place to change the surface treatment, instead of ~10 hardcoded dark hexes.
  const card = isDark
    ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]'
    : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-gray-400' : 'text-slate-500';
  const eyebrow = isDark ? 'text-gray-400' : 'text-slate-500';
  const inset = isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]';
  const axis = isDark ? '#6B7280' : '#64748B';
  const grid = isDark ? '#2D3139' : '#E2E8F0';

  // --- CRUD panel state ---
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setFormError(null);
    setFormValues(emptyPeriodForm());
  };

  const openEdit = (p: TariffPeriod) => {
    setFormMode('edit');
    setEditingId(p.id);
    setFormError(null);
    setFormValues({
      name: p.name,
      startHour: p.startHour,
      endHour: p.endHour,
      rateUSD: p.rateUSD,
      rateUGX: p.rateUGX,
      recommendedTask: p.recommendedTask,
    });
  };

  // Two independent "Rate" fields meant they could silently drift apart. Typing
  // a USD rate now proposes the matching UGX rate; typing UGX still overrides it.
  const handleFieldChange = (key: string, value: any) => {
    setFormValues(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'rateUSD' && typeof value === 'number') {
        next.rateUGX = Math.round(value * UGX_PER_USD * 10) / 10;
      }
      return next;
    });
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = async () => {
    setBusy(true);
    setFormError(null);
    try {
      if (formMode === 'add') {
        await onAddPeriod(formValues as any);
      } else if (formMode === 'edit' && editingId) {
        await onUpdatePeriod(editingId, formValues);
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not save this tariff period. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDeletePeriod(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // leave dialog open on failure
    } finally {
      setBusy(false);
    }
  };

  const periodFields: CrudField[] = [
    { key: 'name', label: 'Period Name', type: 'text', required: true },
    { key: 'startHour', label: 'Start Hour', type: 'number', min: 0, max: 23, step: 1, integer: true, required: true, suffix: '0–23' },
    {
      key: 'endHour',
      label: 'End Hour',
      type: 'number',
      min: 1,
      max: 24,
      step: 1,
      integer: true,
      required: true,
      suffix: '1–24',
      helpText: 'May be less than the start hour — the period then wraps past midnight.',
      validate: (value, all) =>
        Number(value) === Number(all.startHour) ? 'Start and end hour cannot be the same — the period would cover nothing.' : null,
    },
    { key: 'rateUSD', label: 'Rate (USD)', type: 'number', step: 0.001, min: 0, required: true, suffix: 'USD/kWh' },
    { key: 'rateUGX', label: 'Rate (UGX)', type: 'number', step: 0.1, min: 0, required: true, suffix: 'UGX/kWh', helpText: `Kept in step with the USD rate at ${UGX_PER_USD.toLocaleString()} UGX/USD unless you override it.` },
    { key: 'recommendedTask', label: 'Recommended Task', type: 'textarea' },
  ];

  // Fallback so the chart still renders sensibly with zero or partial period coverage.
  const averageRateUSD = periods.length
    ? periods.reduce((sum, p) => sum + p.rateUSD, 0) / periods.length
    : 0.055;

  const findPeriodForHour = (hour: number): TariffPeriod | undefined =>
    periods.find(p => hourInPeriod(hour, p.startHour, p.endHour));

  const offPeakPeriod =
    periods.find(p => p.name.toLowerCase().includes('off')) ?? periods.find(p => p.rateUSD === Math.min(...periods.map(x => x.rateUSD)));

  // Hourly tariff + load profile, now entirely driven by the editable `periods` collection.
  const hourlyEnergyData = Array.from({ length: 24 }, (_, i) => {
    const matched = findPeriodForHour(i);
    const tariffUSD = matched?.rateUSD ?? averageRateUSD;
    const periodName = matched?.name ?? 'Unassigned';

    const isMainShift = i >= 6 && i < 16;
    const baseLoadKw = isMainShift ? 3800 : 800;
    const isOffPeakHour = offPeakPeriod ? hourInPeriod(i, offPeakPeriod.startHour, offPeakPeriod.endHour) : i >= 22 || i < 6;
    const cyclerLoadKw = useOffPeakShift ? (isOffPeakHour ? 1800 : 200) : isMainShift ? 1200 : 200;

    const totalKw = baseLoadKw + cyclerLoadKw;
    const hourlyCostUSD = totalKw * tariffUSD;

    return {
      hour: `${i.toString().padStart(2, '0')}:00`,
      loadKw: totalKw,
      tariffUSD,
      period: periodName,
      hourlyCostUSD,
    };
  });

  const OPERATING_DAYS = 300;
  const dailyCostUSD = hourlyEnergyData.reduce((acc, h) => acc + h.hourlyCostUSD, 0);
  const annualCostUSD = dailyCostUSD * OPERATING_DAYS;
  // Previously the "Annual Energy Consumption" card was a hardcoded 10,140 MWh
  // sitting next to a bill computed from this profile (~19,000 MWh). They now
  // come from the same numbers, so the two cards can no longer disagree.
  const dailyKwh = hourlyEnergyData.reduce((acc, h) => acc + h.loadKw, 0);
  const annualMwh = (dailyKwh * OPERATING_DAYS) / 1000;
  const peakLoadKw = Math.max(0, ...hourlyEnergyData.map(h => h.loadKw));
  const avgDisplayRate = periods.length ? (periods.reduce((s, p) => s + p.rateUSD, 0) / periods.length).toFixed(3) : '0.055';
  const maxRateDomain = Math.max(0.12, ...periods.map(p => p.rateUSD * 1.3), 0);

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-transparent text-[#D1D5DB]' : 'bg-transparent text-slate-800'
    }`}>
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${card}`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${eyebrow}`}>Connected Plant Load</div>
          <div className="text-3xl font-mono text-amber-600 dark:text-amber-400 mt-1 font-bold">6,500 kW</div>
          <div className={`text-[11px] mt-1 ${sub}`}>
            Rated substation capacity · modelled peak {peakLoadKw.toLocaleString()} kW
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${card}`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${eyebrow}`}>Annual Energy Consumption</div>
          <div className="text-3xl font-mono text-blue-600 dark:text-blue-400 mt-1 font-bold">
            {Math.round(annualMwh).toLocaleString()} MWh
          </div>
          <div className={`text-[11px] mt-1 ${sub}`}>From the load profile below, over {OPERATING_DAYS} operating days</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${card}`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${eyebrow}`}>Average Tariff (Live Periods)</div>
          <div className="text-3xl font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-bold">${avgDisplayRate} / kWh</div>
          <div className={`text-[11px] mt-1 ${sub}`}>Averaged across {periods.length} defined period{periods.length === 1 ? '' : 's'}</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${card}`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${eyebrow}`}>Estimated Annual Power Bill</div>
          <div className="text-3xl font-mono text-purple-600 dark:text-purple-400 mt-1 font-bold">
            ${Math.round(annualCostUSD).toLocaleString()}
          </div>
          <div className={`text-[11px] mt-1 ${sub}`}>
            {useOffPeakShift ? 'Off-peak cycler schedule active' : 'Standard schedule'}
          </div>
        </div>
      </div>

      {/* Main Tariff Schedule & Load Profile Chart */}
      <div className={`p-4 rounded-xl border flex flex-col transition-all ${card}`}>
        <div className={`flex flex-col md:flex-row md:items-center justify-between border-b pb-3 mb-4 gap-2 ${isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]'}`}>
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${heading}`}>
              <Zap className="w-4 h-4 text-amber-400" /> 24-Hour Power Load & Tariff Rate Curve
            </h3>
            <p className={`text-xs ${sub}`}>
              Uganda Electricity Regulatory Authority (ERA) Extra-Large Industrial Time-of-Use Schedule
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>Off-peak cycler load shifting:</span>
            <button
              onClick={() => setUseOffPeakShift(!useOffPeakShift)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                useOffPeakShift
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : `border ${inset} ${sub}`
              }`}
            >
              {useOffPeakShift
                ? `ENABLED${offPeakPeriod ? ` (${formatHourRange(offPeakPeriod.startHour, offPeakPeriod.endHour)})` : ''}`
                : 'DISABLED'}
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyEnergyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="hour" stroke={axis} fontSize={10} />
              <YAxis yAxisId="left" stroke={axis} fontSize={10} domain={[0, 6500]} tickFormatter={v => `${(v / 1000).toFixed(1)}MW`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={10} domain={[0, maxRateDomain]} tickFormatter={v => `$${v.toFixed(3)}`} />
              <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A', fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="loadKw" name="Power Demand (kW)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="stepAfter" dataKey="tariffUSD" name="Tariff ($/kWh)" stroke="#10B981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Editable tariff period cards */}
        <div className={`flex items-center justify-between mt-4 pt-3 border-t ${isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]'}`}>
          <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${heading}`}>
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Tariff Time-of-Use Periods
          </h4>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Period
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-xs font-mono">
          {periods.map(p => (
            <div key={p.id} className={`p-3 rounded-lg border relative group transition-colors ${inset}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className={`font-sans ${sub}`}>{p.name} ({formatHourRange(p.startHour, p.endHour)})</div>
                  <div className="text-emerald-600 dark:text-emerald-400 font-bold text-lg mt-0.5">${p.rateUSD.toFixed(3)} / kWh</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} title="Edit" className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10' : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></svg>
                  </button>
                  <button onClick={() => setDeleteTarget({ id: p.id, name: p.name })} title="Delete" className={`p-1 rounded transition-colors ${isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-red-700 hover:bg-red-50'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </div>
              <div className={`text-[10px] mt-1 ${sub}`}>{p.recommendedTask}</div>
            </div>
          ))}
          {periods.length === 0 && (
            <div className={`text-xs italic col-span-3 text-center py-4 ${sub}`}>
              No tariff periods yet — add one to build the 24-hour rate curve.
            </div>
          )}
        </div>
      </div>

      <CrudSlideOver
        open={formMode !== null}
        title={formMode === 'add' ? 'Add Tariff Period' : 'Edit Tariff Period'}
        subtitle={formMode === 'add' ? 'Adds a new time-of-use window to the rate curve.' : 'Changes save and sync live to every collaborator.'}
        fields={periodFields}
        values={formValues}
        onChange={handleFieldChange}
        onSave={handleSave}
        onCancel={closeForm}
        busy={busy}
        error={formError}
        saveLabel={formMode === 'add' ? 'Add Period' : 'Save Changes'}
        theme={theme}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this tariff period?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed from the rate curve for everyone. Hours it covered will fall back to the average rate until reassigned. This can't be undone.` : ''}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        theme={theme}
      />
    </div>
  );
};
