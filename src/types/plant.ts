export type ThemeMode = 'dark' | 'light';

/**
 * The set of screens the app can show. Previously App.tsx kept this union
 * inline while Header.tsx typed `setActiveTab` as `(tab: string) => void`, so
 * the nav could ask for a tab that renders nothing and nobody would notice.
 */
export type TabId =
  | 'layout'
  | 'throughput'
  | 'machines'
  | 'inventory'
  | 'mhe_personnel'
  | 'workforce'
  | 'tariff'
  | 'capex'
  | 'changelog';

export interface ProcessMachine {
  id: string;
  zoneId?: string;
  wbsCode: string;
  name: string;
  description: string;
  cycleTimeSec: number;
  machinesCount: number;
  unitRateUSD: number;
  totalCostUSD: number;
  status: 'running' | 'bottleneck' | 'idle' | 'maintenance';
  utilizationPct: number;
  /**
   * Packs completed per cycle at this station. 1 for a normal in-line station;
   * higher for batch equipment such as the 3 adhesive curing tunnels, which
   * each hold 50 packs for a 3,600 s cure. Without it, a batch station's raw
   * cycle time reads as a 1,200 s line bottleneck instead of its true 24 s
   * contribution, which is what made the census unusable as a takt source.
   */
  packsPerCycle?: number;
}

export interface ProcessZone {
  id: string;
  name: string;
  wbsCode: string;
  description: string;
  machineUnitsCount: number;
  totalCostUSD: number;
  shiftCrewDirect: number;
  machines: ProcessMachine[];
  color: string;
  lineType?: 'EV' | 'BESS' | 'SHARED';
}

export interface DailyInventoryBatch {
  dayNumber: number;
  dayLabel: string;
  dateStr: string;
  packsAccumulated: number;
  bessCabinetsAccumulated: number;
  qaPassedPct: number;
  status: 'active_shift' | 'qa_dwell_24h' | 'bonded_staging' | 'cleared_for_freight';
  storageLocation: string;
  dispatched: boolean;
}

export interface WarehouseInfo {
  id: string;
  name: string;
  areaSqm: number;
  type: 'hazardous_cell' | 'outbound_pack' | 'bess_yard' | 'non_live_material';
  capacityUnits: number;
  currentStockPct: number;
  description: string;
  rackingCostUSD: number;
  mheAssigned: string[];
  safetyRating: string;
  daysOfBuffer?: number;
  dailyProductionTarget?: number;
}

export interface MheItem {
  id: string;
  name: string;
  wbsCode: string;
  qty: number;
  unitRateUSD: number;
  totalCostUSD: number;
  type: 'agv' | 'reach_truck' | 'forklift' | 'stacker' | 'crane' | 'weighbridge';
  utilizationPct: number;
  status: 'active' | 'charging' | 'idle';
}

export interface PersonnelCategory {
  id: string;
  ref: string;
  zoneOrFunction: string;
  basis: string;
  machineUnits: number;
  attendedUnits: number;
  shiftCrew: number;
  classification: 'Direct' | 'Indirect';
  monthlySalaryUSD: number;
  annualPayrollUSD: number;
}

export interface TariffPeriod {
  id: string;
  name: string;
  startHour: number; // 0-23, inclusive
  endHour: number; // 0-24, exclusive (wraps past midnight if less than startHour)
  rateUGX: number;
  rateUSD: number;
  recommendedTask: string;
}

export interface CapExItem {
  id: string;
  code: string;
  category: string;
  costUSD: number;
  color: string;
}

export interface SimulationState {
  isRunning: boolean;
  simulationSpeed: number; // 1x, 5x, 20x, 100x
  shiftTimeSeconds: number; // 0 to 36000 (10 hours)
  shiftHoursRemaining: number;
  processedPacks: number;
  goodPacks: number;
  reworkedPacks: number;
  scrappedPacks: number;
  targetPacks: number; // e.g. 1,183
  currentTaktSec: number; // Target e.g. 26.57s
  currentYieldPct: number; // Target 97%
  currentOeePct: number; // Target 90%
  inboundCellStockUnits: number;
  productionMaterialStockPct: number;
  outboundPackStockUnits: number;
  bessCabinetStockUnits: number;
  activeAgvs: number;
  activeForklifts: number;
  activeOperators: number;
  activePowerDrawKw: number;
  currentTariffUSD: number;

  // Capacity & BOM Model Parameters
  annualGwhTarget: number; // e.g. 10 GWh
  packKwhCapacity: number; // e.g. 35.23 kWh
  bessKwhCapacity: number; // e.g. 215 kWh module / 3.44 MWh container
  packsPerBessContainer: number; // e.g. 24 packs/racks per BESS container
  operatingShiftsPerDay: number; // 1, 2, or 3
  shiftLengthHours: number; // 8, 10, or 12
  cellsPerPackBom: number; // 108 cells

  // Logistics & Cycle Times
  inboundTruckRatePerHour: number; // e.g. 2 trucks/hr
  cellsPerInboundTruck: number; // e.g. 25,000 bare cells per truck
  outboundDispatchBatchSize: number; // e.g. 150-300 packs per consolidated convoy
  stackerCycleTimeSec: number; // e.g. 90s
  weldCycleTimeSec: number; // e.g. 38s
  eolCyclerTimeSec: number; // e.g. 1217s (amortized across 46 cyclers)
  defectRejectRatePct: number; // e.g. 2.5%

  // Shift Completion & Reporting
  shiftCompleted: boolean;
  isShiftReportOpen: boolean;
  bessContainersBuilt: number;

  // 4-Day Buffer & Daily Production Log
  day1PacksProduced: number;
  day2PacksProduced: number;
  day3PacksProduced: number;
  day4PacksProduced: number;
  daysBufferLevel: number; // e.g. 4.2 days
  nextDispatchHoursRemaining: number;
}

export interface OptimizationScenario {
  shiftHours: number; // default 10
  shiftsPerDay: number; // default 1
  agvCount: number; // default 11
  cellSorterCount: number; // default 10
  hvCableOperatorCount: number; // default 43
  eolCyclerCount: number; // default 46
  eolScheduleOffPeakOnly: boolean; // default true
  targetDailyPacks: number; // default 1183
}
