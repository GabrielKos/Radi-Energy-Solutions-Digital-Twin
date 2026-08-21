import React, { useState } from 'react';
import { PersonnelCategory, ThemeMode } from '../types/plant';
import { Users, DollarSign, Building, ShieldCheck, HeartPulse, Award, Briefcase, Plus, Search } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CrudSlideOver, CrudField } from './common/CrudSlideOver';
import { ConfirmDialog } from './common/ConfirmDialog';
import { RowActions } from './common/RowActions';

interface WorkforcePayrollProps {
  personnelList: PersonnelCategory[];
  theme?: ThemeMode;
  onAddWorkforce: (row: Omit<PersonnelCategory, 'id'>) => Promise<void>;
  onUpdateWorkforce: (id: string, patch: Partial<PersonnelCategory>) => Promise<void>;
  onDeleteWorkforce: (id: string) => Promise<void>;
}

const CLASSIFICATION_OPTIONS: CrudField['options'] = [
  { value: 'Direct', label: 'Direct' },
  { value: 'Indirect', label: 'Indirect' },
];

const emptyWorkforceForm = () => ({
  ref: '',
  zoneOrFunction: '',
  basis: '',
  machineUnits: 0,
  attendedUnits: 0,
  shiftCrew: 1,
  classification: 'Direct',
  monthlySalaryUSD: 0,
  annualPayrollUSD: 0,
});

export const WorkforcePayroll: React.FC<WorkforcePayrollProps> = ({
  personnelList,
  theme = 'light',
  onAddWorkforce,
  onUpdateWorkforce,
  onDeleteWorkforce,
}) => {
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const isDark = theme === 'dark';

  // --- CRUD panel state ---
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setFormError(null);
    setFormValues(emptyWorkforceForm());
  };

  const openEdit = (p: PersonnelCategory) => {
    setFormMode('edit');
    setEditingId(p.id);
    setFormError(null);
    setFormValues({
      ref: p.ref,
      zoneOrFunction: p.zoneOrFunction,
      basis: p.basis,
      machineUnits: p.machineUnits,
      attendedUnits: p.attendedUnits,
      shiftCrew: p.shiftCrew,
      classification: p.classification,
      monthlySalaryUSD: p.monthlySalaryUSD,
      annualPayrollUSD: p.annualPayrollUSD,
    });
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setFormError(null);
  };

  const handleSave = async () => {
    setBusy(true);
    setFormError(null);
    try {
      if (formMode === 'add') {
        await onAddWorkforce(formValues as any);
      } else if (formMode === 'edit' && editingId) {
        await onUpdateWorkforce(editingId, formValues);
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not save this role. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDeleteWorkforce(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // leave dialog open on failure
    } finally {
      setBusy(false);
    }
  };

  // annualPayrollUSD is NOT derived from monthlySalaryUSD/shiftCrew in this
  // dataset (verified against the original seed values — no consistent
  // multiplier fits every row), so it stays its own directly editable field
  // rather than a guessed formula.
  const workforceFields: CrudField[] = [
    { key: 'ref', label: 'Reference Code', type: 'text', required: true },
    { key: 'zoneOrFunction', label: 'Department / Function', type: 'text', required: true },
    { key: 'basis', label: 'Attendance & Staffing Basis', type: 'textarea' },
    { key: 'classification', label: 'Classification', type: 'select', options: CLASSIFICATION_OPTIONS, required: true },
    { key: 'shiftCrew', label: 'Shift Crew', type: 'number', suffix: 'people', min: 0, integer: true, required: true },
    { key: 'machineUnits', label: 'Machine Units', type: 'number', min: 0, integer: true },
    { key: 'attendedUnits', label: 'Attended Units', type: 'number', min: 0, integer: true },
    { key: 'monthlySalaryUSD', label: 'Monthly Base Salary', type: 'number', suffix: 'USD', min: 0, required: true },
    {
      key: 'annualPayrollUSD',
      label: 'Annual Payroll',
      type: 'number',
      suffix: 'USD',
      min: 0,
      required: true,
      helpText: 'Stored directly — not auto-multiplied from monthly salary, so update both if the role changes.',
      // Not enforced, only flagged: the seed data genuinely has rows where no
      // single multiplier fits, so this is a sanity nudge rather than a rule.
      validate: (value, all) => {
        const monthly = Number(all.monthlySalaryUSD) || 0;
        const crew = Number(all.shiftCrew) || 0;
        const expected = monthly * 12 * crew;
        if (!expected || !Number(value)) return null;
        const ratio = Number(value) / expected;
        return ratio > 3 || ratio < 0.33
          ? `Looks off: monthly x 12 x crew is about $${Math.round(expected).toLocaleString()}. Override if that is intended.`
          : null;
      },
    },
  ];

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
    const matchesClass =
      selectedClassification === 'all' ||
      p.classification.toLowerCase() === selectedClassification.toLowerCase();
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.ref.toLowerCase().includes(q) ||
      p.zoneOrFunction.toLowerCase().includes(q) ||
      p.basis.toLowerCase().includes(q);
    return matchesClass && matchesSearch;
  });

  const classificationPieData = [
    { name: `Direct Operations (${directWithRelief} Crew)`, value: directWithRelief, color: '#10B981' },
    { name: `Indirect Support (${indirectCrewTotal} Staff)`, value: indirectCrewTotal, color: '#3B82F6' },
  ];

  // Was `.slice(0, 10)` with no indication that anything had been dropped, and a
  // hardcoded 0-2500 Y domain that silently clipped any salary above it. Now it
  // takes the top earners explicitly, says so in the subtitle, and scales.
  const WAGE_CHART_LIMIT = 10;
  const wageSorted = [...personnelList].sort((a, b) => b.monthlySalaryUSD - a.monthlySalaryUSD);
  const wageRangeData = wageSorted.slice(0, WAGE_CHART_LIMIT).map(p => ({
    name: p.zoneOrFunction.length > 20 ? p.zoneOrFunction.substring(0, 18) + '…' : p.zoneOrFunction,
    monthlySalaryUSD: p.monthlySalaryUSD,
    crew: p.shiftCrew,
  }));
  const wageHidden = Math.max(0, personnelList.length - WAGE_CHART_LIMIT);
  const wageMax = Math.max(500, ...wageRangeData.map(w => w.monthlySalaryUSD));

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-transparent text-[#D1D5DB]' : 'bg-transparent text-slate-800'
    }`}>
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Plant Workforce</div>
          <div className="text-2xl lg:text-3xl font-mono text-emerald-600 dark:text-emerald-500 mt-1 font-bold">
            {totalHeadcount} Headcount
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            {directWithRelief} Direct Line (incl. 14% relief) + {indirectCrewTotal} Indirect Support
          </div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Monthly Payroll (USD)</div>
          <div className="text-2xl lg:text-3xl font-mono text-blue-500 mt-1 font-bold">
            ${Math.round(totalMonthlyPayrollUSD).toLocaleString()} / mo
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>${Math.round(totalAnnualPayrollUSD).toLocaleString()} Annual Payroll</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Total Monthly Payroll (UGX)</div>
          <div className="text-2xl lg:text-3xl font-mono text-amber-500 mt-1 font-bold">
            UGX {(totalMonthlyPayrollUGX / 1000000).toFixed(1)}M / mo
          </div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Exchange rate: 3,750 UGX / USD</div>
        </div>

        <div className={`p-4 rounded-xl border transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Workforce Housing Provision</div>
          <div className="text-2xl lg:text-3xl font-mono text-purple-500 mt-1 font-bold">400 Places</div>
          <div className={`text-[11px] mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>On-site residential block ($2.36M CapEx)</div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Classification Breakdown Donut */}
        <div className={`lg:col-span-5 p-4 rounded-xl border flex flex-col transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Workforce Classification ({totalHeadcount} Total Staff)
          </h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Direct manufacturing operators vs indirect logistics and engineering</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classificationPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke={isDark ? '#111318' : '#FFFFFF'}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {classificationPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className={`flex justify-center gap-6 text-xs font-mono border-t pt-3 ${isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]'}`}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>Direct ({directWithRelief})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span className={isDark ? 'text-gray-300' : 'text-slate-700'}>Indirect ({indirectCrewTotal})</span>
            </div>
          </div>
        </div>

        {/* Monthly Salary Bands Chart */}
        <div className={`lg:col-span-7 p-4 rounded-xl border flex flex-col transition-all ${
          isDark ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
        }`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Monthly Base Salary Bands by Department (USD)
          </h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>Top {wageRangeData.length} of {personnelList.length} roles by monthly base{wageHidden > 0 ? ` — ${wageHidden} more in the table below` : ''}</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wageRangeData} margin={{ top: 5, right: 10, left: 8, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#2D3139' : '#E2E8F0'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#6B7280' : '#64748B'} fontSize={9} angle={-25} textAnchor="end" interval={0} height={70} />
                <YAxis stroke={isDark ? '#6B7280' : '#64748B'} fontSize={10} domain={[0, Math.ceil((wageMax * 1.15) / 100) * 100]} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1A1D23' : '#FFF', borderColor: isDark ? '#2D3139' : '#E2E8F0', color: isDark ? '#FFF' : '#0F172A' }} />
                <Bar dataKey="monthlySalaryUSD" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Monthly Base Salary ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Workforce Table */}
      <div className={`rounded-xl border overflow-hidden transition-all ${
        isDark ? 'bg-[#111318]/52 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]' : 'bg-white/52 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]'
      }`}>
        <div className={`p-4 border-b flex flex-wrap justify-between items-center gap-3 ${
          isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC] bg-[#F6F5F2]/60'
        }`}>
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Detailed Human Resource & Payroll Registry
            </h3>
            <p className={`text-[11px] font-mono mt-0.5 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Showing {filteredPersonnel.length} of {personnelList.length} roles
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Search ref, department, basis…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`w-56 rounded-lg pl-8 pr-3 py-1 text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark
                    ? 'bg-[#1A1D23] border-[#2D3139] text-white placeholder-gray-500'
                    : 'bg-[#F6F5F2] border-[#DDD8CF] text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>
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
            <button
              onClick={openAdd}
              className="px-3 py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Role
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
            <thead className={`sticky top-0 z-10 border-b uppercase font-mono text-[10px] ${
              isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-400' : 'bg-[#F1EEE8] border-[#E7E3DC] text-slate-600'
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
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#2D3139]' : 'divide-[#E7E3DC]'}`}>
              {filteredPersonnel.map(p => {
                return (
                  <tr key={p.id} className={`transition-colors ${isDark ? 'hover:bg-[#1A1D23]/50' : 'hover:bg-[#F6F5F2]'}`}>
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
                    <td className="px-4 py-3">
                      <RowActions theme={theme} label={p.zoneOrFunction} onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget({ id: p.id, name: p.zoneOrFunction })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CrudSlideOver
        open={formMode !== null}
        title={formMode === 'add' ? 'Add Workforce Role' : 'Edit Workforce Role'}
        subtitle={formMode === 'add' ? 'Adds a new line to the payroll registry.' : 'Changes save and sync live to every collaborator.'}
        fields={workforceFields}
        values={formValues}
        onChange={(key, value) => setFormValues(prev => ({ ...prev, [key]: value }))}
        onSave={handleSave}
        onCancel={closeForm}
        busy={busy}
        error={formError}
        saveLabel={formMode === 'add' ? 'Add Role' : 'Save Changes'}
        theme={theme}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this workforce role?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed from the payroll registry for everyone. This can't be undone.` : ''}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        theme={theme}
      />
    </div>
  );
};
