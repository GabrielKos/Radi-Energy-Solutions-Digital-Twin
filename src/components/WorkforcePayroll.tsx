import React, { useState } from 'react';
import { PersonnelCategory, ThemeMode } from '../types/plant';
import { Users, DollarSign, Building, ShieldCheck, HeartPulse, Award, Briefcase } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface WorkforcePayrollProps {
  personnelList: PersonnelCategory[];
  theme?: ThemeMode;
}

export const WorkforcePayroll: React.FC<WorkforcePayrollProps> = ({ personnelList, theme = 'light' }) => {
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const isDark = theme === 'dark';

  const exchangeRateUgx = 3750; // UGX per USD

  // Direct and indirect headcount
  const directCrewTotal = personnelList
    .filter(p => p.classification === 'Direct')
    .reduce((acc, p) => acc + p.shiftCrew, 0); // ~109 shift direct

  const directWithRelief = Math.round(directCrewTotal * 1.14); // 124 total direct

  const indirectCrewTotal = personnelList
    .filter(p => p.classification === 'Indirect')
    .reduce((acc, p) => acc + p.shiftCrew, 0); // 189 indirect

  const totalHeadcount = directWithRelief + indirectCrewTotal; // 313 total

  const totalAnnualPayrollUSD = personnelList.reduce((acc, p) => acc + p.annualPayrollUSD, 0);
  const totalMonthlyPayrollUSD = totalAnnualPayrollUSD / 12;
  const totalMonthlyPayrollUGX = totalMonthlyPayrollUSD * exchangeRateUgx;

  const filteredPersonnel = personnelList.filter(p => {
    if (selectedClassification === 'all') return true;
    return p.classification.toLowerCase() === selectedClassification.toLowerCase();
  });

  const classificationPieData = [
    { name: 'Direct Operations (124 Crew)', value: directWithRelief, color: '#10B981' },
    { name: 'Indirect Support (189 Staff)', value: indirectCrewTotal, color: '#3B82F6' },
  ];

  const wageRangeData = personnelList.slice(0, 10).map(p => ({
    name: p.zoneOrFunction.length > 20 ? p.zoneOrFunction.substring(0, 18) + '...' : p.zoneOrFunction,
    monthlySalaryUSD: p.monthlySalaryUSD,
    crew: p.shiftCrew,
  }));

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-[#0F1115] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold">Total Plant Workforce</div>
          <div className="text-2xl lg:text-3xl font-mono text-emerald-500 mt-1 font-bold">313 Headcount</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>124 Direct Line + 189 Indirect Support</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold">Total Monthly Payroll (USD)</div>
          <div className="text-2xl lg:text-3xl font-mono text-blue-500 mt-1 font-bold">
            ${Math.round(totalMonthlyPayrollUSD).toLocaleString()} / mo
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>${Math.round(totalAnnualPayrollUSD).toLocaleString()} Annual Payroll</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold">Total Monthly Payroll (UGX)</div>
          <div className="text-2xl lg:text-3xl font-mono text-amber-500 mt-1 font-bold">
            UGX {(totalMonthlyPayrollUGX / 1000000).toFixed(1)}M / mo
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Exchange rate: 3,750 UGX / USD</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="text-xs text-gray-400 uppercase font-bold">Workforce Housing Provision</div>
          <div className="text-2xl lg:text-3xl font-mono text-purple-500 mt-1 font-bold">400 Places</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>On-site residential block ($2.36M CapEx)</div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Classification Breakdown Donut */}
        <div className={`lg:col-span-5 p-4 rounded-xl border flex flex-col transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Workforce Classification (313 Total Staff)
          </h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Direct manufacturing operators vs indirect logistics and engineering</p>
          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classificationPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {classificationPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className={`flex justify-center gap-6 text-xs font-mono border-t pt-3 ${isDark ? 'border-[#2D3139]' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>Direct (124)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>Indirect (189)</span>
            </div>
          </div>
        </div>

        {/* Monthly Salary Bands Chart */}
        <div className={`lg:col-span-7 p-4 rounded-xl border flex flex-col transition-all ${
          isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Monthly Base Salary Bands by Department (USD)
          </h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Benchmark salary structure across technical roles</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wageRangeData} margin={{ top: 5, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2D3139' : '#E2E8F0'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#6B7280' : '#94A3B8'} fontSize={9} angle={-25} textAnchor="end" />
                <YAxis stroke={isDark ? '#6B7280' : '#94A3B8'} fontSize={10} domain={[0, 2500]} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A' }} />
                <Bar dataKey="monthlySalaryUSD" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Monthly Base Salary ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Workforce Table */}
      <div className={`rounded-xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#111318] border-[#2D3139]' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className={`p-4 border-b flex flex-wrap justify-between items-center gap-3 ${
          isDark ? 'border-[#2D3139]' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Detailed Human Resource & Payroll Registry
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedClassification('all')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                selectedClassification === 'all'
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'bg-[#1A1D23] text-gray-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Roles
            </button>
            <button
              onClick={() => setSelectedClassification('direct')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                selectedClassification === 'direct'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'bg-[#1A1D23] text-gray-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setSelectedClassification('indirect')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                selectedClassification === 'indirect'
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'bg-[#1A1D23] text-gray-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Indirect
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
            <thead className={`border-b uppercase font-mono text-[10px] ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-400' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}>
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Department / Function</th>
                <th className="px-4 py-3">Attendance & Staffing Basis</th>
                <th className="px-4 py-3 text-center">Class</th>
                <th className="px-4 py-3 text-center">Shift Crew</th>
                <th className="px-4 py-3 text-right">Monthly Base (USD)</th>
                <th className="px-4 py-3 text-right">Monthly Base (UGX)</th>
                <th className="px-4 py-3 text-right">Annual Payroll</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#2D3139]' : 'divide-slate-200'}`}>
              {filteredPersonnel.map(p => {
                return (
                  <tr key={p.ref} className={`transition-colors ${isDark ? 'hover:bg-[#1A1D23]/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3 font-mono text-blue-600 font-bold">{p.ref}</td>
                    <td className={`px-4 py-3 font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{p.zoneOrFunction}</td>
                    <td className={`px-4 py-3 text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{p.basis}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.classification === 'Direct'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/40'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300 dark:border-blue-700/40'
                        }`}
                      >
                        {p.classification}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-amber-500">{p.shiftCrew}</td>
                    <td className={`px-4 py-3 text-right font-mono ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
                      ${p.monthlySalaryUSD.toLocaleString()}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      {(p.monthlySalaryUSD * exchangeRateUgx).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                      ${p.annualPayrollUSD.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
