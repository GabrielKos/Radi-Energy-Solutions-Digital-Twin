import React, { useState, useEffect, useRef } from 'react';
import { MheItem, PersonnelCategory, SimulationState, ThemeMode } from '../types/plant';
import { Truck, Activity, Users, Zap, Clock, AlertOctagon, ArrowUpRight, Play, Pause, RefreshCw, Layers, ShieldCheck, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import plantOpsBackgroundImg from '../assets/images/robotics.jpg';

/** Fixed logical size of the arena — all zone/node coordinates below are
 * authored against this space, then the camera transform pans & scales it. */
const ARENA_W = 1000;
const ARENA_H = 460;

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
  // This screen was written dark-only and was unreachable, so nobody noticed it
  // never followed the theme. Same token set as the other tabs.
  const card = isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-[#FDFCFA] border-[#E7E3DC] shadow-sm';
  const inset = isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]';
  const canvasBg = isDark ? 'bg-[#090A0D]' : 'bg-[#F1EEE8]';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-gray-400' : 'text-slate-500';
  const divider = isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]';
  const axis = isDark ? '#6B7280' : '#64748B';
  const gridStroke = isDark ? '#2D3139' : '#E2E8F0';
  // Scenario state
  const [agvCount, setAgvCount] = useState<number>(11);
  const [agvSpeed, setAgvSpeed] = useState<number>(1.2); // m/s
  const [hvCableOperators, setHvCableOperators] = useState<number>(43);
  const [vnaReachTrucks, setVnaReachTrucks] = useState<number>(4);
  const [selectedMheFilter, setSelectedMheFilter] = useState<string>('all');
  const [simulatedCongestionLevel, setSimulatedCongestionLevel] = useState<'Low' | 'Medium' | 'High'>('Low');

  // Pan & Zoom camera for the simulation arena, same interaction model as the
  // Floor Twin canvas: drag to pan, wheel to zoom, buttons for fine control.
  const [camera, setCamera] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const [isPanningArena, setIsPanningArena] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const arenaViewportRef = useRef<HTMLDivElement | null>(null);

  const handleArenaMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsPanningArena(true);
    panStartRef.current = { x: e.clientX - camera.x, y: e.clientY - camera.y };
  };
  const handleArenaMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningArena) return;
    setCamera(prev => ({ ...prev, x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y }));
  };
  const handleArenaMouseUp = () => setIsPanningArena(false);

  const handleArenaWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const viewport = arenaViewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setCamera(prev => {
      const newScale = Math.max(0.5, Math.min(3, prev.scale * zoomFactor));
      return {
        scale: newScale,
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
      };
    });
  };
  const zoomArenaBy = (factor: number) => {
    setCamera(prev => ({ ...prev, scale: Math.max(0.5, Math.min(3, prev.scale * factor)) }));
  };
  const resetArenaCamera = () => setCamera({ x: 0, y: 0, scale: 1 });

  // Simulated node positions for live canvas graphic. Every start/target pair
  // is a point that actually falls inside one of the four zone rectangles
  // drawn below (Inbound x:16-192 y:16-144, Spine x:224-512 y:16-144, Pack
  // x:224-512 y:160-304, Outbound x:824-984 y:16-304) — a node used to be
  // able to swap onto a coordinate that landed in the empty gap between
  // zones and visibly travel to nowhere. Each path now matches its status
  // text: AGVs shuttle Inbound<->Spine, the reach truck stacks in place
  // inside Inbound, forklifts run Inbound->Pack and within Outbound, and the
  // two operators do small in-station moves inside their own zone.
  const [nodes, setNodes] = useState([
    { id: 'agv-1', type: 'AGV', label: 'AGV #01', x: 170, y: 70, targetX: 250, targetY: 70, progress: 0.3, status: 'Active (Cell Tray Transfer)' },
    { id: 'agv-2', type: 'AGV', label: 'AGV #02', x: 260, y: 110, targetX: 180, targetY: 110, progress: 0.7, status: 'Return to Cell Store' },
    { id: 'agv-3', type: 'AGV', label: 'AGV #03', x: 150, y: 100, targetX: 280, targetY: 90, progress: 0.1, status: 'Active (Cell Tray Transfer)' },
    { id: 'rt-1', type: 'Reach Truck', label: 'VNA Reach Truck #01', x: 60, y: 40, targetX: 60, targetY: 130, progress: 0.5, status: 'High-Bay Stacking' },
    { id: 'fl-1', type: 'Forklift', label: 'Forklift #01', x: 150, y: 120, targetX: 300, targetY: 280, progress: 0.4, status: 'Non-Live Materials Transport' },
    { id: 'fl-2', type: 'Forklift', label: 'Forklift #02', x: 860, y: 50, targetX: 940, targetY: 260, progress: 0.8, status: 'Finished Pack Loading' },
    { id: 'op-1', type: 'Operator', label: 'Z6 Manual Tech #14', x: 400, y: 220, targetX: 440, targetY: 260, progress: 0.2, status: 'HV Cable Termination' },
    { id: 'op-2', type: 'Operator', label: 'Z1 Kitting Tech #04', x: 100, y: 90, targetX: 140, targetY: 120, progress: 0.9, status: 'Cell Tray Decant' },
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
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-transparent text-slate-800'
    }`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${card} border p-4 rounded-xl`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>MHE Active Fleet</div>
          <div className="text-3xl font-mono text-blue-400 mt-1">{47 + (agvCount - 11)} Units</div>
          <div className={`text-[11px] mt-1 ${sub}`}>11 AGVs, 4 VNA Reach, 8 Forklifts, 17 Stackers, 6 Cranes</div>
        </div>

        <div className={`${card} border p-4 rounded-xl`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Direct Line Operators</div>
          <div className="text-3xl font-mono text-emerald-400 mt-1">{124 + (hvCableOperators - 43)} Crew</div>
          <div className={`text-[11px] mt-1 ${sub}`}>109 Shift direct + 15 relief factor (1.14x)</div>
        </div>

        <div className={`${card} border p-4 rounded-xl`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Indirect Support Staff</div>
          <div className="text-3xl font-mono text-purple-400 mt-1">{indirectCrewTotal} Staff</div>
          <div className={`text-[11px] mt-1 ${sub}`}>Maintenance, Quality, Security, Logistics, Admin</div>
        </div>

        <div className={`${card} border p-4 rounded-xl`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Factory Congestion Index</div>
          <div className={`text-3xl font-mono mt-1 ${simulatedCongestionLevel === 'Low' ? 'text-green-400' : 'text-amber-400'}`}>
            {simulatedCongestionLevel}
          </div>
          <div className={`text-[11px] mt-1 ${sub}`}>Avg AGV Queue Time: 12 seconds</div>
        </div>
      </div>

      {/* Interactive Simulation Arena & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Simulation Arena Canvas */}
        <div className={`lg:col-span-8 ${card} border p-4 rounded-xl flex flex-col`}>
          <div className={`flex items-center justify-between mb-3 border-b pb-2 ${divider}`}>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${heading}`}>
                <Truck className="w-4 h-4 text-blue-400" /> Live MHE & Operator Pathing Simulation
              </h3>
              <p className={`text-xs ${sub}`}>
                Tracking AGV tray transfer cycles, forklift aisle movements, and operator manual assembly tasks.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>Active Simulation</span>
            </div>
          </div>

          {/* Visual Canvas Diagram for Movements — pan by dragging, zoom with the
              wheel or the corner controls, same interaction as the Floor Twin. */}
          <div
            ref={arenaViewportRef}
            className={`relative h-96 ${canvasBg} border ${divider} rounded-lg overflow-hidden select-none ${
              isPanningArena ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onMouseDown={handleArenaMouseDown}
            onMouseMove={handleArenaMouseMove}
            onMouseUp={handleArenaMouseUp}
            onMouseLeave={handleArenaMouseUp}
            onWheel={handleArenaWheel}
          >
            {/* Plant Campus Background — fixed behind the pannable diagram so
                the digital twin reads over the real facility, not a flat fill. */}
            <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
              <img
                src={plantOpsBackgroundImg}
                alt="Battery Pack Robotics Line"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center opacity-20 dark:opacity-12 blur-[3px] scale-105"
              />
              {/* Near-opaque frosted pane — just a hint of the photo, not a
                  competing visual against the diagram. */}
              <div className={`absolute inset-0 backdrop-blur-[3px] ${isDark ? 'bg-[#090A0D]/90' : 'bg-[#F1EEE8]/86'}`} />
            </div>

            {/* Camera-transformed diagram layer */}
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: ARENA_W,
                height: ARENA_H,
                transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
              }}
            >
              {/* Background Factory Zones */}
              <div className="absolute left-4 top-4 w-44 h-32 border border-blue-500/30 bg-blue-500/10 rounded p-2 text-[10px] text-blue-400">
                INBOUND CELL STORE (350k Cells)
              </div>

              <div className="absolute left-56 top-4 w-72 h-32 border border-green-500/30 bg-green-500/10 rounded p-2 text-[10px] text-green-400">
                MAIN PRODUCTION SPINE (Z1 - Z4)
              </div>

              <div className="absolute left-56 top-40 w-72 h-36 border border-amber-500/30 bg-amber-500/10 rounded p-2 text-[10px] text-amber-400">
                PACK INTEGRATION & Z6 MANUAL ASSEMBLY
              </div>

              <div className="absolute right-4 top-4 w-40 h-72 border border-emerald-500/30 bg-emerald-500/10 rounded p-2 text-[10px] text-emerald-400">
                OUTBOUND PACK WAREHOUSE
              </div>

              {/* Travel Path Lines — each segment now actually connects two
                  zones (Inbound->Spine, Spine->Pack, Pack->Outbound) instead
                  of floating between arbitrary points. */}
              <svg className="absolute inset-0 pointer-events-none" width={ARENA_W} height={ARENA_H}>
                <line x1="192" y1="80" x2="224" y2="80" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="368" y1="144" x2="368" y2="160" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="512" y1="220" x2="824" y2="160" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" />
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

            {/* Zoom & Pan Controls */}
            <div className={`absolute bottom-3 right-3 z-10 flex flex-col gap-1 p-1.5 rounded-lg border backdrop-blur-md ${
              isDark ? 'bg-[#111318]/85 border-[#2D3139] text-gray-300' : 'bg-white/85 border-slate-200 text-slate-700 shadow-sm'
            }`}>
              <button
                onClick={() => zoomArenaBy(1.2)}
                title="Zoom In"
                className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => zoomArenaBy(0.8)}
                title="Zoom Out"
                className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={resetArenaCamera}
                title="Reset View"
                className={`p-1.5 rounded-md transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Node Status Legend / Live Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
            {nodes.slice(0, 4).map(node => (
              <div key={node.id} className={`${inset} border p-2 rounded flex justify-between items-center`}>
                <span className={`font-bold ${heading}`}>{node.label}:</span>
                <span className={`text-[11px] font-mono ${sub}`}>{node.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scenario Parameter Tweaker Controls */}
        <div className={`lg:col-span-4 ${card} border p-4 rounded-xl flex flex-col gap-4`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider border-b pb-2 flex items-center gap-2 ${heading} ${divider}`}>
            <Users className="w-4 h-4 text-emerald-400" /> Scenario Tweaker & Resource Rebalancing
          </h3>

          <div>
            <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              <span>AGV Fleet Size (Line-Side Cell Transfer):</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{agvCount} Units</span>
            </div>
            <input
              type="range"
              min="6"
              max="20"
              value={agvCount}
              onChange={e => setAgvCount(parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <p className={`text-[10px] mt-0.5 ${sub}`}>Engineered baseline: 11 AGVs ($330,000 CapEx)</p>
          </div>

          <div>
            <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              <span>AGV Travel Speed:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{agvSpeed.toFixed(1)} m/s</span>
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
            <p className={`text-[10px] mt-0.5 ${sub}`}>Speed limit inside cleanroom: 1.5 m/s safety cap</p>
          </div>

          <div>
            <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              <span>Zone Z6 Manual HV Cable Crew:</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{hvCableOperators} Operators</span>
            </div>
            <input
              type="range"
              min="30"
              max="60"
              value={hvCableOperators}
              onChange={e => setHvCableOperators(parseInt(e.target.value))}
              className="w-full accent-amber-500"
            />
            <p className={`text-[10px] mt-0.5 ${sub}`}>Largest manual attendance block (43 stations baseline)</p>
          </div>

          <div>
            <div className={`flex justify-between text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              <span>Cell Warehouse VNA Reach Trucks:</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{vnaReachTrucks} Trucks</span>
            </div>
            <input
              type="range"
              min="2"
              max="8"
              value={vnaReachTrucks}
              onChange={e => setVnaReachTrucks(parseInt(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className={`text-[10px] mt-0.5 ${sub}`}>Very Narrow Aisle high-bay cell retrieval</p>
          </div>

          <div className={`${inset} border p-3 rounded-lg mt-auto`}>
            <h4 className="text-xs font-bold text-blue-400 uppercase mb-1">Simulation Insight</h4>
            <p className={`text-[11px] leading-relaxed italic ${sub}`}>
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
        <div className={`${card} border p-4 rounded-xl`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${heading}`}>
            Material Handling Equipment (MHE) Fleet Utilization %
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mheUtilizationData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" stroke={axis} fontSize={10} domain={[0, 100]} />
                <YAxis dataKey="name" type="category" stroke={axis} fontSize={10} width={130} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A', fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="utilization" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Direct Labor Allocation across Process Zones */}
        <div className={`${card} border p-4 rounded-xl`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${heading}`}>
            Direct Shift Labor Allocation Across Zones (124 Headcount Total)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={directCrewBreakdown} margin={{ top: 5, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" stroke={axis} fontSize={9} angle={-25} textAnchor="end" />
                <YAxis stroke={axis} fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A', fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="crew" fill="#10B981" radius={[4, 4, 0, 0]} name="Shift Direct Operators" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
