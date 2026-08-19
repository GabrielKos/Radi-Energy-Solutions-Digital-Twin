import { ProcessMachine, ProcessZone, CapExItem } from '../types/plant';

/**
 * These are the ONLY computed values in the CRUD data path. Nothing else is
 * derived — every other field on Machine / Warehouse / Personnel / TariffPeriod
 * is stored exactly as entered. Verified against the original seed data before
 * wiring this in (see chat notes): totalCostUSD really does equal
 * unitRateUSD * machinesCount for every existing machine row, with no
 * exceptions, so it's safe to compute rather than store.
 */
export function machineTotalCostUSD(m: Pick<ProcessMachine, 'unitRateUSD' | 'machinesCount'>): number {
  return m.unitRateUSD * m.machinesCount;
}

/** Rebuilds a zone's rollup fields from its live machine list. */
export function withZoneRollups(zone: ProcessZone): ProcessZone {
  const machines = zone.machines.map(m => ({ ...m, totalCostUSD: machineTotalCostUSD(m) }));
  return {
    ...zone,
    machines,
    machineUnitsCount: machines.reduce((sum, m) => sum + m.machinesCount, 0),
    totalCostUSD: machines.reduce((sum, m) => sum + m.totalCostUSD, 0),
  };
}

/** CapEx share of total — never stored, always computed from the live set. */
export function capexPct(item: Pick<CapExItem, 'costUSD'>, allItems: Pick<CapExItem, 'costUSD'>[]): number {
  const total = allItems.reduce((sum, i) => sum + i.costUSD, 0);
  return total > 0 ? (item.costUSD / total) * 100 : 0;
}

export function capexTotalUSD(allItems: Pick<CapExItem, 'costUSD'>[]): number {
  return allItems.reduce((sum, i) => sum + i.costUSD, 0);
}

/** "06:00 - 18:00" style label from numeric hours, for display only. */
export function formatHourRange(startHour: number, endHour: number): string {
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return `${fmt(startHour)} - ${fmt(endHour)}`;
}
