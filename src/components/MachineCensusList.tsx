import React, { useState } from 'react';
import { ProcessZone, ProcessMachine, ThemeMode } from '../types/plant';
import { DerivedSimInputs } from '../lib/simulationInputs';

/**
 * Defensible default machine count: how many parallel units (each handling
 * `packsPerCycle` per cycle) it takes to bring this station's own cycle time
 * down to at or under the line's target takt. Mirrors the auto-scaling math
 * on the Floor Twin tab (`tStack`/`tWeld`/`tCycler`), so the census and the
 * floor layout agree on why a station has the quantity it has.
 */
function defensibleMachineCount(cycleTimeSec: number, packsPerCycle: number, targetTaktSec: number): number {
  if (cycleTimeSec <= 0) return 1;
  const perUnit = Math.max(1, packsPerCycle);
  const takt = Math.max(0.01, targetTaktSec);
  return Math.max(1, Math.ceil(cycleTimeSec / (perUnit * takt)));
}
import { Cpu, Search, Filter, AlertTriangle, CheckCircle2, ShieldAlert, DollarSign, Layers, Info, Check, BatteryCharging, Plus } from 'lucide-react';
import { CrudSlideOver, CrudField } from './common/CrudSlideOver';
import { ConfirmDialog } from './common/ConfirmDialog';
import { RowActions } from './common/RowActions';

interface MachineCensusListProps {
  zones: ProcessZone[];
  theme?: ThemeMode;
  /** Live line model derived from these very rows — see lib/simulationInputs. */
  derived: DerivedSimInputs;
  onAddMachine: (machine: Omit<ProcessMachine, 'id' | 'totalCostUSD'> & { zoneId: string }) => Promise<void>;
  onUpdateMachine: (id: string, patch: Partial<ProcessMachine>) => Promise<void>;
  onDeleteMachine: (id: string) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: 'running', label: 'Running' },
  { value: 'bottleneck', label: 'Bottleneck' },
  { value: 'idle', label: 'Idle' },
  { value: 'maintenance', label: 'Maintenance' },
];

const emptyMachineForm = (zoneId: string, taktSec: number) => ({
  zoneId,
  wbsCode: '',
  name: '',
  description: '',
  cycleTimeSec: 30,
  machinesCount: defensibleMachineCount(30, 1, taktSec),
  packsPerCycle: 1,
  unitRateUSD: 0,
  status: 'running',
  utilizationPct: 90,
});

export const MachineCensusList: React.FC<MachineCensusListProps> = ({
  zones,
  theme = 'light',
  derived,
  onAddMachine,
  onUpdateMachine,
  onDeleteMachine,
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<'all' | 'EV' | 'BESS'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // --- CRUD panel state ---
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const isDark = theme === 'dark';

  const zoneOptions: CrudField['options'] = zones.map(z => ({ value: z.id, label: `${z.wbsCode} — ${z.name}` }));

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setFormError(null);
    setFormValues(emptyMachineForm(zones[0]?.id ?? '', derived.taktSec));
  };

  const openEdit = (m: ProcessMachine & { zoneCode: string }) => {
    const zone = zones.find(z => z.machines.some(mm => mm.id === m.id));
    setFormMode('edit');
    setEditingId(m.id);
    setFormError(null);
    setFormValues({
      zoneId: zone?.id ?? '',
      wbsCode: m.wbsCode,
      name: m.name,
      description: m.description,
      cycleTimeSec: m.cycleTimeSec,
      machinesCount: m.machinesCount,
      packsPerCycle: m.packsPerCycle ?? 1,
      unitRateUSD: m.unitRateUSD,
      status: m.status,
      utilizationPct: m.utilizationPct,
    });
  };

  // Cycle time / batch size drive the defensible default quantity. Editing
  // either one re-suggests machinesCount; editing machinesCount itself is a
  // deliberate override and is left alone.
  const handleFieldChange = (key: string, value: any) => {
    setFormValues(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'cycleTimeSec' || key === 'packsPerCycle') {
        next.machinesCount = defensibleMachineCount(
          Number(key === 'cycleTimeSec' ? value : prev.cycleTimeSec) || 0,
          Number(key === 'packsPerCycle' ? value : prev.packsPerCycle) || 1,
          derived.taktSec
        );
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
        await onAddMachine(formValues as any);
      } else if (formMode === 'edit' && editingId) {
        await onUpdateMachine(editingId, formValues);
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not save this machine. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDeleteMachine(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Keep the dialog open with the row intact if the delete failed.
    } finally {
      setBusy(false);
    }
  };

  const machineFields: CrudField[] = [
    { key: 'zoneId', label: 'Zone', type: 'select', options: zoneOptions, required: true },
    {
      key: 'wbsCode',
      label: 'WBS Code',
      type: 'text',
      required: true,
      // Duplicate codes inside one zone make the census ambiguous to read even
      // though the database will happily accept them.
      validate: (value, all) => {
        const zone = zones.find(z => z.id === all.zoneId);
        if (!zone) return null;
        const clash = zone.machines.some(
          m => m.id !== editingId && m.wbsCode.trim().toLowerCase() === String(value).trim().toLowerCase()
        );
        return clash ? `${zone.wbsCode} already has a machine with this WBS code.` : null;
      },
    },
    { key: 'name', label: 'Machine / Station Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'cycleTimeSec', label: 'Cycle Time', type: 'number', suffix: 'sec', min: 0, required: true },
    {
      key: 'machinesCount',
      label: 'Quantity (auto — editable)',
      type: 'number',
      suffix: 'units',
      min: 1,
      integer: true,
      required: true,
      helpText: `Defaults to ceil(cycle time / (packs per cycle × ${derived.taktSec.toFixed(2)}s line takt)) — enough parallel units to hit the line takt. Recalculates when cycle time or packs per cycle change; override it directly if the engineered count differs.`,
    },
    {
      key: 'packsPerCycle',
      label: 'Packs per Cycle',
      type: 'number',
      suffix: 'packs',
      min: 1,
      integer: true,
      required: true,
      helpText: 'Leave at 1 for an in-line station. Batch equipment (e.g. a curing tunnel holding 50 packs) needs its real batch size, or it reads as a false bottleneck.',
    },
    { key: 'unitRateUSD', label: 'Unit Rate', type: 'number', suffix: 'USD', min: 0, required: true },
    {
      key: 'totalCostPreview',
      label: 'Total CapEx (computed)',
      type: 'text',
      readOnly: true,
      helpText: 'Unit Rate × Quantity — recalculated automatically, not directly editable.',
    },
    { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
    { key: 'utilizationPct', label: 'Utilization', type: 'number', min: 0, max: 100, suffix: '%', required: true },
  ];

  const formValuesWithPreview = {
    ...formValues,
    totalCostPreview: `$${((formValues.unitRateUSD || 0) * (formValues.machinesCount || 0)).toLocaleString()}`,
  };

  const allMachines: (ProcessMachine & { zoneCode: string; zoneName: string; zoneColor: string; lineType?: string })[] = zones.flatMap(
    z =>
      z.machines.map(m => ({
        ...m,
        zoneCode: z.wbsCode,
        zoneName: z.name,
        zoneColor: z.color,
        lineType: z.lineType || (z.wbsCode === 'Z_BESS' ? 'BESS' : 'EV'),
      }))
  );

  const filteredMachines = allMachines.filter(m => {
    const matchesZone = selectedZoneId === 'all' || m.zoneCode.toLowerCase() === selectedZoneId.toLowerCase();
    const matchesLine = lineFilter === 'all' || m.lineType === lineFilter;
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.wbsCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    return matchesZone && matchesLine && matchesSearch && matchesStatus;
  });

  const totalMachinesCount = zones.reduce((a, b) => a + b.machineUnitsCount, 0);
  const totalProcessEquipmentCost = zones.reduce((a, b) => a + b.totalCostUSD, 0);
  const bessMachineUnits = allMachines
    .filter(m => m.lineType === 'BESS')
    .reduce((a, m) => a + m.machinesCount, 0);
  const evMachineUnits = totalMachinesCount - bessMachineUnits;

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-transparent text-[#D1D5DB]' : 'bg-transparent text-slate-800'
    }`}>
      {/* Top Census Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Installed Machines</div>
          <div className="text-2xl lg:text-3xl font-mono text-blue-600 font-bold mt-1">
            {totalMachinesCount} Units
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            EV Lines 1 & 2 ({evMachineUnits}u) + BESS Line ({bessMachineUnits}u)
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Live Line Takt</div>
          <div className="text-2xl lg:text-3xl font-mono text-emerald-600 font-bold mt-1">
            {derived.taktSec.toFixed(2)} sec / pack
          </div>
          {/* Was the literal string "26.57 sec / pack". It is now the slowest
              effective station in the table below, so editing a cycle time or a
              unit count moves this — and the running simulation with it. */}
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Set by {derived.bottleneckZone} · {derived.bottleneckName} →{' '}
            {derived.targetPacks.toLocaleString()} good packs / shift
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Census Equipment Subtotal</div>
          <div className="text-2xl lg:text-3xl font-mono text-green-600 font-bold mt-1">
            ${(totalProcessEquipmentCost / 1000000).toFixed(2)} Million
          </div>
          {/* This card used to read a fixed "$31.93 Million" — the fully-loaded
              WBS B.2 figure — while the rows underneath sum to the ex-works
              total. Editing a machine moved the table and left the card alone.
              It now states exactly what it adds up, and defers the loaded number
              to the CapEx ledger so the two screens cannot drift apart. */}
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Sum of the {allMachines.length} line items below, ex-works — CIF/duty,
            MES spine & tooling are carried in WBS B.2 on the CapEx tab
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>BESS Line Integration</div>
          <div className="text-2xl lg:text-3xl font-mono text-amber-600 font-bold mt-1">
            {bessMachineUnits} Machine Units
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            1500V DC Busbars, Liquid Cold Plate & 40ft Containers
          </div>
        </div>
      </div>

      {/* Engineering Defensibility Callout */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark ? 'bg-blue-950/20 border-blue-800/40 text-blue-200' : 'bg-blue-50 border-blue-200 text-blue-900'
      }`}>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm block">Engineering Model & Cycle Time Validation (T-6 Nakasongola Gigafactory):</span>
            Cycle times are mathematically harmonized to the 26.57s takt spine. High-dwell stations (e.g. 5-hr Battery Ageing Cyclers @ 1,217s amortized across 46 units, 9-hr Vibration rigs @ 136s amortized across 6 rigs, and 3-tunnel Adhesive Curing @ 3,600s for 50 packs) use parallelized thread arrays to eliminate line bottlenecks.
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
        isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
      }`}>
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search by machine name, WBS code, description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 border ${
                isDark ? 'bg-[#1A1D23] border-[#2D3139] text-white' : 'bg-[#F6F5F2] border-[#E7E3DC] text-slate-800'
              }`}
            />
          </div>

          {/* Line Type Filter Buttons */}
          <div className={`flex items-center rounded-lg p-0.5 border ${
            isDark ? 'border-[#2D3139] bg-[#1A1D23]' : 'border-slate-200 bg-slate-100'
          }`}>
            <button
              onClick={() => setLineFilter('all')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                lineFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Lines
            </button>
            <button
              onClick={() => setLineFilter('EV')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                lineFilter === 'EV'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              EV Pack (Z1-Z8)
            </button>
            <button
              onClick={() => setLineFilter('BESS')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                lineFilter === 'BESS'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BESS Line
            </button>
          </div>

          {/* Zone Filter */}
          <select
            value={selectedZoneId}
            onChange={e => setSelectedZoneId(e.target.value)}
            className={`border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-white' : 'bg-[#F6F5F2] border-[#E7E3DC] text-slate-800'
            }`}
          >
            <option value="all">All Zones & Lines</option>
            {zones.map(z => (
              <option key={z.wbsCode} value={z.wbsCode}>
                {z.wbsCode}: {z.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className={`border text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-white' : 'bg-[#F6F5F2] border-[#E7E3DC] text-slate-800'
            }`}
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="bottleneck">Bottleneck</option>
            <option value="idle">Idle</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Showing <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{filteredMachines.length}</span> of {allMachines.length} machinery specifications
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Machine
          </button>
        </div>
      </div>

      {/* Table of Machine Census */}
      <div className={`rounded-xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#111318]/52 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/52 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
      }`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
            <thead className={`sticky top-0 z-10 border-b uppercase font-mono text-[10px] ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-400' : 'bg-[#F1EEE8] border-[#E7E3DC] text-slate-600'
            }`}>
              <tr>
                <th className="px-4 py-3">WBS Code</th>
                <th className="px-4 py-3">Line & Zone</th>
                <th className="px-4 py-3">Machine / Station Specification</th>
                <th className="px-4 py-3 text-center">Cycle Time</th>
                <th className="px-4 py-3 text-center">Qty (Units)</th>
                <th className="px-4 py-3 text-right">Unit Rate (USD)</th>
                <th className="px-4 py-3 text-right">Total CapEx (USD)</th>
                <th className="px-4 py-3 text-center">State</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#2D3139]' : 'divide-[#E7E3DC]'}`}>
              {filteredMachines.map(m => (
                <tr key={m.id} className={`transition-colors ${
                  isDark ? 'hover:bg-[#1A1D23]/60' : 'hover:bg-[#F6F5F2]'
                }`}>
                  <td className="px-4 py-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                    {m.wbsCode}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      m.lineType === 'BESS'
                        ? isDark
                          ? 'bg-amber-900/30 text-amber-400 border border-amber-700/40'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                        : isDark
                        ? 'bg-blue-900/30 text-blue-400 border border-blue-700/40'
                        : 'bg-blue-100 text-blue-800 border border-blue-300'
                    }`}>
                      {m.lineType || 'EV'} Line
                    </span>
                    <div className={`text-[10px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{m.zoneCode}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{m.name}</div>
                    <div className={`text-[11px] mt-0.5 max-w-sm ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{m.description}</div>
                  </td>
                  <td className={`px-4 py-3 text-center font-mono font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {m.cycleTimeSec > 0 ? `${m.cycleTimeSec}s` : 'Continuous'}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-amber-500 font-bold">
                    {m.machinesCount}
                    {(m.packsPerCycle ?? 1) > 1 && (
                      <span className={`block text-[9px] font-normal ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        x{m.packsPerCycle}/cycle
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                    {m.unitRateUSD > 0 ? `$${m.unitRateUSD.toLocaleString()}` : 'Included in Fixture'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">
                    {m.totalCostUSD > 0 ? `$${m.totalCostUSD.toLocaleString()}` : 'Tooling Line'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.status === 'bottleneck' ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isDark ? 'bg-red-900/30 text-red-400 border-red-700/40' : 'bg-red-100 text-red-700 border-red-300'
                      }`}>
                        BOTTLENECK
                      </span>
                    ) : m.status === 'running' ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isDark ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      }`}>
                        OPERATIONAL
                      </span>
                    ) : m.status === 'maintenance' ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isDark
                          ? 'bg-amber-900/30 text-amber-400 border-amber-700/40'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        MAINTENANCE
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${
                        isDark
                          ? 'bg-gray-800 text-gray-400 border-gray-700'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        STANDBY
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      theme={theme}
                      label={m.name}
                      onEdit={() => openEdit(m)}
                      onDelete={() => setDeleteTarget({ id: m.id, name: m.name })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CrudSlideOver
        open={formMode !== null}
        title={formMode === 'add' ? 'Add Machine' : 'Edit Machine'}
        subtitle={formMode === 'add' ? 'Adds a new station to the selected zone.' : 'Changes save and sync to everyone viewing this plant.'}
        fields={machineFields}
        values={formValuesWithPreview}
        onChange={handleFieldChange}
        onSave={handleSave}
        onCancel={closeForm}
        busy={busy}
        error={formError}
        saveLabel={formMode === 'add' ? 'Add Machine' : 'Save Changes'}
        theme={theme}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this machine?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed from the census for everyone. This can't be undone.` : ''}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        theme={theme}
      />
    </div>
  );
};
