import React, { useState } from 'react';
import { SimulationState, ProcessZone, ThemeMode } from '../types/plant';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell as RechartsCell
} from 'recharts';
import { TrendingUp, AlertTriangle, CheckCircle2, Clock, Zap, Cpu, Gauge, ArrowRight, Activity, Sliders } from 'lucide-react';

interface ThroughputDashboardProps {
  simState: SimulationState;
  setSimState: React.Dispatch<React.SetStateAction<SimulationState>>;
  zones: ProcessZone[];
  theme?: ThemeMode;
}

export const ThroughputDashboard: React.FC<ThroughputDashboardProps> = ({
  simState,
  setSimState,
  zones,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  // Generate hourly data for 10-hour shift
  const hourlyTarget = 118.3; // 1,183 packs / 10 hours
  const hourlyData = Array.from({ length: 10 }, (_, i) => {
    const hour = i + 1;
    const elapsedRatio = Math.min(1, Math.max(0, simState.shiftTimeSeconds / 3600 - i));
    const isCompleted = simState.shiftTimeSeconds >= hour * 3600;
    const isCurrent = !isCompleted && simState.shiftTimeSeconds > i * 3600;

    // Simulate hourly variance based on line yield and speed
    const basePacks = Math.round(hourlyTarget * (0.95 + Math.sin(i * 0.8) * 0.05) * (simState.currentYieldPct / 0.97));
    const actualPacks = isCompleted
      ? basePacks
      : isCurrent
      ? Math.round(basePacks * elapsedRatio)
      : 0;

    const cumulativeTarget = Math.round(hourlyTarget * hour);
    const cumulativeActual = isCompleted
      ? Math.round(hourlyTarget * hour * (simState.goodPacks / Math.max(1, (simState.shiftTimeSeconds / 3600) * hourlyTarget)))
      : isCurrent
      ? simState.goodPacks
      : 0;

    return {
      hour: `Hr ${hour} (0${5 + hour}:00)`,
      target: Math.round(hourlyTarget),
      evPacks: actualPacks,
      bessUnits: Math.round(actualPacks * 0.08), // ~8% cabinet ratio
      cumulativeTarget,
      cumulativeActual,
    };
  });

  // Calculate zone cycle times vs target takt (26.57s)
  const zoneTaktData = zones.map(z => {
    // Average cycle time across machines in zone divided by machine count
    const avgCycle = z.machines.reduce((acc, m) => acc + (m.cycleTimeSec / m.machinesCount), 0) / z.machines.length;
    const isBottleneck = avgCycle > 26.57 || z.machines.some(m => m.status === 'bottleneck');
    return {
      name: z.wbsCode,
      fullName: z.name,
      avgCycleTime: parseFloat(avgCycle.toFixed(1)),
      targetTakt: 26.57,
      isBottleneck,
      color: z.color,
    };
  });

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Daily Target & Progress */}
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="uppercase font-bold tracking-wider">Shift EV Pack Target</span>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-mono">10 Hours</span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-light text-white font-mono flex items-baseline gap-2">
              {simState.goodPacks.toLocaleString()}{' '}
              <span className="text-sm text-gray-500 font-sans">/ 1,183 Packs</span>
            </div>
            <div className="w-full bg-[#1A1D23] h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (simState.goodPacks / 1183) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 font-mono">
            <span>Pacing: {((simState.goodPacks / Math.max(1, (simState.shiftTimeSeconds / 3600) * 118.3)) * 100).toFixed(1)}% of plan</span>
            <span className="text-green-400">Yield: {(simState.currentYieldPct * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Metric 2: BESS Cabinets Output */}
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="uppercase font-bold tracking-wider">BESS Storage Cabinets</span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-mono">22 Stations</span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-light text-amber-400 font-mono flex items-baseline gap-2">
              {Math.round(simState.goodPacks * 0.08)}{' '}
              <span className="text-sm text-gray-500 font-sans">/ 12 Cabinets</span>
            </div>
            <div className="w-full bg-[#1A1D23] h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, ((simState.goodPacks * 0.08) / 12) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 font-mono">
            <span>Integration Line: Active</span>
            <span className="text-amber-400">Cabinet Takt: 300s</span>
          </div>
        </div>

        {/* Metric 3: Line Takt Time Efficiency */}
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="uppercase font-bold tracking-wider">Line Takt Time</span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-mono">Target 26.57s</span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-light text-emerald-400 font-mono flex items-baseline gap-2">
              {simState.currentTaktSec.toFixed(2)}{' '}
              <span className="text-sm text-gray-500 font-sans">sec / pack</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              OEE: <span className="text-white font-bold font-mono">{(simState.currentOeePct * 100).toFixed(1)}%</span> (Planned 90.0%)
            </div>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-gray-400">
            <span>First Pass Yield: 97.0%</span>
            <span className="text-green-400">285 Machines</span>
          </div>
        </div>

        {/* Metric 4: Quality & Scrap Stats */}
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="uppercase font-bold tracking-wider">Quality & Rework</span>
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px] font-mono">ISO 2859-1</span>
          </div>
          <div className="my-2 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-400">Reworked</div>
              <div className="text-xl font-mono text-amber-400">{simState.reworkedPacks}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Scrapped</div>
              <div className="text-xl font-mono text-red-400">{simState.scrappedPacks}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Passed EOL</div>
              <div className="text-xl font-mono text-green-400">{simState.goodPacks}</div>
            </div>
          </div>
          <div className="flex justify-between text-[11px] font-mono text-gray-400">
            <span>Batch Ageing Sample: 6.76%</span>
            <span className="text-blue-400">S-2 Vibration: 0.42%</span>
          </div>
        </div>
      </div>

      {/* Main Visual Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hourly Production vs Target Chart */}
        <div className="lg:col-span-7 bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Hourly Production Throughput (EV Packs vs Target)
              </h3>
              <p className="text-xs text-gray-400">
                Shift target: 118.3 packs per hour to achieve 1,183 good packs per 10-hour shift.
              </p>
            </div>
            <div className="flex gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /> EV Packs Output
              </span>
              <span className="flex items-center gap-1.5 text-gray-400">
                <span className="w-2.5 h-0.5 bg-gray-500 rounded" /> Hourly Target (118)
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
                <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={11} tickLine={false} domain={[0, 150]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF', fontSize: '12px' }}
                />
                <Bar dataKey="evPacks" name="Actual EV Packs" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target" name="Target (118)" fill="#2D3139" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative Production Curve */}
        <div className="lg:col-span-5 bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cumulative Shift Progress Curve
              </h3>
              <p className="text-xs text-gray-400">Actual output curve vs target trajectory</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
                <XAxis dataKey="hour" stroke="#6B7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6B7280" fontSize={10} tickLine={false} domain={[0, 1250]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="cumulativeActual" name="Actual Cumulative" stroke="#10B981" fillOpacity={1} fill="url(#cumulGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="cumulativeTarget" name="Target Trajectory" stroke="#6B7280" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Zone Cycle Time & Bottleneck Analysis */}
      <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 border-b border-[#2D3139] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" /> Zone Cycle Time vs Takt Threshold (26.57 seconds)
            </h3>
            <p className="text-xs text-gray-400">
              Identifying process bottlenecks across process zones Z1 through Z8.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-sm" /> Bottleneck Danger Zone (&gt;26.57s)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Balanced Zone (&le;26.57s)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {zoneTaktData.map(z => (
            <div
              key={z.name}
              className={`p-3 rounded border transition-all ${
                z.isBottleneck
                  ? 'bg-red-500/10 border-red-500/40'
                  : 'bg-[#1A1D23] border-[#2D3139]'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-white" style={{ color: z.color }}>
                  {z.name}: {z.fullName.substring(0, 20)}...
                </span>
                {z.isBottleneck ? (
                  <span className="px-1.5 py-0.5 text-[9px] bg-red-500 text-white font-bold rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> BOTTLENECK
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-400 rounded font-mono">
                    NORMAL
                  </span>
                )}
              </div>

              <div className="text-lg font-mono font-bold text-white mt-2">
                {z.avgCycleTime}s <span className="text-xs text-gray-500 font-normal">/ 26.57s Takt</span>
              </div>

              <div className="w-full bg-[#0F1115] h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${z.isBottleneck ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (z.avgCycleTime / 26.57) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Simulation Parameters Controls */}
      <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" /> Interactive Line Efficiency & Yield Adjustment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Overall Equipment Effectiveness (OEE)</span>
              <span className="font-mono text-blue-400 font-bold">{(simState.currentOeePct * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.70"
              max="0.99"
              step="0.01"
              value={simState.currentOeePct}
              onChange={e =>
                setSimState(prev => ({ ...prev, currentOeePct: parseFloat(e.target.value) }))
              }
              className="w-full accent-blue-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">Design baseline: 90% (allows for planned/unplanned downtime)</p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>First Pass Yield Target</span>
              <span className="font-mono text-green-400 font-bold">{(simState.currentYieldPct * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0.85"
              max="0.99"
              step="0.005"
              value={simState.currentYieldPct}
              onChange={e =>
                setSimState(prev => ({ ...prev, currentYieldPct: parseFloat(e.target.value) }))
              }
              className="w-full accent-green-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">Design baseline: 97.0% (yield ramp climb from 85% to 97%)</p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Active Line Takt Speed</span>
              <span className="font-mono text-amber-400 font-bold">{simState.currentTaktSec.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="20"
              max="35"
              step="0.5"
              value={simState.currentTaktSec}
              onChange={e =>
                setSimState(prev => ({ ...prev, currentTaktSec: parseFloat(e.target.value) }))
              }
              className="w-full accent-amber-500"
            />
            <p className="text-[10px] text-gray-500 mt-1">Calculated Takt requirement: 26.57s for 1,183 packs/shift</p>
          </div>
        </div>
      </div>
    </div>
  );
};
