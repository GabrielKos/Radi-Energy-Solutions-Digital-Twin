/**
 * The single definition of how the shipped plant data maps onto the Supabase
 * tables. Both the terminal seeder (`scripts/seed-supabase.ts`) and the
 * in-browser seeder import from here, so the two can never drift apart.
 *
 * Every row carries its original `id`, which makes every seed an upsert:
 * running it twice restores the shipped values without duplicating anything
 * and without touching rows you have since added yourself.
 */
import {
  PROCESS_ZONES,
  WAREHOUSES,
  PERSONNEL_SUMMARY,
  TARIFF_SCHEDULE,
  CAPEX_ITEMS,
} from '../data/plantData';

export const zoneRows = () =>
  PROCESS_ZONES.map(z => ({
    id: z.id,
    name: z.name,
    wbs_code: z.wbsCode,
    description: z.description,
    color: z.color,
    line_type: z.lineType ?? null,
    shift_crew_direct: z.shiftCrewDirect,
  }));

export const machineRows = () =>
  PROCESS_ZONES.flatMap(z =>
    z.machines.map(m => ({
      id: m.id,
      zone_id: z.id,
      wbs_code: m.wbsCode,
      name: m.name,
      description: m.description,
      cycle_time_sec: m.cycleTimeSec,
      machines_count: m.machinesCount,
      unit_rate_usd: m.unitRateUSD,
      status: m.status,
      utilization_pct: m.utilizationPct,
      packs_per_cycle: m.packsPerCycle ?? 1,
    }))
  );

export const warehouseRows = () =>
  WAREHOUSES.map(w => ({
    id: w.id,
    name: w.name,
    area_sqm: w.areaSqm,
    type: w.type,
    capacity_units: w.capacityUnits,
    current_stock_pct: w.currentStockPct,
    description: w.description,
    racking_cost_usd: w.rackingCostUSD,
    mhe_assigned: w.mheAssigned,
    safety_rating: w.safetyRating,
    days_of_buffer: w.daysOfBuffer ?? null,
    daily_production_target: w.dailyProductionTarget ?? null,
  }));

export const workforceRows = () =>
  PERSONNEL_SUMMARY.map(p => ({
    id: p.id,
    ref: p.ref,
    zone_or_function: p.zoneOrFunction,
    basis: p.basis,
    machine_units: p.machineUnits,
    attended_units: p.attendedUnits,
    shift_crew: p.shiftCrew,
    classification: p.classification,
    monthly_salary_usd: p.monthlySalaryUSD,
    annual_payroll_usd: p.annualPayrollUSD,
  }));

export const tariffRows = () =>
  TARIFF_SCHEDULE.map(t => ({
    id: t.id,
    name: t.name,
    start_hour: t.startHour,
    end_hour: t.endHour,
    rate_ugx: t.rateUGX,
    rate_usd: t.rateUSD,
    recommended_task: t.recommendedTask,
  }));

export const capexRows = () =>
  CAPEX_ITEMS.map(c => ({
    id: c.id,
    code: c.code,
    category: c.category,
    cost_usd: c.costUSD,
    color: c.color,
  }));

/** Ordered so foreign keys resolve: zones must exist before machines. */
export const SEED_PLAN: { table: string; rows: () => any[] }[] = [
  { table: 'zones', rows: zoneRows },
  { table: 'machines', rows: machineRows },
  { table: 'warehouses', rows: warehouseRows },
  { table: 'workforce', rows: workforceRows },
  { table: 'tariff_periods', rows: tariffRows },
  { table: 'capex_items', rows: capexRows },
];
