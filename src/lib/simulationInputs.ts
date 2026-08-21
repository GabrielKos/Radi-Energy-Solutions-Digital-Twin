import { useMemo } from 'react';
import { ProcessZone, PersonnelCategory, TariffPeriod } from '../types/plant';

/**
 * Turns the editable collections into the handful of numbers the shift
 * simulation actually runs on.
 *
 * Before this existed the two halves of the app were unrelated: you could
 * delete every machine in the census and the line would still claim 26.57 s
 * takt and 1,183 packs, because those were literal values in `useState`.
 *
 * Everything here is clamped. The simulation divides by takt and multiplies by
 * headcount, so a mistyped `0` or a pasted `999999` must not be able to produce
 * Infinity packs or a negative shift — the clamps below are what stop an edit
 * from taking the whole model with it, and anything that gets clamped is
 * reported back so the UI can say so rather than silently lying.
 */

interface Bound {
  min: number;
  max: number;
  fallback?: number;
}

export const SIM_BOUNDS: Record<'taktSec' | 'targetPacks' | 'operators' | 'tariffUSD', Bound> = {
  taktSec: { min: 1, max: 3600, fallback: 26.57 },
  targetPacks: { min: 1, max: 100000 },
  operators: { min: 0, max: 5000 },
  tariffUSD: { min: 0.001, max: 5, fallback: 0.055 },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export interface DerivedSimInputs {
  /** Slowest effective station on the EV line, in seconds per pack. */
  taktSec: number;
  bottleneckName: string;
  bottleneckZone: string;
  /** Good packs achievable in one shift at this takt, after yield and OEE. */
  targetPacks: number;
  /** Direct crew on shift, including the relief factor. */
  activeOperators: number;
  /** Tariff in force at the current point in the shift. */
  tariffUSD: number;
  tariffPeriodName: string;
  /** Human-readable notes about anything that had to be clamped or defaulted. */
  warnings: string[];
}

/**
 * Effective seconds per pack for one station.
 * A station with N parallel units each handling B packs per cycle contributes
 * cycleTime / (N x B).
 */
export function effectiveStationTakt(m: {
  cycleTimeSec: number;
  machinesCount: number;
  packsPerCycle?: number;
}): number {
  const parallel = Math.max(1, m.machinesCount) * Math.max(1, m.packsPerCycle ?? 1);
  return m.cycleTimeSec > 0 ? m.cycleTimeSec / parallel : 0;
}

export function deriveSimInputs(args: {
  zones: ProcessZone[];
  workforce: PersonnelCategory[];
  tariffPeriods: TariffPeriod[];
  shiftLengthHours: number;
  yieldPct: number;
  oeePct: number;
  /** Wall-clock hour (0-23) the shift has currently reached. */
  currentHour: number;
}): DerivedSimInputs {
  const warnings: string[] = [];

  // ---- Takt, from the machine census ----------------------------------
  // BESS is a separate line building containers, not EV packs, so it must not
  // set the EV line's takt.
  const evStations = args.zones
    .filter(z => (z.lineType ?? 'EV') !== 'BESS')
    .flatMap(z =>
      z.machines
        .filter(m => m.status !== 'maintenance')
        .map(m => ({ zone: z.wbsCode, name: m.name, takt: effectiveStationTakt(m) }))
    )
    .filter(s => s.takt > 0);

  let taktSec = SIM_BOUNDS.taktSec.fallback!;
  let bottleneckName = 'No machines in census';
  let bottleneckZone = '—';

  if (evStations.length === 0) {
    warnings.push('No EV-line machines found — holding the shipped 26.57 s takt.');
  } else {
    const slowest = evStations.reduce((a, b) => (b.takt > a.takt ? b : a));
    const raw = slowest.takt;
    taktSec = clamp(raw, SIM_BOUNDS.taktSec.min, SIM_BOUNDS.taktSec.max);
    bottleneckName = slowest.name;
    bottleneckZone = slowest.zone;
    if (raw !== taktSec) {
      warnings.push(
        `Bottleneck takt of ${raw.toFixed(1)} s is outside the modelled range — clamped to ${taktSec.toFixed(2)} s.`
      );
    }
  }

  // ---- Shift target, from takt ----------------------------------------
  const shiftSeconds = clamp(args.shiftLengthHours, 1, 24) * 3600;
  const yieldPct = clamp(args.yieldPct, 0.01, 1);
  const oeePct = clamp(args.oeePct, 0.01, 1);
  const targetPacks = Math.floor(
    clamp((shiftSeconds / taktSec) * yieldPct * oeePct, SIM_BOUNDS.targetPacks.min, SIM_BOUNDS.targetPacks.max)
  );

  // ---- Operators, from the workforce registry --------------------------
  const RELIEF_FACTOR = 1.14; // cover for breaks, leave and absence
  const directCrew = args.workforce
    .filter(p => p.classification === 'Direct')
    .reduce((sum, p) => sum + (Number(p.shiftCrew) || 0), 0);
  const activeOperators = Math.round(
    clamp(directCrew * RELIEF_FACTOR, SIM_BOUNDS.operators.min, SIM_BOUNDS.operators.max)
  );
  if (args.workforce.length === 0) {
    warnings.push('Workforce registry is empty — the line is running with no operators.');
  }

  // ---- Tariff, from the period covering the current hour ----------------
  const hour = ((Math.floor(args.currentHour) % 24) + 24) % 24;
  const inPeriod = (p: TariffPeriod) => {
    if (p.startHour === p.endHour) return false;
    return p.startHour < p.endHour
      ? hour >= p.startHour && hour < p.endHour
      : hour >= p.startHour || hour < p.endHour;
  };
  const active = args.tariffPeriods.find(inPeriod);
  let tariffUSD = SIM_BOUNDS.tariffUSD.fallback!;
  let tariffPeriodName = 'Unassigned';
  if (active) {
    tariffUSD = clamp(active.rateUSD, SIM_BOUNDS.tariffUSD.min, SIM_BOUNDS.tariffUSD.max);
    tariffPeriodName = active.name;
    if (active.rateUSD !== tariffUSD) {
      warnings.push(`"${active.name}" rate is out of range — clamped to $${tariffUSD}/kWh.`);
    }
  } else if (args.tariffPeriods.length > 0) {
    warnings.push(`No tariff period covers ${String(hour).padStart(2, '0')}:00 — using the shipped average.`);
  }

  return {
    taktSec,
    bottleneckName,
    bottleneckZone,
    targetPacks,
    activeOperators,
    tariffUSD,
    tariffPeriodName,
    warnings,
  };
}

export function useSimulationInputs(args: Parameters<typeof deriveSimInputs>[0]): DerivedSimInputs {
  const { zones, workforce, tariffPeriods, shiftLengthHours, yieldPct, oeePct, currentHour } = args;
  return useMemo(
    () => deriveSimInputs({ zones, workforce, tariffPeriods, shiftLengthHours, yieldPct, oeePct, currentHour }),
    [zones, workforce, tariffPeriods, shiftLengthHours, yieldPct, oeePct, currentHour]
  );
}
