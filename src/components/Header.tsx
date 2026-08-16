import React from 'react';
import {
  Activity,
  Clock,
  Zap,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Building2,
  Layers,
  Sun,
  Moon,
  Users,
  BarChart3,
  FileText,
  Award
} from 'lucide-react';
import { SimulationState, ThemeMode } from '../types/plant';
import { RadiLogo } from './RadiLogo';
import roboticsLineImg from '../assets/images/robotics_line_header_1786912826971.jpg';

interface HeaderProps {
  simState: SimulationState;
  setSimState: React.Dispatch<React.SetStateAction<SimulationState>>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAiOptimizer: () => void;
  onOpenShiftReport?: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  simState,
  setSimState,
  activeTab,
  setActiveTab,
  onOpenAiOptimizer,
  onOpenShiftReport,
  theme,
  setTheme,
}) => {
  // Format shift time (e.g. 06:00 + seconds)
  const formatShiftTime = (seconds: number) => {
    const startHour = 6;
    const totalMinutes = Math.floor(seconds / 60);
    const hrs = startHour + Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const secs = Math.floor(seconds % 60);
    const hh = String(hrs).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const navItems = [
    { id: 'layout', label: 'Plant Floor Twin (EV & BESS)', icon: Layers },
    { id: 'throughput', label: 'Throughput & Line Takt', icon: BarChart3 },
    { id: 'machines', label: 'Machine Census (Z1-Z8 & BESS)', icon: Cpu },
    { id: 'inventory', label: 'Warehouses & 4-Day Buffer', icon: Building2 },
    { id: 'workforce', label: 'Workforce & MHE Fleet', icon: Users },
    { id: 'tariff', label: 'Tariff & Energy', icon: Zap },
    { id: 'capex', label: 'CapEx & Financial Costing', icon: ShieldAlert },
  ];

  const isDark = theme === 'dark';

  const handleOpenReport = () => {
    if (onOpenShiftReport) {
      onOpenShiftReport();
    } else {
      setSimState(prev => ({ ...prev, isShiftReportOpen: true }));
    }
  };

  return (
    <header className={`relative border-b px-4 py-2.5 overflow-hidden transition-all duration-300 ${
      isDark
        ? 'bg-[#0B0D13]/75 border-[#2D3139]/80 text-[#D1D5DB]'
        : 'bg-white/80 border-slate-200/80 text-slate-700 shadow-sm'
    }`}>
      {/* Robotics Line Background Image with Frosted Glass Morphism Overlay */}
      <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
        <img
          src={roboticsLineImg}
          alt="Automated Robotics Line"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center scale-105 transform -translate-y-2 opacity-35 dark:opacity-25 filter blur-[1.5px] transition-all duration-500"
        />
        {/* Dual Gradient & Frosted Overlay for pristine contrast and negative-space peering */}
        <div
          className={`absolute inset-0 backdrop-blur-md ${
            isDark
              ? 'bg-gradient-to-r from-[#0B0D13]/95 via-[#0F1420]/80 to-[#0B0D13]/92'
              : 'bg-gradient-to-r from-white/95 via-slate-50/85 to-white/92'
          }`}
        />
        {/* Subtle high-tech grid & glass rim reflection */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/20 dark:from-white/5 dark:to-black/40 pointer-events-none" />
      </div>

      {/* Header Foreground Content */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* Title, Official RADI Energy Systems Logo and Facility Branding */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Official RADI Energy Systems Ltd Logo with Glass Card */}
            <div className={`flex items-center justify-center px-2.5 py-1.5 rounded-xl border shrink-0 backdrop-blur-xl transition-all shadow-sm ${
              isDark
                ? 'bg-[#14171F]/85 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                : 'bg-white/90 border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
            }`}>
              <RadiLogo height={30} isDark={isDark} />
            </div>

            <div className={`hidden sm:block h-8 w-[1px] ${isDark ? 'bg-[#2D3139]/80' : 'bg-slate-300/80'}`} />

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className={`text-xs sm:text-sm font-extrabold tracking-tight uppercase truncate drop-shadow-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Radi Energy Solutions <span className="text-emerald-500">Digital Twin</span>
                </h1>
                <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded shrink-0 backdrop-blur-md ${
                  isDark
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                    : 'bg-emerald-50/90 text-emerald-700 border border-emerald-200 shadow-sm'
                }`}>
                  10 GWh
                </span>
              </div>
              <p className={`text-[10px] truncate hidden xs:block font-medium ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
                Katuugo Gigafactory • 1,183 Packs/Shift • 26.57s Takt • 4-Day Buffer
              </p>
            </div>
          </div>

          {/* Mobile Right Controls: Theme + AI */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-1.5 rounded-lg border text-xs backdrop-blur-md transition-all ${
                isDark ? 'bg-[#1A1D23]/80 border-white/10 text-amber-400' : 'bg-white/80 border-slate-300 text-slate-700 shadow-sm'
              }`}
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onOpenAiOptimizer}
              className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg shadow-sm backdrop-blur-md"
            >
              <Sparkles className="w-3 h-3 text-yellow-300" />
              <span>AI</span>
            </button>
          </div>
        </div>

        {/* Live Simulation Ticker & Controls (Horizontally scrollable on mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-[11px] font-mono shrink-0 backdrop-blur-xl transition-all shadow-sm ${
            isDark
              ? 'bg-[#121622]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
              : 'bg-white/85 border-slate-200/90 shadow-[0_2px_10px_rgba(0,0,0,0.05)]'
          }`}>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatShiftTime(simState.shiftTimeSeconds)}</span>
              <span className="text-[9px] text-gray-400">({Math.max(0, Math.floor(simState.shiftHoursRemaining * 60))}m)</span>
            </div>

            <div className={`h-3.5 w-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

            <div className="flex items-center gap-1">
              <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>EV:</span>
              <span className="text-emerald-500 font-bold">{simState.goodPacks}</span>
              <span className="text-gray-400">/{simState.targetPacks}</span>
            </div>

            <div className={`h-3.5 w-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

            <div className="flex items-center gap-1">
              <span className={isDark ? 'text-gray-400' : 'text-slate-500'}>BESS:</span>
              <span className="text-amber-500 font-bold">
                {Math.min(12, Math.floor((simState.goodPacks / Math.max(1, simState.targetPacks)) * 12))}
              </span>
              <span className="text-gray-400">/12</span>
            </div>

            <div className={`h-3.5 w-[1px] ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

            {/* Engine Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSimState(prev => ({ ...prev, isRunning: !prev.isRunning }))}
                className={`p-1 rounded-lg transition-all backdrop-blur-md ${
                  simState.isRunning
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-emerald-600/20 text-emerald-600 border border-emerald-500/40 hover:bg-emerald-600/30'
                }`}
                title={simState.isRunning ? 'Pause Simulation' : 'Run Simulation'}
              >
                {simState.isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>

              {[1, 5, 20].map(speed => (
                <button
                  key={speed}
                  onClick={() => setSimState(prev => ({ ...prev, simulationSpeed: speed }))}
                  className={`px-1.5 py-0.5 text-[9px] rounded-md font-semibold transition-all backdrop-blur-md ${
                    simState.simulationSpeed === speed
                      ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)] border border-blue-400/40'
                      : isDark
                      ? 'text-gray-300 hover:text-white bg-white/5 border border-white/5 hover:bg-white/10'
                      : 'text-slate-600 hover:text-slate-900 bg-slate-100/80 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}

              <button
                onClick={() =>
                  setSimState(prev => ({
                    ...prev,
                    shiftTimeSeconds: 0,
                    goodPacks: 0,
                    reworkedPacks: 0,
                    scrappedPacks: 0,
                    shiftHoursRemaining: prev.shiftLengthHours || 10,
                  }))
                }
                className={`p-1 rounded-lg transition-all backdrop-blur-md ${
                  isDark
                    ? 'text-gray-300 hover:text-white bg-white/5 border border-white/5 hover:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 bg-slate-100/80 border border-slate-200 hover:bg-slate-200'
                }`}
                title="Reset Shift Clock"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Desktop Right Controls: Shift Report, Light/Dark Switcher & AI Strategy */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenReport}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all backdrop-blur-xl ${
                simState.shiftCompleted
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md animate-bounce'
                  : isDark
                  ? 'bg-[#141720]/80 border-white/10 text-gray-200 hover:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                  : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
              }`}
              title="Open Shift Report"
            >
              <FileText className={`w-3.5 h-3.5 ${simState.shiftCompleted ? 'text-white' : 'text-emerald-500'}`} />
              <span>Shift Report</span>
            </button>

            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all backdrop-blur-xl ${
                isDark
                  ? 'bg-[#141720]/80 border-white/10 text-amber-400 hover:bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                  : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-600" />}
            </button>

            <button
              onClick={onOpenAiOptimizer}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.35)] border border-blue-400/40 backdrop-blur-xl transition-all transform hover:scale-[1.02]"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
              <span>AI Strategy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Frosted Glass Capsule Tabs with Smooth Horizontal Scroll */}
      <nav className={`relative z-10 flex items-center gap-1.5 mt-2.5 pt-2 border-t overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap ${
        isDark ? 'border-white/10' : 'border-slate-200/80'
      }`}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 backdrop-blur-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.45)] border border-blue-400/40 font-bold'
                  : isDark
                  ? 'text-gray-300 hover:text-white bg-black/25 border border-white/5 hover:border-white/15 hover:bg-white/10'
                  : 'text-slate-700 hover:text-slate-900 bg-white/60 border border-slate-200/80 hover:bg-white hover:border-blue-400/40 shadow-xs'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
