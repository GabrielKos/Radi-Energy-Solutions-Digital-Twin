import { useMemo } from 'react';
import { useSupabaseTable, TableAdapter } from './useSupabaseTable';
import {
  WarehouseInfo,
  PersonnelCategory,
  TariffPeriod,
  CapExItem,
  ProcessZone,
  ProcessMachine,
} from '../types/plant';
import {
  WAREHOUSES,
  PERSONNEL_SUMMARY,
  TARIFF_SCHEDULE,
  CAPEX_ITEMS,
  PROCESS_ZONES,
} from '../data/plantData';
import { withZoneRollups } from './derived';

// ---------- Warehouses ----------
const warehouseAdapter: TableAdapter<WarehouseInfo> = {
  table: 'warehouses',
  fromRow: (row: any): WarehouseInfo => ({
    id: row.id,
    name: row.name,
    type: row.type ?? 'hazardous_cell',
    areaSqm: Number(row.area_sqm ?? row.footprint_sq_meters ?? 0),
    capacityUnits: Number(row.capacity_units ?? row.storage_capacity_units ?? 0),
    currentStockPct: Number(row.current_stock_pct ?? 50),
    rackingCostUSD: Number(row.racking_cost_usd ?? 0),
    mheAssigned: Array.isArray(row.mhe_assigned) ? row.mhe_assigned : [],
    safetyRating: row.safety_rating ?? 'Class 9',
    daysOfBuffer: row.days_of_buffer !== null && row.days_of_buffer !== undefined ? Number(row.days_of_buffer) : undefined,
    dailyProductionTarget: row.daily_production_target !== null && row.daily_production_target !== undefined ? Number(row.daily_production_target) : undefined,
    description: row.description ?? '',
  }),
  toRow: (item: Partial<WarehouseInfo>) => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.type !== undefined ? { type: item.type } : {}),
    ...(item.areaSqm !== undefined ? { area_sqm: item.areaSqm } : {}),
    ...(item.capacityUnits !== undefined ? { capacity_units: item.capacityUnits } : {}),
    ...(item.currentStockPct !== undefined ? { current_stock_pct: item.currentStockPct } : {}),
    ...(item.rackingCostUSD !== undefined ? { racking_cost_usd: item.rackingCostUSD } : {}),
    ...(item.mheAssigned !== undefined ? { mhe_assigned: item.mheAssigned } : {}),
    ...(item.safetyRating !== undefined ? { safety_rating: item.safetyRating } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.daysOfBuffer !== undefined ? { days_of_buffer: item.daysOfBuffer } : {}),
    ...(item.dailyProductionTarget !== undefined ? { daily_production_target: item.dailyProductionTarget } : {}),
  }),
};
export const useWarehouses = () => useSupabaseTable<WarehouseInfo>(warehouseAdapter, WAREHOUSES);

// ---------- Workforce ----------
const workforceAdapter: TableAdapter<PersonnelCategory> = {
  table: 'workforce',
  fromRow: (row: any): PersonnelCategory => ({
    id: row.id,
    ref: row.ref ?? `HR-${row.id}`,
    zoneOrFunction: row.zone_or_function ?? row.category ?? '',
    basis: row.basis ?? 'Fixed per Shift',
    machineUnits: Number(row.machine_units ?? 1),
    attendedUnits: Number(row.attended_units ?? 1),
    shiftCrew: Number(row.shift_crew ?? row.headcount_per_shift ?? 1),
    classification: row.classification ?? 'Direct',
    monthlySalaryUSD: Number(row.monthly_salary_usd ?? 0),
    annualPayrollUSD: Number(row.annual_payroll_usd ?? 0),
  }),
  toRow: (item: Partial<PersonnelCategory>) => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.ref !== undefined ? { ref: item.ref } : {}),
    ...(item.zoneOrFunction !== undefined ? { zone_or_function: item.zoneOrFunction } : {}),
    ...(item.basis !== undefined ? { basis: item.basis } : {}),
    ...(item.machineUnits !== undefined ? { machine_units: item.machineUnits } : {}),
    ...(item.attendedUnits !== undefined ? { attended_units: item.attendedUnits } : {}),
    ...(item.shiftCrew !== undefined ? { shift_crew: item.shiftCrew } : {}),
    ...(item.classification !== undefined ? { classification: item.classification } : {}),
    ...(item.monthlySalaryUSD !== undefined ? { monthly_salary_usd: item.monthlySalaryUSD } : {}),
    ...(item.annualPayrollUSD !== undefined ? { annual_payroll_usd: item.annualPayrollUSD } : {}),
  }),
};
export const useWorkforce = () => useSupabaseTable<PersonnelCategory>(workforceAdapter, PERSONNEL_SUMMARY);

// ---------- Tariff periods ----------
const tariffAdapter: TableAdapter<TariffPeriod> = {
  table: 'tariff_periods',
  orderBy: 'start_hour',
  fromRow: (row: any): TariffPeriod => ({
    id: row.id,
    name: row.name ?? row.period ?? '',
    startHour: Number(row.start_hour ?? 0),
    endHour: Number(row.end_hour ?? 24),
    rateUGX: Number(row.rate_ugx ?? row.ugx_per_kwh ?? 0),
    rateUSD: Number(row.rate_usd ?? row.usd_per_kwh ?? 0),
    recommendedTask: row.recommended_task ?? '',
  }),
  toRow: (item: Partial<TariffPeriod>) => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.startHour !== undefined ? { start_hour: item.startHour } : {}),
    ...(item.endHour !== undefined ? { end_hour: item.endHour } : {}),
    ...(item.rateUGX !== undefined ? { rate_ugx: item.rateUGX } : {}),
    ...(item.rateUSD !== undefined ? { rate_usd: item.rateUSD } : {}),
    ...(item.recommendedTask !== undefined ? { recommended_task: item.recommendedTask } : {}),
  }),
};
export const useTariffPeriods = () => useSupabaseTable<TariffPeriod>(tariffAdapter, TARIFF_SCHEDULE);

// ---------- CapEx items ----------
const capexAdapter: TableAdapter<CapExItem> = {
  table: 'capex_items',
  fromRow: (row: any): CapExItem => ({
    id: row.id,
    code: row.code ?? `CAP-${row.id}`,
    category: row.category,
    costUSD: Number(row.cost_usd ?? 0),
    color: row.color ?? '#3B82F6',
  }),
  toRow: (item: Partial<CapExItem>) => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.code !== undefined ? { code: item.code } : {}),
    ...(item.category !== undefined ? { category: item.category } : {}),
    ...(item.costUSD !== undefined ? { cost_usd: item.costUSD } : {}),
    ...(item.color !== undefined ? { color: item.color } : {}),
  }),
};
export const useCapexItems = () => useSupabaseTable<CapExItem>(capexAdapter, CAPEX_ITEMS);

// ---------- Zones + Machines (joined) ----------
const zoneShellAdapter: TableAdapter<Omit<ProcessZone, 'machines'>> = {
  table: 'zones',
  orderBy: 'id',
  fromRow: (row: any) => ({
    id: row.id,
    name: row.name,
    wbsCode: row.wbs_code ?? '',
    description: row.description ?? '',
    machineUnitsCount: Number(row.machine_units_count ?? 0),
    totalCostUSD: Number(row.total_cost_usd ?? 0),
    shiftCrewDirect: Number(row.shift_crew_direct ?? 0),
    color: row.color ?? '#3B82F6',
    lineType: row.line_type ?? 'EV',
  }),
  toRow: (item: Partial<Omit<ProcessZone, 'machines'>>) => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.wbsCode !== undefined ? { wbs_code: item.wbsCode } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.machineUnitsCount !== undefined ? { machine_units_count: item.machineUnitsCount } : {}),
    ...(item.totalCostUSD !== undefined ? { total_cost_usd: item.totalCostUSD } : {}),
    ...(item.shiftCrewDirect !== undefined ? { shift_crew_direct: item.shiftCrewDirect } : {}),
    ...(item.color !== undefined ? { color: item.color } : {}),
    ...(item.lineType !== undefined ? { line_type: item.lineType } : {}),
  }),
};

export const machineAdapter: TableAdapter<ProcessMachine> = {
  table: 'machines',
  fromRow: (row: any): ProcessMachine => ({
    id: row.id,
    zoneId: row.zone_id,
    wbsCode: row.wbs_code ?? '',
    name: row.name,
    description: row.description ?? '',
    cycleTimeSec: Number(row.cycle_time_sec ?? 30),
    machinesCount: Number(row.machines_count ?? 1),
    unitRateUSD: Number(row.unit_rate_usd ?? 0),
    totalCostUSD: Number(row.total_cost_usd ?? 0),
    status: row.status ?? 'running',
    utilizationPct: Number(row.utilization_pct ?? 90),
  }),
  toRow: (item: Partial<ProcessMachine>) => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.zoneId !== undefined ? { zone_id: item.zoneId } : {}),
    ...(item.wbsCode !== undefined ? { wbs_code: item.wbsCode } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.cycleTimeSec !== undefined ? { cycle_time_sec: item.cycleTimeSec } : {}),
    ...(item.machinesCount !== undefined ? { machines_count: item.machinesCount } : {}),
    ...(item.unitRateUSD !== undefined ? { unit_rate_usd: item.unitRateUSD } : {}),
    ...(item.totalCostUSD !== undefined ? { total_cost_usd: item.totalCostUSD } : {}),
    ...(item.status !== undefined ? { status: item.status } : {}),
    ...(item.utilizationPct !== undefined ? { utilization_pct: item.utilizationPct } : {}),
  }),
};

const initialZoneShells = PROCESS_ZONES.map(z => ({
  id: z.id,
  name: z.name,
  wbsCode: z.wbsCode,
  description: z.description,
  machineUnitsCount: z.machineUnitsCount,
  totalCostUSD: z.totalCostUSD,
  shiftCrewDirect: z.shiftCrewDirect,
  color: z.color,
  lineType: z.lineType,
}));

const initialMachines: ProcessMachine[] = PROCESS_ZONES.flatMap(z =>
  z.machines.map(m => ({ ...m, zoneId: z.id }))
);

/**
 * Joins the `zones` and `machines` tables client-side into the exact
 * ProcessZone[] shape the rest of the app (Floor Twin, Throughput, Machine Census) expects.
 */
export function useZonesWithMachines() {
  const zonesResult = useSupabaseTable(zoneShellAdapter, initialZoneShells);
  const machinesResult = useSupabaseTable(machineAdapter, initialMachines);

  const zones: ProcessZone[] = useMemo(() => {
    return zonesResult.rows.map(zoneShell => {
      const zoneMachines = machinesResult.rows.filter(m => m.zoneId === zoneShell.id);
      return withZoneRollups({
        ...zoneShell,
        machines: zoneMachines,
      });
    });
  }, [zonesResult.rows, machinesResult.rows]);

  const addMachine = async (machine: Omit<ProcessMachine, 'id' | 'totalCostUSD'> & { zoneId: string }) => {
    await machinesResult.insert({
      ...machine,
      totalCostUSD: (machine.unitRateUSD || 0) * (machine.machinesCount || 1),
    });
  };

  const updateMachine = async (id: string, patch: Partial<ProcessMachine>) => {
    await machinesResult.update(id, patch);
  };

  const deleteMachine = async (id: string) => {
    await machinesResult.remove(id);
  };

  return {
    zones,
    loading: zonesResult.loading || machinesResult.loading,
    error: zonesResult.error || machinesResult.error,
    machinesTable: machinesResult,
    zonesTable: zonesResult,
    addMachine,
    updateMachine,
    deleteMachine,
  };
}
