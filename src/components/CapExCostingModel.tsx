import React, { useState } from 'react';
import { ThemeMode } from '../types/plant';
import { DollarSign, Building, Cpu, ShieldCheck, FileText, PieChart as PieIcon, Layers } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface CapExCostingModelProps {
  theme?: ThemeMode;
}

export const CapExCostingModel: React.FC<CapExCostingModelProps> = ({ theme = 'light' }) => {
  const isDark = theme === 'dark';
  const capExItems = [
    { code: 'B.1', category: 'Buildings & Civil Infrastructure', costUSD: 67240000, pct: 47.9, color: '#3B82F6' },
    { code: 'B.2', category: 'Process Lines & Testing Equipment', costUSD: 30089850, pct: 21.5, color: '#10B981' },
    { code: 'B.3', category: 'Plant Utilities & Substation', costUSD: 6920000, pct: 4.9, color: '#F59E0B' },
    { code: 'B.4', category: 'Land Acquisition (6.7 Ha Katuugo)', costUSD: 3800000, pct: 2.7, color: '#8B5CF6' },
    { code: 'B.5', category: 'Licensing, Permits & ISO Certification', costUSD: 2830000, pct: 2.0, color: '#EC4899' },
    { code: 'B.6', category: 'Pre-Operational Commissioning & Ramp', costUSD: 9680000, pct: 6.9, color: '#06B6D4' },
    { code: 'B.7', category: 'Contingency Allowance (10%)', costUSD: 12748000, pct: 9.1, color: '#64748B' },
    { code: 'B.8', category: 'MHE Fleet & AGV Systems', costUSD: 6922150, pct: 5.0, color: '#EF4444' },
  ];

  const totalCapExUSD = capExItems.reduce((acc, item) => acc + item.costUSD, 0); // ~$140.23M

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Top CapEx Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Total Project CapEx</div>
          <div className="text-3xl font-mono text-emerald-400 mt-1 font-bold">
            ${(totalCapExUSD / 1000000).toFixed(2)} Million
          </div>
          <div className="text-[11px] text-gray-500 mt-1">AACE Class 4 Cost Estimation Standard</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Civil & Structures</div>
          <div className="text-3xl font-mono text-blue-400 mt-1 font-bold">$67.24 Million</div>
          <div className="text-[11px] text-gray-500 mt-1">47.9% of total CapEx (26,300 m² BUA)</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Process Machinery & Fixtures</div>
          <div className="text-3xl font-mono text-amber-400 mt-1 font-bold">$30.09 Million</div>
          <div className="text-[11px] text-gray-500 mt-1">285 Machines in Z1-Z8 + MES</div>
        </div>

        <div className="bg-[#111318] border border-[#2D3139] p-4 rounded-lg">
          <div className="text-xs text-gray-400 uppercase font-bold">Contingency Reserve</div>
          <div className="text-3xl font-mono text-purple-400 mt-1 font-bold">$12.75 Million</div>
          <div className="text-[11px] text-gray-500 mt-1">10% unallocated risk buffer</div>
        </div>
      </div>

      {/* Visual CapEx Pie & Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pie Breakdown */}
        <div className="lg:col-span-5 bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
            Capital Expenditure Distribution
          </h3>
          <p className="text-xs text-gray-400 mb-4">Project cost structure across major elemental codes</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={capExItems}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="costUSD"
                >
                  {capExItems.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`$${(Number(value) / 1000000).toFixed(2)}M`, 'CapEx']}
                  contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart Breakdown */}
        <div className="lg:col-span-7 bg-[#111318] border border-[#2D3139] p-4 rounded-lg flex flex-col">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
            Elemental Cost Comparison ($ USD Millions)
          </h3>
          <p className="text-xs text-gray-400 mb-4">AACE Class 4 Cost Engineering breakdown</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capExItems} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3139" horizontal={false} />
                <XAxis type="number" stroke="#6B7280" fontSize={10} tickFormatter={v => `$${v / 1000000}M`} />
                <YAxis dataKey="code" type="category" stroke="#6B7280" fontSize={10} />
                <Tooltip
                  formatter={(value: any) => [`$${(Number(value) / 1000000).toFixed(2)}M`, 'Cost']}
                  contentStyle={{ backgroundColor: '#1A1D23', borderColor: '#2D3139', color: '#FFF' }}
                />
                <Bar dataKey="costUSD" fill="#10B981" radius={[0, 4, 4, 0]} name="Cost USD" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CapEx Breakdown Table */}
      <div className="bg-[#111318] border border-[#2D3139] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#2D3139]">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Comprehensive Project WBS CapEx Ledger
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#1A1D23] border-b border-[#2D3139] uppercase font-mono text-[10px] text-gray-400">
              <tr>
                <th className="px-4 py-3">WBS Code</th>
                <th className="px-4 py-3">Category & Scope</th>
                <th className="px-4 py-3 text-right">Cost (USD)</th>
                <th className="px-4 py-3 text-right">Cost (UGX Billions)</th>
                <th className="px-4 py-3 text-center">Share %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D3139]">
              {capExItems.map(item => (
                <tr key={item.code} className="hover:bg-[#1A1D23]/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-blue-400 font-bold">{item.code}</td>
                  <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.category}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-400">
                    ${item.costUSD.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-400">
                    UGX {((item.costUSD * 3750) / 1000000000).toFixed(2)}B
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-amber-400">
                    {((item.costUSD / totalCapExUSD) * 100).toFixed(1)}%
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
