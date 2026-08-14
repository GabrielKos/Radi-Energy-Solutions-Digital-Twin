import React, { useState } from 'react';
import { ThemeMode } from '../types/plant';
import { Zap, Sun, Moon, Clock, DollarSign, ShieldAlert, Cpu, Award } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TariffEnergyOptimizationProps {
  theme?: ThemeMode;
}

export const TariffEnergyOptimization: React.FC<TariffEnergyOptimizationProps> = ({ theme = 'light' }) => {
  const [useOffPeakShift, setUseOffPeakShift] = useState<boolean>(true);
  const isDark = theme === 'dark';

  // Hourly tariff profile (UGX & USD conversion)
  // Peak hours: 18:00 - 22:00 ($0.092/kWh)
  // Shoulder hours: 06:00 - 18:00 ($0.055/kWh)
  // Off-Peak hours: 22:00 - 06:00 ($0.038/kWh)
  const hourlyEnergyData = Array.from({ length: 24 }, (_, i) => {
    const hourStr = `${i.toString().padStart(2, '0')}:00`;
    let tariffUSD = 0.055;
    let period = 'Shoulder';

    if (i >= 18 && i < 22) {
      tariffUSD = 0.092;
      period = 'Peak';
    } else if (i >= 22 || i < 6) {
      tariffUSD = 0.038;
      period = 'Off-Peak';
    }

    // Base plant load 2.8 MW during operating shift, cyclers shifted to off-peak if toggle is true
    const isMainShift = i >= 6 && i < 16;
    const baseLoadKw = isMainShift ? 3800 : 800;
    const cyclerLoadKw = useOffPeakShift
      ? (i >= 22 || i < 6 ? 1800 : 200)
      : (isMainShift ? 1200 : 200);

    const totalKw = baseLoadKw + cyclerLoadKw;
    const hourlyCostUSD = totalKw * tariffUSD;

    return {
      hour: hourStr,
      loadKw: totalKw,
      tariffUSD,
      period,
      hourlyCostUSD,
    };
  });

  const dailyCostUSD = hourlyEnergyData.reduce((acc, h) => acc + h.hourlyCostUSD, 0);
  const annualCostUSD = dailyCostUSD * 300; // 300 operating days

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Connected Plant Load</div>
          <div className="text-3xl font-mono text-amber-400 mt-1 font-bold">6,500 kW</div>
          <div className="text-[11px] text-gray-500 mt-1">Dedicated 33kV / 11kV Substation (6,300 kVA)</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Annual Energy Consumption</div>
          <div className="text-3xl font-mono text-blue-400 mt-1 font-bold">10,140 MWh</div>
          <div className="text-[11px] text-gray-500 mt-1">Includes 46 Battery Ageing Cyclers & HVAC</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Average Base Tariff (ERA)</div>
          <div className="text-3xl font-mono text-green-400 mt-1 font-bold">$0.055 / kWh</div>
          <div className="text-[11px] text-gray-500 mt-1">Extra-Large Industrial Tariff (Uganda ERA)</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Estimated Annual Power Bill</div>
          <div className="text-3xl font-mono text-purple-400 mt-1 font-bold">
            ${Math.round(annualCostUSD).toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {useOffPeakShift ? '⚡ Off-Peak Cycler Schedule Active (-14% cost)' : 'Standard Schedule'}
          </div>
        </div>
      </div>

      {/* Main Tariff Schedule & Load Profile Chart */}
      <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#2D3139] pb-3 mb-4 gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> 24-Hour Power Load & Tariff Rate Curve
            </h3>
            <p className="text-xs text-gray-400">
              Uganda Electricity Regulatory Authority (ERA) Extra-Large Industrial Time-of-Use Schedule
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-300">Off-Peak Cycler Load Shifting:</span>
            <button
              onClick={() => setUseOffPeakShift(!useOffPeakShift)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                useOffPeakShift
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-[#1A1D23] text-gray-400 border border-[#2D3139]'
              }`}
            >
              {useOffPeakShift ? 'ENABLED (22:00 - 06:00)' : 'DISABLED'}
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyEnergyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" vertical={false} />
              <XAxis dataKey="hour" stroke="#6B7280" fontSize={10} />
              <YAxis yAxisId="left" stroke="#6B7280" fontSize={10} domain={[0, 6000]} />
              <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={10} domain={[0, 0.12]} />
              <Tooltip contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF' }} />
              <Bar yAxisId="left" dataKey="loadKw" name="Power Demand (kW)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="stepAfter" dataKey="tariffUSD" name="Tariff ($/kWh)" stroke="#10B981" strokeWidth={2} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-3 border-t border-[#2D3139] text-xs font-mono">
          <div className="bg-[#1A1D23] p-3 rounded border border-[#2D3139]">
            <div className="text-gray-400 font-sans">Off-Peak (22:00 - 06:00)</div>
            <div className="text-emerald-400 font-bold text-lg mt-0.5">$0.038 / kWh</div>
            <div className="text-[10px] text-gray-500 mt-1">Ideal for 46 Battery Ageing Cyclers & Rigs</div>
          </div>
          <div className="bg-[#1A1D23] p-3 rounded border border-[#2D3139]">
            <div className="text-gray-400 font-sans">Shoulder (06:00 - 18:00)</div>
            <div className="text-blue-400 font-bold text-lg mt-0.5">$0.055 / kWh</div>
            <div className="text-[10px] text-gray-500 mt-1">Standard 10-Hour Shift Production Window</div>
          </div>
          <div className="bg-[#1A1D23] p-3 rounded border border-[#2D3139]">
            <div className="text-gray-400 font-sans">Peak (18:00 - 22:00)</div>
            <div className="text-red-400 font-bold text-lg mt-0.5">$0.092 / kWh</div>
            <div className="text-[10px] text-gray-500 mt-1">Avoid heavy machining or laser busbar welding</div>
          </div>
        </div>
      </div>
    </div>
  );
};
