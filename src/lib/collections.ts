import { useMemo } from 'react';
import { useSupabaseTable, TableAdapter } from './useSupabaseTable';
import { withZoneRollups } from './derived';
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

// ---------- Warehouses ----------
const warehouseAdapter: TableAdapter<WarehouseInfo> = {
  table: 'warehouses',
  orderBy: 'name',
  fromRow: r => ({
    id: r.id,
    name: r.name,
    areaSqm: r.area_sqm,
    type: r.type,
    capacityUnits: r.capacity_units,
    currentStockPct: r.current_stock_pct,
    description: r.description ?? '',
    rackingCostUSD: r.racking_cost_usd,
    mheAssigned: r.mhe_assigned ?? [],
    safetyRating: r.safety_rating ?? '',
    daysOfBuffer: r.days_of_buffer ?? undefined,
    dailyProductionTarget: r.daily_production_target ?? undefined,
  }),
  toRow: item => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.areaSqm !== undefined ? { area_sqm: item.areaSqm } : {}),
    ...(item.type !== undefined ? { type: item.type } : {}),
    ...(item.capacityUnits !== undefined ? { capacity_units: item.capacityUnits } : {}),
    ...(item.currentStockPct !== undefined ? { current_stock_pct: item.currentStockPct } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.rackingCostUSD !== undefined ? { racking_cost_usd: item.rackingCostUSD } : {}),
    ...(item.mheAssigned !== undefined ? { mhe_assigned: item.mheAssigned } : {}),
    ...(item.safetyRating !== undefined ? { safety_rating: item.safetyRating } : {}),
    ...(item.daysOfBuffer !== undefined ? { days_of_buffer: item.daysOfBuffer } : {}),
    ...(item.dailyProductionTarget !== undefined ? { daily_production_target: item.dailyProductionTarget } : {}),
  }),
};
export const useWarehouses = () => useSupabaseTable<WarehouseInfo>(warehouseAdapter, () => WAREHOUSES);

// ---------- Workforce ----------
const workforceAdapter: TableAdapter<PersonnelCategory> = {
  table: 'workforce',
  orderBy: 'ref',
  fromRow: r => ({
    id: r.id,
    ref: r.ref,
    zoneOrFunction: r.zone_or_function,
    basis: r.basis ?? '',
    machineUnits: r.machine_units ?? 0,
    attendedUnits: r.attended_units ?? 0,
    shiftCrew: r.shift_crew,
    classification: r.classification,
    monthlySalaryUSD: r.monthly_salary_usd,
    annualPayrollUSD: r.annual_payroll_usd,
  }),
  toRow: item => ({
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
export const useWorkforce = () => useSupabaseTable<PersonnelCategory>(workforceAdapter, () => PERSONNEL_SUMMARY);

// ---------- Tariff periods ----------
const tariffAdapter: TableAdapter<TariffPeriod> = {
  table: 'tariff_periods',
  orderBy: 'start_hour',
  fromRow: r => ({
    id: r.id,
    name: r.name,
    startHour: r.start_hour,
    endHour: r.end_hour,
    rateUGX: r.rate_ugx,
    rateUSD: r.rate_usd,
    recommendedTask: r.recommended_task ?? '',
  }),
  toRow: item => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.startHour !== undefined ? { start_hour: item.startHour } : {}),
    ...(item.endHour !== undefined ? { end_hour: item.endHour } : {}),
    ...(item.rateUGX !== undefined ? { rate_ugx: item.rateUGX } : {}),
    ...(item.rateUSD !== undefined ? { rate_usd: item.rateUSD } : {}),
    ...(item.recommendedTask !== undefined ? { recommended_task: item.recommendedTask } : {}),
  }),
};
export const useTariffPeriods = () => useSupabaseTable<TariffPeriod>(tariffAdapter, () => TARIFF_SCHEDULE);

// ---------- CapEx items ----------
const capexAdapter: TableAdapter<CapExItem> = {
  table: 'capex_items',
  orderBy: 'code',
  fromRow: r => ({ id: r.id, code: r.code, category: r.category, costUSD: r.cost_usd, color: r.color }),
  toRow: item => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.code !== undefined ? { code: item.code } : {}),
    ...(item.category !== undefined ? { category: item.category } : {}),
    ...(item.costUSD !== undefined ? { cost_usd: item.costUSD } : {}),
    ...(item.color !== undefined ? { color: item.color } : {}),
  }),
};
export const useCapexItems = () => useSupabaseTable<CapExItem>(capexAdapter, () => CAPEX_ITEMS);

// ---------- Zones + Machines (joined) ----------
const zoneShellAdapter: TableAdapter<Omit<ProcessZone, 'machines'>> = {
  table: 'zones',
  orderBy: 'wbs_code',
  fromRow: r => ({
    id: r.id,
    name: r.name,
    wbsCode: r.wbs_code,
    description: r.description ?? '',
    machineUnitsCount: 0, // recomputed after join, see useZonesWithMachines
    totalCostUSD: 0,
    shiftCrewDirect: r.shift_crew_direct ?? 0,
    color: r.color,
    lineType: r.line_type ?? undefined,
  }),
  toRow: item => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.wbsCode !== undefined ? { wbs_code: item.wbsCode } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.shiftCrewDirect !== undefined ? { shift_crew_direct: item.shiftCrewDirect } : {}),
    ...(item.color !== undefined ? { color: item.color } : {}),
    ...(item.lineType !== undefined ? { line_type: item.lineType } : {}),
  }),
};

const machineAdapter: TableAdapter<ProcessMachine> = {
  table: 'machines',
  orderBy: 'wbs_code',
  fromRow: r => ({
    id: r.id,
    zoneId: r.zone_id,
    wbsCode: r.wbs_code,
    name: r.name,
    description: r.description ?? '',
    cycleTimeSec: Number(r.cycle_time_sec),
    machinesCount: r.machines_count,
    unitRateUSD: Number(r.unit_rate_usd),
    totalCostUSD: 0, // recomputed, see withZoneRollups
    status: r.status,
    utilizationPct: Number(r.utilization_pct ?? 90),
    packsPerCycle: Number(r.packs_per_cycle ?? 1),
  }),
  toRow: item => ({
    ...(item.id ? { id: item.id } : {}),
    ...(item.zoneId !== undefined ? { zone_id: item.zoneId } : {}),
    ...(item.wbsCode !== undefined ? { wbs_code: item.wbsCode } : {}),
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.cycleTimeSec !== undefined ? { cycle_time_sec: item.cycleTimeSec } : {}),
    ...(item.machinesCount !== undefined ? { machines_count: item.machinesCount } : {}),
    ...(item.unitRateUSD !== undefined ? { unit_rate_usd: item.unitRateUSD } : {}),
    ...(item.status !== undefined ? { status: item.status } : {}),
    ...(item.utilizationPct !== undefined ? { utilization_pct: item.utilizationPct } : {}),
    ...(item.packsPerCycle !== undefined ? { packs_per_cycle: item.packsPerCycle } : {}),
  }),
};

/**
 * Joins the `zones` and `machines` tables client-side into the exact
 * ProcessZone[] shape the rest of the app (Floor Twin, Throughput, Machine
 * Census) already expects, so those two screens need zero changes even
 * though their data now comes from Supabase instead of the static file.
 */
export function useZonesWithMachines() {
  const zonesResult = useSupabaseTable(
    zoneShellAdapter,
    () => PROCESS_ZONES.map(z => ({ ...z, machines: [] }))
  );
  const machinesResult = useSupabaseTable(
    machineAdapter,
    () => PROCESS_ZONES.flatMap(z => z.machines.map(m => ({ ...m, zoneId: z.id })))
  );

  const zones: ProcessZone[] = useMemo(() => {
    if (zonesResult.rows.length === 0 && machinesResult.rows.length === 0) {
      return PROCESS_ZONES;
    }
    return zonesResult.rows.map(zoneShell => {
      const machines = machinesResult.rows.filter(m => m.zoneId === zoneShell.id);
      return withZoneRollups({ ...zoneShell, machines });
    });
  }, [zonesResult.rows, machinesResult.rows]);

  return {
    zones,
    loading: zonesResult.loading || machinesResult.loading,
    error: zonesResult.error || machinesResult.error,
    // `totalCostUSD` is derived (unitRateUSD x machinesCount) and is never
    // written to the database, so callers must not be required to supply it.
    refetch: () => {
      zonesResult.refetch();
      machinesResult.refetch();
    },
    addMachine: machinesResult.insert as (
      machine: Omit<ProcessMachine, 'id' | 'totalCostUSD'> & { zoneId: string }
    ) => Promise<void>,
    updateMachine: machinesResult.update,
    deleteMachine: machinesResult.remove,
  };
}
