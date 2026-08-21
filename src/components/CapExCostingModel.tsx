import React, { useState } from 'react';
import { ThemeMode, CapExItem } from '../types/plant';
import { Plus, Search } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CrudSlideOver, CrudField } from './common/CrudSlideOver';
import { ConfirmDialog } from './common/ConfirmDialog';
import { RowActions } from './common/RowActions';
import { capexPct, capexTotalUSD } from '../lib/derived';

interface CapExCostingModelProps {
  items: CapExItem[];
  theme?: ThemeMode;
  onAddItem: (item: Omit<CapExItem, 'id'>) => Promise<void>;
  onUpdateItem: (id: string, patch: Partial<CapExItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

const emptyItemForm = () => ({
  code: '',
  category: '',
  costUSD: 0,
  color: '#3B82F6',
});

// Find a specific WBS line for the top summary cards, so those cards stay
// accurate as items are edited instead of the fixed numbers they used to be.
function findByCode(items: CapExItem[], code: string) {
  return items.find(i => i.code === code);
}

export const CapExCostingModel: React.FC<CapExCostingModelProps> = ({
  items,
  theme = 'light',
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}) => {
  const isDark = theme === 'dark';
  const totalCapExUSD = capexTotalUSD(items);
  const card = isDark
    ? 'bg-[#111318]/32 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]'
    : 'bg-white/32 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]';
  // Denser than `card` — the data table has no per-row backing, so its wrapper
  // needs more opacity to keep long rows of figures legible.
  const tableCard = isDark
    ? 'bg-[#111318]/52 backdrop-blur-xl border-white/10 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]'
    : 'bg-white/52 backdrop-blur-xl border-white/70 shadow-[0_10px_24px_-10px_rgba(15,23,42,0.25)]';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-gray-400' : 'text-slate-500';
  const axis = isDark ? '#6B7280' : '#64748B';
  const grid = isDark ? '#2D3139' : '#E2E8F0';
  const tooltipStyle = {
    backgroundColor: isDark ? '#1A1D23' : '#FFF',
    borderColor: isDark ? '#2D3139' : '#E2E8F0',
    color: isDark ? '#FFF' : '#0F172A',
    fontSize: 12,
    borderRadius: 8,
  };

  // --- CRUD panel state ---
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const openAdd = () => {
    setFormMode('add');
    setEditingId(null);
    setFormError(null);
    setFormValues(emptyItemForm());
  };

  const openEdit = (item: CapExItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    setFormError(null);
    setFormValues({ code: item.code, category: item.category, costUSD: item.costUSD, color: item.color });
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
        await onAddItem(formValues as any);
      } else if (formMode === 'edit' && editingId) {
        await onUpdateItem(editingId, formValues);
      }
      closeForm();
    } catch (err: any) {
      setFormError(err?.message ?? 'Could not save this CapEx line. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await onDeleteItem(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // leave dialog open on failure
    } finally {
      setBusy(false);
    }
  };

  const itemFields: CrudField[] = [
    {
      key: 'code',
      label: 'WBS Code',
      type: 'text',
      required: true,
      validate: value =>
        items.some(i => i.id !== editingId && i.code.trim().toLowerCase() === String(value).trim().toLowerCase())
          ? 'That WBS code is already in the ledger.'
          : null,
    },
    { key: 'category', label: 'Category & Scope', type: 'text', required: true },
    { key: 'costUSD', label: 'Cost', type: 'number', suffix: 'USD', min: 0, required: true },
    { key: 'color', label: 'Chart Colour', type: 'color', required: true },
  ];

  const query = searchTerm.trim().toLowerCase();
  const filteredItems = query
    ? items.filter(i => i.code.toLowerCase().includes(query) || i.category.toLowerCase().includes(query))
    : items;

  const buildings = findByCode(items, 'B.1');
  const processEquip = findByCode(items, 'B.2');
  const contingency = findByCode(items, 'B.7');

  return (
    <div className={`flex flex-col gap-6 p-4 md:p-6 pb-16 w-full min-h-full transition-colors duration-200 ${
      isDark ? 'bg-transparent text-[#D1D5DB]' : 'bg-transparent text-slate-800'
    }`}>
      {/* Top CapEx Summary Cards — computed live from `items`, so edits below flow up here too */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border transition-all ${card}`}>
          <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Total Project CapEx</div>
          <div className="text-3xl font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-bold">
            ${(totalCapExUSD / 1000000).toFixed(2)} Million
          </div>
          <div className={`text-[11px] mt-1 ${sub}`}>AACE Class 4 Cost Estimation Standard</div>
        </div>

        {buildings && (
          <div className={`p-4 rounded-xl border transition-all ${card}`}>
            <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Civil & Structures</div>
            <div className="text-3xl font-mono text-blue-600 dark:text-blue-400 mt-1 font-bold">${(buildings.costUSD / 1000000).toFixed(2)} Million</div>
            <div className={`text-[11px] mt-1 ${sub}`}>{capexPct(buildings, items).toFixed(1)}% of total CapEx</div>
          </div>
        )}

        {processEquip && (
          <div className={`p-4 rounded-xl border transition-all ${card}`}>
            <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Process Machinery & Fixtures</div>
            <div className="text-3xl font-mono text-amber-600 dark:text-amber-400 mt-1 font-bold">${(processEquip.costUSD / 1000000).toFixed(2)} Million</div>
            <div className={`text-[11px] mt-1 ${sub}`}>{capexPct(processEquip, items).toFixed(1)}% of total CapEx</div>
          </div>
        )}

        {contingency && (
          <div className={`p-4 rounded-xl border transition-all ${card}`}>
            <div className={`text-xs uppercase font-bold tracking-wider ${sub}`}>Contingency Reserve</div>
            <div className="text-3xl font-mono text-purple-600 dark:text-purple-400 mt-1 font-bold">${(contingency.costUSD / 1000000).toFixed(2)} Million</div>
            <div className={`text-[11px] mt-1 ${sub}`}>{capexPct(contingency, items).toFixed(1)}% unallocated risk buffer</div>
          </div>
        )}
      </div>

      {/* Visual CapEx Pie & Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`lg:col-span-5 p-4 rounded-xl border flex flex-col transition-all ${card}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${heading}`}>
            Capital Expenditure Distribution
          </h3>
          <p className={`text-xs mb-4 ${sub}`}>Project cost structure across major elemental codes</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={84}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="costUSD"
                  nameKey="code"
                  stroke={isDark ? '#111318' : '#FFFFFF'}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {items.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [`$${(Number(value) / 1000000).toFixed(2)}M`, String(name)]}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 11, lineHeight: '18px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`lg:col-span-7 p-4 rounded-xl border flex flex-col transition-all ${card}`}>
          <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${heading}`}>
            Elemental Cost Comparison ($ USD Millions)
          </h3>
          <p className={`text-xs mb-4 ${sub}`}>AACE Class 4 Cost Engineering breakdown</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" stroke={axis} fontSize={10} tickFormatter={v => `$${v / 1000000}M`} />
                <YAxis dataKey="code" type="category" stroke={axis} fontSize={10} width={48} />
                <Tooltip
                  cursor={{ fill: isDark ? '#FFFFFF0D' : '#0F172A0D' }}
                  formatter={(value: any, _n: any, entry: any) => [
                    `$${(Number(value) / 1000000).toFixed(2)}M`,
                    entry?.payload?.category ?? 'Cost',
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="costUSD" radius={[0, 4, 4, 0]} name="Cost USD" isAnimationActive={false}>
                  {items.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CapEx Breakdown Table */}
      <div className={`rounded-xl border overflow-hidden transition-all ${tableCard}`}>
        <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#2D3139]' : 'border-[#E7E3DC]'}`}>
          <div>
            <h3 className={`text-sm font-bold uppercase tracking-wider ${heading}`}>
              Comprehensive Project WBS CapEx Ledger
            </h3>
            <p className={`text-[11px] font-mono mt-0.5 ${sub}`}>
              Showing {filteredItems.length} of {items.length} lines
            </p>
          </div>
          <div className="flex items-center gap-2">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-2 ${isDark ? 'text-gray-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search WBS code or category…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-60 rounded-lg pl-8 pr-3 py-1 text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDark
                  ? 'bg-[#1A1D23] border-[#2D3139] text-white placeholder-gray-500'
                  : 'bg-[#F6F5F2] border-[#DDD8CF] text-slate-800 placeholder-slate-400'
              }`}
            />
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Line Item
          </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isDark ? 'text-gray-300' : 'text-slate-700'}`}>
            <thead className={`sticky top-0 z-10 border-b uppercase font-mono text-[10px] ${isDark ? 'bg-[#1A1D23] border-[#2D3139] text-gray-400' : 'bg-[#F1EEE8] border-[#E7E3DC] text-slate-600'}`}>
              <tr>
                <th className="px-4 py-3">WBS Code</th>
                <th className="px-4 py-3">Category & Scope</th>
                <th className="px-4 py-3 text-right">Cost (USD)</th>
                <th className="px-4 py-3 text-right">Cost (UGX Billions)</th>
                <th className="px-4 py-3 text-center">Share %</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#2D3139]' : 'divide-[#E7E3DC]'}`}>
              {filteredItems.map(item => (
                <tr key={item.id} className={`transition-colors ${isDark ? 'hover:bg-[#1A1D23]/50' : 'hover:bg-[#F6F5F2]'}`}>
                  <td className="px-4 py-3 font-mono text-blue-700 dark:text-blue-400 font-bold">{item.code}</td>
                  <td className={`px-4 py-3 font-semibold flex items-center gap-2 ${heading}`}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    {item.category}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    ${item.costUSD.toLocaleString()}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${sub}`}>
                    UGX {((item.costUSD * 3750) / 1000000000).toFixed(2)}B
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-amber-700 dark:text-amber-400">
                    {capexPct(item, items).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <RowActions theme={theme} label={item.category} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget({ id: item.id, name: item.category })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CrudSlideOver
        open={formMode !== null}
        title={formMode === 'add' ? 'Add CapEx Line Item' : 'Edit CapEx Line Item'}
        subtitle={formMode === 'add' ? 'Adds a new WBS line to the ledger.' : 'Changes save and sync live — the summary cards and charts update automatically.'}
        fields={itemFields}
        values={formValues}
        onChange={(key, value) => setFormValues(prev => ({ ...prev, [key]: value }))}
        onSave={handleSave}
        onCancel={closeForm}
        busy={busy}
        error={formError}
        saveLabel={formMode === 'add' ? 'Add Line Item' : 'Save Changes'}
        theme={theme}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this CapEx line?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed from the ledger for everyone. This can't be undone.` : ''}
        busy={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        theme={theme}
      />
    </div>
  );
};
