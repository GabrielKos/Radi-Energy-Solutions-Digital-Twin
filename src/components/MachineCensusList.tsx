import React, { useState } from 'react';
import { ProcessZone, ProcessMachine, ThemeMode } from '../types/plant';
import { Cpu, Search, Filter, AlertTriangle, CheckCircle2, ShieldAlert, DollarSign, Layers, Info, Check, BatteryCharging } from 'lucide-react';

interface MachineCensusListProps {
  zones: ProcessZone[];
  theme?: ThemeMode;
}

export const MachineCensusList: React.FC<MachineCensusListProps> = ({ zones, theme = 'light' }) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<'all' | 'EV' | 'BESS'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const isDark = theme === 'dark';

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

  const totalMachinesCount = zones.reduce((a, b) => a + b.machineUnitsCount, 0); // 307
  const totalProcessEquipmentCost = zones.reduce((a, b) => a + b.totalCostUSD, 0);

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Top Census Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Installed Machines</div>
          <div className="text-2xl lg:text-3xl font-mono text-blue-600 font-bold mt-1">
            {totalMachinesCount} Units
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            EV Lines 1 & 2 (285u) + BESS Line (22u)
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Defensible Line Takt</div>
          <div className="text-2xl lg:text-3xl font-mono text-emerald-600 font-bold mt-1">26.57 sec / pack</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            1,183 good packs per 10-hr shift (97.0% FPY, 90% OEE)
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Process Equipment CapEx</div>
          <div className="text-2xl lg:text-3xl font-mono text-green-600 font-bold mt-1">$31.93 Million</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Ex-works, MES spine, tooling & 57.5% CIF/Duty
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">BESS Line Integration</div>
          <div className="text-2xl lg:text-3xl font-mono text-amber-500 font-bold mt-1">22 Machine Units</div>
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
        isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
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
                isDark ? 'bg-[#1A1D23] border-[#2D3139] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            />
          </div>

          {/* Line Type Filter Buttons */}
          <div className="flex items-center rounded-lg p-0.5 border border-slate-200 dark:border-[#2D3139] bg-slate-100 dark:bg-[#1A1D23]">
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
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
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
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="bottleneck">Bottleneck</option>
            <option value="idle">Idle</option>
          </select>
        </div>

        <div className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
          Showing <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{filteredMachines.length}</span> of {allMachines.length} machinery specifications
        </div>
      </div>

      {/* Table of Machine Census */}
      <div className={`rounded-xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
            <thead className={`border-b uppercase font-mono text-[10px] ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-400' : 'bg-slate-100 border-slate-200 text-slate-600'
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
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#2D3139]' : 'divide-slate-200'}`}>
              {filteredMachines.map(m => (
                <tr key={`${m.zoneCode}-${m.wbsCode}`} className={`transition-colors ${
                  isDark ? 'hover:bg-[#1A1D23]/60' : 'hover:bg-slate-50'
                }`}>
                  <td className="px-4 py-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                    {m.wbsCode}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      m.lineType === 'BESS'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/40'
                        : 'bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/40'
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
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                    {m.unitRateUSD > 0 ? `$${m.unitRateUSD.toLocaleString()}` : 'Included in Fixture'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">
                    {m.totalCostUSD > 0 ? `$${m.totalCostUSD.toLocaleString()}` : 'Tooling Line'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.status === 'bottleneck' ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-300 dark:border-red-700/40 rounded text-[10px] font-bold">
                        BOTTLENECK
                      </span>
                    ) : m.status === 'running' ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/40 rounded text-[10px] font-bold">
                        OPERATIONAL
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-400 border border-slate-300 dark:border-gray-700 rounded text-[10px]">
                        STANDBY
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
