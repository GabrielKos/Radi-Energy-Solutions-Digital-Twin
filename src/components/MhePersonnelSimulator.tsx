import React, { useState, useEffect } from 'react';
import { MheItem, PersonnelCategory, SimulationState, ThemeMode } from '../types/plant';
import { Truck, Activity, Users, Zap, Clock, AlertOctagon, ArrowUpRight, Play, Pause, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface MhePersonnelSimulatorProps {
  mheFleet: MheItem[];
  personnelList: PersonnelCategory[];
  simState: SimulationState;
  setSimState: React.Dispatch<React.SetStateAction<SimulationState>>;
  theme?: ThemeMode;
}

export const MhePersonnelSimulator: React.FC<MhePersonnelSimulatorProps> = ({
  mheFleet,
  personnelList,
  simState,
  setSimState,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  // Scenario state
  const [agvCount, setAgvCount] = useState<number>(11);
  const [agvSpeed, setAgvSpeed] = useState<number>(1.2); // m/s
  const [hvCableOperators, setHvCableOperators] = useState<number>(43);
  const [vnaReachTrucks, setVnaReachTrucks] = useState<number>(4);
  const [selectedMheFilter, setSelectedMheFilter] = useState<string>('all');
  const [simulatedCongestionLevel, setSimulatedCongestionLevel] = useState<'Low' | 'Medium' | 'High'>('Low');

  // Simulated node positions for live canvas graphic
  const [nodes, setNodes] = useState([
    { id: 'agv-1', type: 'AGV', label: 'AGV #01', x: 120, y: 150, targetX: 320, targetY: 180, progress: 0.3, status: 'Active (Cell Tray Transfer)' },
    { id: 'agv-2', type: 'AGV', label: 'AGV #02', x: 280, y: 180, targetX: 120, targetY: 150, progress: 0.7, status: 'Return to Cell Store' },
    { id: 'agv-3', type: 'AGV', label: 'AGV #03', x: 150, y: 160, targetX: 350, targetY: 180, progress: 0.1, status: 'Active (Cell Tray Transfer)' },
    { id: 'rt-1', type: 'Reach Truck', label: 'VNA Reach Truck #01', x: 90, y: 120, targetX: 90, targetY: 220, progress: 0.5, status: 'High-Bay Stacking' },
    { id: 'fl-1', type: 'Forklift', label: 'Forklift #01', x: 100, y: 300, targetX: 320, targetY: 320, progress: 0.4, status: 'Non-Live Materials Transport' },
    { id: 'fl-2', type: 'Forklift', label: 'Forklift #02', x: 780, y: 200, targetX: 900, targetY: 220, progress: 0.8, status: 'Finished Pack Loading' },
    { id: 'op-1', type: 'Operator', label: 'Z6 Manual Tech #14', x: 480, y: 380, targetX: 520, targetY: 380, progress: 0.2, status: 'HV Cable Termination' },
    { id: 'op-2', type: 'Operator', label: 'Z1 Kitting Tech #04', x: 340, y: 180, targetX: 360, targetY: 180, progress: 0.9, status: 'Cell Tray Decant' },
  ]);

  // Live animation step
  useEffect(() => {
    if (!simState.isRunning) return;
    const interval = setInterval(() => {
      setNodes(prev =>
        prev.map(node => {
          let newProg = node.progress + 0.05 * (agvSpeed / 1.2);
          if (newProg >= 1) {
            newProg = 0;
            // Swap start and target
            return {
              ...node,
              x: node.targetX,
              y: node.targetY,
              targetX: node.x,
              targetY: node.y,
              progress: 0,
            };
          }
          return { ...node, progress: newProg };
        })
      );
    }, 200);
    return () => clearInterval(interval);
  }, [simState.isRunning, agvSpeed]);

  // Data for MHE utilization chart
  const mheUtilizationData = mheFleet.map(item => ({
    name: item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name,
    qty: item.wbsCode === 'C.1.1.1' ? agvCount : item.qty,
    utilization: item.utilizationPct,
    wbsCode: item.wbsCode,
  }));

  // Calculations for Personnel allocation vs Machine count
  const directCrewTotal = personnelList.filter(p => p.classification === 'Direct').reduce((a, b) => a + b.shiftCrew, 0);
  const indirectCrewTotal = personnelList.filter(p => p.classification === 'Indirect').reduce((a, b) => a + b.shiftCrew, 0);

  const directCrewBreakdown = personnelList
    .filter(p => p.classification === 'Direct')
    .map(p => ({
      name: p.zoneOrFunction.replace('Zone ', ''),
      crew: p.ref === 'L.6' ? hvCableOperators : p.shiftCrew,
      attended: p.attendedUnits,
    }));

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">MHE Active Fleet</div>
          <div className="text-3xl font-mono text-blue-400 mt-1">{47 + (agvCount - 11)} Units</div>
          <div className="text-[11px] text-gray-500 mt-1">11 AGVs, 4 VNA Reach, 8 Forklifts, 17 Stackers, 6 Cranes</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Direct Line Operators</div>
          <div className="text-3xl font-mono text-emerald-400 mt-1">{124 + (hvCableOperators - 43)} Crew</div>
          <div className="text-[11px] text-gray-500 mt-1">109 Shift direct + 15 relief factor (1.14x)</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Indirect Support Staff</div>
          <div className="text-3xl font-mono text-purple-400 mt-1">{indirectCrewTotal} Staff</div>
          <div className="text-[11px] text-gray-500 mt-1">Maintenance, Quality, Security, Logistics, Admin</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Factory Congestion Index</div>
          <div className={`text-3xl font-mono mt-1 ${simulatedCongestionLevel === 'Low' ? 'text-green-400' : 'text-amber-400'}`}>
            {simulatedCongestionLevel}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">Avg AGV Queue Time: 12 seconds</div>
        </div>
      </div>

      {/* Interactive Simulation Arena & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Simulation Arena Canvas */}
        <div className="lg:col-span-8 bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col">
          <div className="flex items-center justify-between mb-3 border-b border-[#2D3139] pb-2">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" /> Live MHE & Operator Pathing Simulation
              </h3>
              <p className="text-xs text-gray-400">
                Tracking AGV tray transfer cycles, forklift aisle movements, and operator manual assembly tasks.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span className="text-gray-300">Active Simulation</span>
            </div>
          </div>

          {/* Visual Canvas Diagram for Movements */}
          <div className="relative h-80 bg-[#090A0D] border border-[#2D3139] rounded overflow-hidden p-2">
            {/* Background Factory Zones */}
            <div className="absolute left-4 top-4 w-44 h-32 border border-blue-500/30 bg-blue-500/5 rounded p-2 text-[10px] text-blue-400">
              INBOUND CELL STORE (350k Cells)
            </div>

            <div className="absolute left-56 top-4 w-72 h-32 border border-green-500/30 bg-green-500/5 rounded p-2 text-[10px] text-green-400">
              MAIN PRODUCTION SPINE (Z1 - Z4)
            </div>

            <div className="absolute left-56 top-40 w-72 h-36 border border-amber-500/30 bg-amber-500/5 rounded p-2 text-[10px] text-amber-400">
              PACK INTEGRATION & Z6 MANUAL ASSEMBLY
            </div>

            <div className="absolute right-4 top-4 w-40 h-72 border border-emerald-500/30 bg-emerald-500/5 rounded p-2 text-[10px] text-emerald-400">
              OUTBOUND PACK WAREHOUSE
            </div>

            {/* Travel Path Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <line x1="120" y1="120" x2="300" y2="120" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="300" y1="120" x2="300" y2="240" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" />
              <line x1="300" y1="240" x2="600" y2="240" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" />
            </svg>

            {/* Render Animated Dynamic Nodes */}
            {nodes.map(node => {
              const currentX = node.x + (node.targetX - node.x) * node.progress;
              const currentY = node.y + (node.targetY - node.y) * node.progress;

              const isAgv = node.type === 'AGV';
              const isForklift = node.type === 'Forklift' || node.type === 'Reach Truck';

              return (
                <div
                  key={node.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200"
                  style={{ left: `${currentX}px`, top: `${currentY}px` }}
                >
                  <div
                    className={`px-2 py-1 rounded text-[9px] font-mono font-bold flex items-center gap-1 shadow-md border ${
                      isAgv
                        ? 'bg-blue-600 text-white border-blue-400'
                        : isForklift
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-emerald-600 text-white border-emerald-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    <span>{node.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Node Status Legend / Live Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
            {nodes.slice(0, 4).map(node => (
              <div key={node.id} className="bg-[#1A1D23] p-2 rounded border border-[#2D3139] flex justify-between items-center">
                <span className="font-bold text-white">{node.label}:</span>
                <span className="text-gray-400 text-[11px] font-mono">{node.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scenario Parameter Tweaker Controls */}
        <div className="lg:col-span-4 bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-[#2D3139] pb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> Scenario Tweaker & Resource Rebalancing
          </h3>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>AGV Fleet Size (Line-Side Cell Transfer):</span>
              <span className="font-mono text-blue-400 font-bold">{agvCount} Units</span>
            </div>
            <input
              type="range"
              min="6"
              max="20"
              value={agvCount}
              onChange={e => setAgvCount(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className="text-[10px] text-gray-500 mt-0.5">Engineered baseline: 11 AGVs ($330,000 CapEx)</p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>AGV Travel Speed:</span>
              <span className="font-mono text-emerald-400 font-bold">{agvSpeed.toFixed(1)} m/s</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="2.5"
              step="0.1"
              value={agvSpeed}
              onChange={e => setAgvSpeed(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <p className="text-[10px] text-gray-500 mt-0.5">Speed limit inside cleanroom: 1.5 m/s safety cap</p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Zone Z6 Manual HV Cable Crew:</span>
              <span className="font-mono text-amber-400 font-bold">{hvCableOperators} Operators</span>
            </div>
            <input
              type="range"
              min="30"
              max="60"
              value={hvCableOperators}
              onChange={e => setHvCableOperators(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className="text-[10px] text-gray-500 mt-0.5">Largest manual attendance block (43 stations baseline)</p>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>Cell Warehouse VNA Reach Trucks:</span>
              <span className="font-mono text-purple-400 font-bold">{vnaReachTrucks} Trucks</span>
            </div>
            <input
              type="range"
              min="2"
              max="8"
              value={vnaReachTrucks}
              onChange={e => setVnaReachTrucks(parseInt(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className="text-[10px] text-gray-500 mt-0.5">Very Narrow Aisle high-bay cell retrieval</p>
          </div>

          <div className="bg-[#1A1D23] p-3 rounded border border-[#2D3139] mt-auto">
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-1">Simulation Insight</h4>
            <p className="text-[11px] text-gray-400 leading-relaxed italic">
              {agvCount < 11
                ? '⚠️ AGV count below 11 units creates supply starvation at Zone Z1 Cell Sorting!'
                : hvCableOperators < 40
                ? '⚠️ Zone Z6 HV cable routing queue time exceeds 26.57s takt threshold!'
                : '✅ Current fleet and workforce configuration maintains balanced takt time of 26.57s.'}
            </p>
          </div>
        </div>
      </div>

      {/* MHE Fleet Utilization & Direct Labor Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MHE Utilization Bar Chart */}
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Material Handling Equipment (MHE) Fleet Utilization %
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mheUtilizationData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" horizontal={false} />
                <XAxis type="number" stroke="#6B7280" fontSize={10} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={10} width={130} />
                <Tooltip contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF' }} />
                <Bar dataKey="utilization" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Direct Labor Allocation across Process Zones */}
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Direct Shift Labor Allocation Across Zones (124 Headcount Total)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={directCrewBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
                <XAxis dataKey="name" stroke="#6B7280" fontSize={9} angle={-25} textAnchor="end" />
                <YAxis stroke="#6B7280" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF' }} />
                <Bar dataKey="crew" fill="#10B981" radius={[4, 4, 0, 0]} name="Shift Direct Operators" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
