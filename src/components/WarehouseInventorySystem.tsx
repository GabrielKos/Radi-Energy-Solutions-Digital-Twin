import React, { useState } from 'react';
import { WarehouseInfo, SimulationState, ThemeMode } from '../types/plant';
import {
  Building2,
  Package,
  AlertTriangle,
  ShieldCheck,
  ArrowRightLeft,
  Plus,
  CheckCircle2,
  Truck,
  RefreshCw,
  Sparkles,
  Calendar,
  Layers,
  Clock,
  Send,
  Boxes,
  Compass,
  FileCheck,
  TrendingUp,
  Flame
} from 'lucide-react';

interface WarehouseInventoryProps {
  warehouses: WarehouseInfo[];
  simState: SimulationState;
  setSimState: React.Dispatch<React.SetStateAction<SimulationState>>;
  theme?: ThemeMode;
}

export const WarehouseInventorySystem: React.FC<WarehouseInventoryProps> = ({
  warehouses,
  simState,
  setSimState,
  theme = 'light',
}) => {
  const [selectedWhId, setSelectedWhId] = useState<string>('wh-outbound-packs');
  const [dispatchConvoySize, setDispatchConvoySize] = useState<number>(200);

  const [stockLogs, setStockLogs] = useState([
    { id: 'log-1', timestamp: '06:00:15', warehouse: 'Outbound Pack WH', action: '4-Day Buffer Audit', quantity: '3,543 Packs on Hand', status: 'UN38.3 Certified' },
    { id: 'log-2', timestamp: '06:18:24', warehouse: 'Inbound Cell WH', action: 'Batch Cell Intake', quantity: '+45,000 LFP Bare Cells', status: 'ISO 8 Segregated' },
    { id: 'log-3', timestamp: '06:42:10', warehouse: 'Production Material WH', action: 'AGV Line Feed to Z5', quantity: '-60 Tray Assemblies', status: 'On-Schedule' },
    { id: 'log-4', timestamp: '07:15:00', warehouse: 'Outbound Pack WH', action: 'Shift Production Inflow', quantity: `+${simState.goodPacks} Packs Added`, status: 'In Buffering Rack' },
    { id: 'log-5', timestamp: '07:45:30', warehouse: 'BESS Yard', action: 'Container Crane Docking', quantity: '+3 Racks to Cabinet #12', status: 'Grid Interconnection' },
  ]);

  const isDark = theme === 'dark';
  const activeWh = warehouses.find(w => w.id === selectedWhId) || warehouses[0];

  // Calculate 4-day buffer numbers
  const day1 = simState.day1PacksProduced || 1180;
  const day2 = simState.day2PacksProduced || 1185;
  const day3 = simState.day3PacksProduced || 1178;
  const day4 = simState.goodPacks;
  const total4DayBuffer = day1 + day2 + day3 + day4;
  const bufferDays = (total4DayBuffer / 1183).toFixed(1);

  // Trigger Convoy Dispatch
  const handleDispatchConvoy = () => {
    const timestamp = new Date().toLocaleTimeString();
    if (simState.outboundPackStockUnits < dispatchConvoySize) {
      alert('Insufficient stock for dispatch convoy.');
      return;
    }

    setSimState(prev => {
      const remaining = Math.max(0, prev.outboundPackStockUnits - dispatchConvoySize);
      return {
        ...prev,
        outboundPackStockUnits: remaining,
        nextDispatchHoursRemaining: 24.0,
      };
    });

    setStockLogs(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp,
        warehouse: 'Outbound Pack WH',
        action: `Heavy Convoy Dispatch (${dispatchConvoySize} Packs)`,
        quantity: `-${dispatchConvoySize} Finished Packs`,
        status: 'AfCFTA Customs Cleared',
      },
      ...prev,
    ]);
  };

  // Stock In / Out quick action
  const handleStockAction = (whId: string, actionType: 'receive' | 'dispatch') => {
    const timestamp = new Date().toLocaleTimeString();
    if (whId === 'wh-inbound-cells') {
      const truckQty = simState.cellsPerInboundTruck || 25000;
      if (actionType === 'receive') {
        setSimState(prev => ({
          ...prev,
          inboundCellStockUnits: Math.min(350000, prev.inboundCellStockUnits + truckQty),
        }));
        setStockLogs(prev => [
          { id: `log-${Date.now()}`, timestamp, warehouse: 'Inbound Cell WH', action: 'Scheduled Inbound Truck Inflow', quantity: `+${truckQty.toLocaleString()} Cells`, status: 'Class 9 Stored' },
          ...prev,
        ]);
      } else {
        setSimState(prev => ({
          ...prev,
          inboundCellStockUnits: Math.max(0, prev.inboundCellStockUnits - truckQty),
        }));
        setStockLogs(prev => [
          { id: `log-${Date.now()}`, timestamp, warehouse: 'Inbound Cell WH', action: 'Line-Side Sorter Feed', quantity: `-${truckQty.toLocaleString()} Cells`, status: 'AGV Train 1-3' },
          ...prev,
        ]);
      }
    } else if (whId === 'wh-outbound-packs') {
      handleDispatchConvoy();
    }
  };

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* 4-Day Buffer Strategic Focus Header for Finished Goods */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isDark ? 'bg-gradient-to-r from-[#111318] to-[#1A1D23] border-blue-900/40' : 'bg-white border-blue-100 shadow-sm'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-blue-600 text-white uppercase">
                Finished Pack Logistics
              </span>
              <span className={`text-xs font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                4-Day Holding & Staging Strategy
              </span>
            </div>
            <h2 className={`text-xl font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Finished Material Buffer & Batch Dispatch System
            </h2>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
              Non-hourly dispatch architecture: Finished packs accumulate over 4 operating days in the 10,000-pack high-bay warehouse before consolidated heavy convoy release.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4">
            <div className={`px-4 py-2 rounded-xl border text-center ${isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] uppercase font-bold text-gray-400">Buffered Inventory</div>
              <div className="text-xl font-mono font-bold text-emerald-600">{total4DayBuffer.toLocaleString()} Units</div>
              <div className="text-[10px] text-gray-400 font-mono">({bufferDays} Days of Production)</div>
            </div>

            <div className={`px-4 py-2 rounded-xl border text-center ${isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-slate-50 border-slate-200'}`}>
              <div className="text-[10px] uppercase font-bold text-gray-400">Next Scheduled Convoy</div>
              <div className="text-xl font-mono font-bold text-blue-600">{simState.nextDispatchHoursRemaining || 16.5} Hours</div>
              <div className="text-[10px] text-gray-400 font-mono">Consolidated 200 Packs</div>
            </div>

            <button
              onClick={handleDispatchConvoy}
              className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
            >
              <Truck className="w-4 h-4" />
              <span>Dispatch Batch Convoy</span>
            </button>
          </div>
        </div>

        {/* 4-Day Production Log Cards Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-[#2D3139]">
          {/* Day 1 */}
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#14171D] border-[#2D3139]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> Day 1 Production
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                100% Cleared
              </span>
            </div>
            <div className={`text-2xl font-mono font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{day1.toLocaleString()} <span className="text-xs font-normal text-gray-400">packs</span></div>
            <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
              <span>UN 38.3 Thermal Runaway QA</span>
              <span className="text-emerald-500 font-bold">Passed</span>
            </div>
          </div>

          {/* Day 2 */}
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#14171D] border-[#2D3139]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> Day 2 Production
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                100% Cleared
              </span>
            </div>
            <div className={`text-2xl font-mono font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{day2.toLocaleString()} <span className="text-xs font-normal text-gray-400">packs</span></div>
            <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
              <span>End-of-Line Cycler Discharge</span>
              <span className="text-emerald-500 font-bold">Passed</span>
            </div>
          </div>

          {/* Day 3 */}
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-[#14171D] border-[#2D3139]' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500" /> Day 3 (Yesterday)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                100% Cleared
              </span>
            </div>
            <div className={`text-2xl font-mono font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{day3.toLocaleString()} <span className="text-xs font-normal text-gray-400">packs</span></div>
            <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
              <span>Palletizing & RFID Pairing</span>
              <span className="text-emerald-500 font-bold">Passed</span>
            </div>
          </div>

          {/* Day 4 (Today Active Shift) */}
          <div className={`p-3 rounded-xl border relative overflow-hidden ${
            isDark ? 'bg-blue-950/30 border-blue-700/50' : 'bg-blue-50/70 border-blue-300'
          }`}>
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-blue-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 animate-spin" /> Day 4 (Live Shift)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white animate-pulse">
                Active Inflow
              </span>
            </div>
            <div className={`text-2xl font-mono font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {day4} <span className="text-xs font-normal text-gray-400">/ 1,183</span>
            </div>
            <div className="text-[11px] text-blue-600 mt-1 flex justify-between font-semibold">
              <span>Shift Progress:</span>
              <span>{((day4 / 1183) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {warehouses.map(wh => {
          const isSelected = wh.id === selectedWhId;
          const isCellWh = wh.id === 'wh-inbound-cells';
          const isOutboundWh = wh.id === 'wh-outbound-packs';

          const currentStockPct = isCellWh
            ? Math.round((simState.inboundCellStockUnits / 350000) * 100)
            : isOutboundWh
            ? Math.round((total4DayBuffer / 10000) * 100)
            : wh.currentStockPct;

          const isAlertLow = currentStockPct < 20;

          return (
            <div
              key={wh.id}
              onClick={() => setSelectedWhId(wh.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'ring-2 ring-blue-500 shadow-md ' + (isDark ? 'bg-[#1A1D23] border-blue-500' : 'bg-white border-blue-500')
                  : isDark
                  ? 'bg-[#111318] border-[#2D3139] hover:border-gray-500'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded">
                    {wh.type.replace('_', ' ')}
                  </span>
                  {wh.daysOfBuffer && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                      {wh.daysOfBuffer}-Day Cap
                    </span>
                  )}
                </div>

                <h3 className={`text-sm font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{wh.name}</h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  {wh.areaSqm.toLocaleString()} m² • {wh.safetyRating}
                </p>
              </div>

              <div className="my-3">
                <div className="flex justify-between items-baseline mb-1 font-mono">
                  <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{currentStockPct}%</span>
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Cap: {wh.capacityUnits.toLocaleString()}</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-black/50' : 'bg-slate-100'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isAlertLow ? 'bg-red-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, currentStockPct)}%` }}
                  />
                </div>
              </div>

              <div className={`text-[10px] font-mono flex justify-between border-t pt-2 ${isDark ? 'border-[#2D3139] text-gray-400' : 'border-slate-200 text-slate-500'}`}>
                <span>Racking: ${(wh.rackingCostUSD).toLocaleString()}</span>
                <span className="text-blue-600 font-bold">Select Warehouse</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Inspection & Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Warehouse Detail & Controls */}
        <div className={`lg:col-span-7 p-5 rounded-2xl border flex flex-col gap-4 ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-2 ${
            isDark ? 'border-[#2D3139]' : 'border-slate-200'
          }`}>
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeWh.name}</h2>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{activeWh.description}</p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStockAction(activeWh.id, 'receive')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Stock In
              </button>
              <button
                onClick={() => handleStockAction(activeWh.id, 'dispatch')}
                className={`px-3 py-1.5 border text-xs font-bold rounded-lg flex items-center gap-1 transition-colors ${
                  isDark
                    ? 'bg-[#1A1D23] border-[#2D3139] text-gray-200 hover:bg-[#252830]'
                    : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" /> Scheduled Dispatch
              </button>
            </div>
          </div>

          {/* Specs Grid */}
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl border text-xs ${
            isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">Floor Area</div>
              <div className={`font-mono font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeWh.areaSqm.toLocaleString()} m²</div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">Installed Capacity</div>
              <div className={`font-mono font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeWh.capacityUnits.toLocaleString()} units</div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">Safety Class</div>
              <div className="text-amber-500 font-mono text-[11px] font-bold mt-0.5">{activeWh.safetyRating}</div>
            </div>
            <div>
              <div className="text-gray-400 text-[10px] uppercase font-bold">Racking CapEx</div>
              <div className="text-emerald-600 font-mono font-bold mt-0.5">${(activeWh.rackingCostUSD).toLocaleString()}</div>
            </div>
          </div>

          {/* Assigned MHE Fleet list */}
          <div>
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
              Assigned Material Handling Equipment (MHE Fleet)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {activeWh.mheAssigned.map((mhe, idx) => (
                <div key={idx} className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                  isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-slate-50 border-slate-200'
                }`}>
                  <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>{mhe}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Material Flow Strategy Description */}
          <div className={`p-4 rounded-xl border text-xs mt-auto ${
            isDark ? 'bg-blue-950/20 border-blue-800/40 text-gray-300' : 'bg-blue-50/60 border-blue-200 text-slate-700'
          }`}>
            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Katuugo Layout & Material Flow Strategy
            </h4>
            <p className="leading-relaxed text-[11px]">
              {activeWh.id === 'wh-inbound-cells'
                ? 'Maintains a 30-day raw bare cell buffer (350,000 cells) to safeguard the 1,183 pack/shift line from Mombasa Port and Malaba border corridor delays. Protected under Class 9 HazMat fire wall partitions with automated FM-200 clean agent suppression.'
                : activeWh.id === 'wh-production-materials'
                ? 'Non-live components (enclosures, thermal interface pads, wiring harnesses, busbars) stored in 3,200 heavy pallet positions immediately adjacent to Pack Assembly (Z5) to constrain forklift cycle transit to < 45 meters.'
                : activeWh.id === 'wh-outbound-packs'
                ? 'Designed for 4 full operating days of buffer inventory (10,000 pack maximum capacity) with 28 automated dock levellers. Packs are batched by shipping route (Kampala, Nairobi, Dar es Salaam) for consolidated heavy freight convoys.'
                : 'Heavy-duty exterior staging pad outfitted with dual 30-tonne gantry cranes for direct staging and assembly of 40-foot megawatt utility BESS containers.'}
            </p>
          </div>
        </div>

        {/* Real-time Stock Movements Audit Log */}
        <div className={`lg:col-span-5 p-5 rounded-2xl border flex flex-col ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 mb-3 ${
            isDark ? 'border-[#2D3139]' : 'border-slate-200'
          }`}>
            <div>
              <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <RefreshCw className="w-4 h-4 text-blue-600" /> Real-time Warehouse Movement Audit
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Traceability & MES transactions across 4 warehouses</p>
            </div>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-[390px] pr-1">
            {stockLogs.map(log => (
              <div key={log.id} className={`p-3 rounded-xl border text-xs font-mono transition-colors ${
                isDark ? 'bg-[#1A1D23] border-[#2D3139]' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-blue-600 font-bold">{log.timestamp}</span>
                  <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>{log.warehouse}</span>
                </div>
                <div className={`flex justify-between font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span>{log.action}</span>
                  <span className={log.quantity.startsWith('+') ? 'text-emerald-600' : 'text-amber-500'}>
                    {log.quantity}
                  </span>
                </div>
                <div className={`text-[10px] mt-1.5 flex justify-between pt-1 border-t ${
                  isDark ? 'border-[#2D3139]/60 text-gray-400' : 'border-slate-200 text-slate-500'
                }`}>
                  <span>Status: {log.status}</span>
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <FileCheck className="w-3 h-3" /> Traceability OK
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
