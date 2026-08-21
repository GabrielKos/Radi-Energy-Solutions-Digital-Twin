import React from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  TrendingUp,
  Download,
  RotateCcw,
  X,
  Building2,
  Boxes,
  Award,
  Layers,
  Sparkles,
  ShieldCheck,
  Truck,
  Printer,
  ChevronRight,
  BatteryCharging
} from 'lucide-react';
import { SimulationState, ThemeMode } from '../types/plant';

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  simState: SimulationState;
  setSimState: React.Dispatch<React.SetStateAction<SimulationState>>;
  theme?: ThemeMode;
  onStartNextShift: () => void;
}

export const ShiftReportModal: React.FC<ShiftReportModalProps> = ({
  isOpen,
  onClose,
  simState,
  setSimState,
  theme = 'light',
  onStartNextShift,
}) => {
  if (!isOpen) return null;

  const isDark = theme === 'dark';

  // Key Calculations
  const targetPacks = simState.targetPacks || 1183;
  const goodPacks = simState.goodPacks;
  const targetPct = ((goodPacks / Math.max(1, targetPacks)) * 100).toFixed(1);
  const yieldPct = ((goodPacks / Math.max(1, simState.processedPacks || goodPacks)) * 100).toFixed(1);
  const cellsConsumed = goodPacks * (simState.cellsPerPackBom || 108);
  const energyKwh = Math.round(simState.activePowerDrawKw * (simState.shiftLengthHours || 10));
  const energyCostUSD = Math.round(energyKwh * simState.currentTariffUSD);

  const packsPerBess = simState.packsPerBessContainer || 24;
  const bessTarget = 12;
  const bessCabinets = Math.min(bessTarget, Math.floor((goodPacks / Math.max(1, targetPacks)) * bessTarget));
  const bessContainers = Math.max(1, Math.floor(bessCabinets / 4));
  const bessRacks = bessCabinets;

  // Print or Export Action
  const handleExportCSV = () => {
    const csvContent = `Shift Report - Radi Energy Solutions Plant Digital Twin
Date,${new Date().toISOString().split('T')[0]}
Shift Duration,${simState.shiftLengthHours} Hours (Complete)
Target Packs,${targetPacks}
Good Finished Packs,${goodPacks}
Scrapped Packs,${simState.scrappedPacks}
Reworked Packs,${simState.reworkedPacks}
Yield (FPY),${yieldPct}%
Line OEE,${(simState.currentOeePct * 100).toFixed(1)}%
BESS Storage Cabinets Built,${bessCabinets} / 12 (${bessContainers} Mega-Containers)
Bare Cells Consumed,${cellsConsumed}
Total Energy Consumed,${energyKwh} kWh
Energy Cost,USD $${energyCostUSD}
Finished Goods 4-Day Buffer,${simState.outboundPackStockUnits} Packs
UN38.3 & IEC 62619 QA,PASSED 100%
AfCFTA Export Clearance,APPROVED
`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Radi_Energy_Solutions_Shift_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className={`relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all ${
        isDark ? 'bg-[#111318] border-[#2D3139] text-[#D1D5DB]' : 'bg-[#FDFCFA] border-[#E7E3DC] text-slate-800'
      }`}>
        {/* Header Ribbon */}
        <div className={`p-5 border-b flex items-start justify-between ${
          isDark ? 'bg-[#161920] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white">
                  Shift Completed
                </span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {simState.shiftLengthHours}.0 Operating Hours Concluded
                </span>
              </div>
              <h2 className={`text-lg font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Official Shift Performance & QA Handover Report
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Radi Energy Solutions 10 GWh EV & BESS Assembly Plant • Katuugo Nakasongola • Shift 1 (06:00 – 16:00 EAT)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-200 hover:bg-[#252830]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
              title="Download CSV Audit"
            >
              <Download className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg text-gray-400 hover:text-white transition-colors ${
                isDark ? 'hover:bg-[#2D3139]' : 'hover:bg-slate-100'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Executive Summary Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Target vs Actual */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              isDark ? 'bg-[#181B22] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
            }`}>
              <div className="text-[10px] uppercase font-bold text-gray-400">Total Pack Output</div>
              <div className={`text-2xl font-mono font-bold mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {goodPacks.toLocaleString()} <span className="text-xs font-normal text-gray-400">/ {targetPacks}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-[#2D3139]">
                <span className="text-[11px] text-gray-400">Target Met:</span>
                <span className={`font-mono font-bold ${parseFloat(targetPct) >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {targetPct}%
                </span>
              </div>
            </div>

            {/* First Pass Yield */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              isDark ? 'bg-[#181B22] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
            }`}>
              <div className="text-[10px] uppercase font-bold text-gray-400">First Pass Yield (FPY)</div>
              <div className="text-2xl font-mono font-bold mt-1 text-emerald-600">
                {yieldPct}%
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-[#2D3139]">
                <span className="text-[11px] text-gray-400">Target Standard:</span>
                <span className="font-mono font-bold text-emerald-600">≥ 97.0%</span>
              </div>
            </div>

            {/* Overall Equipment Effectiveness */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              isDark ? 'bg-[#181B22] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
            }`}>
              <div className="text-[10px] uppercase font-bold text-gray-400">Line OEE</div>
              <div className="text-2xl font-mono font-bold mt-1 text-blue-600">
                {(simState.currentOeePct * 100).toFixed(1)}%
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-[#2D3139]">
                <span className="text-[11px] text-gray-400">Benchmark:</span>
                <span className="font-mono font-bold text-blue-600">World-Class</span>
              </div>
            </div>

            {/* BESS Utility Units */}
            <div className={`p-4 rounded-xl border flex flex-col justify-between ${
              isDark ? 'bg-[#181B22] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
            }`}>
              <div className="text-[10px] uppercase font-bold text-gray-400">BESS Containers Built</div>
              <div className="text-2xl font-mono font-bold mt-1 text-amber-500">
                {bessContainers} <span className="text-xs font-normal text-gray-400">Containers</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-[#2D3139]">
                <span className="text-[11px] text-gray-400">Racks Installed:</span>
                <span className="font-mono font-bold text-amber-500">{bessRacks} Racks ({packsPerBess}/cont)</span>
              </div>
            </div>
          </div>

          {/* Detailed Performance Breakdown in 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* QA & Line Yield Gate Details */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#161920] border-[#2D3139]' : 'bg-[#FDFCFA] border-[#E7E3DC] shadow-sm'
            }`}>
              <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-[#2D3139]">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-emerald-600">
                  <ShieldCheck className="w-4 h-4" /> Quality Gate Audits & Testing
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 rounded">
                  100% Passed
                </span>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Units Processed:</span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{(simState.processedPacks || goodPacks).toLocaleString()} Units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Prime Good Pack Yield:</span>
                  <span className="font-bold text-emerald-600">{goodPacks.toLocaleString()} Packs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Reworked & Retested:</span>
                  <span className="font-bold text-amber-500">{simState.reworkedPacks} Packs (0.5%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Scrapped / Diverted to Recycling:</span>
                  <span className="font-bold text-rose-500">{simState.scrappedPacks} Packs (0.2%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Laser Weld Pool Integrity (Cpk):</span>
                  <span className="font-bold text-emerald-600">1.67 (Zero Defect)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">EOL High-Bay UN 38.3 Cycler QA:</span>
                  <span className="font-bold text-emerald-600">46/46 Channels Clear</span>
                </div>
              </div>
            </div>

            {/* Warehouse, Inventory & Logistics Handover */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#161920] border-[#2D3139]' : 'bg-[#FDFCFA] border-[#E7E3DC] shadow-sm'
            }`}>
              <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-[#2D3139]">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-blue-600">
                  <Building2 className="w-4 h-4" /> 4-Day Buffer & Material Flow
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 rounded">
                  Stock Verified
                </span>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bare Cells Consumed from WH-1:</span>
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cellsConsumed.toLocaleString()} Bare Cells</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Inbound Cell Inventory Remaining:</span>
                  <span className="font-bold text-emerald-600">{simState.inboundCellStockUnits.toLocaleString()} Cells</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">WH-2 Staged 4-Day Buffer Total:</span>
                  <span className="font-bold text-blue-600">{simState.outboundPackStockUnits.toLocaleString()} Packs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Buffer Runway Duration:</span>
                  <span className="font-bold text-emerald-600">{(simState.outboundPackStockUnits / 1183).toFixed(1)} Operating Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">AfCFTA Export Batch Certificate:</span>
                  <span className="font-bold text-emerald-600">Digital Battery Passport Logged</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Next Heavy Convoy Dispatch:</span>
                  <span className="font-bold text-purple-500">Scheduled in 16.5 Hours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Energy, Tariff & Financial Costing Summary */}
          <div className={`p-4 rounded-xl border ${
            isDark ? 'bg-gradient-to-r from-blue-950/20 to-purple-950/20 border-blue-900/40' : 'bg-blue-50/50 border-blue-100'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Shift Energy & Operating Cost Allocation
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono">
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Active Power Peak</span>
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{simState.activePowerDrawKw.toLocaleString()} kW</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Total Energy Usage</span>
                <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{energyKwh.toLocaleString()} kWh</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Applied Grid Tariff</span>
                <span className="font-bold text-emerald-600">${simState.currentTariffUSD} / kWh</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase block">Shift Energy Total</span>
                <span className="font-bold text-emerald-600">${energyCostUSD.toLocaleString()} USD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDark ? 'bg-[#161920] border-[#2D3139]' : 'bg-[#F6F5F2] border-[#E7E3DC]'
        }`}>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Shift handover approved by MES & Line Lead Supervisor.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl border text-xs font-bold transition-colors ${
                isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-300 hover:bg-[#252830]' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Keep Paused
            </button>

            <button
              onClick={onStartNextShift}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-all transform hover:scale-[1.02]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Start Next Shift (Shift 2)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
