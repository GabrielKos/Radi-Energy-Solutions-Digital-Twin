import { ProcessZone, WarehouseInfo, MheItem, PersonnelCategory, TariffPeriod, CapExItem } from '../types/plant';

export const PLANT_METADATA = {
  name: 'Kiira Battery Manufacturing Plant',
  location: 'NEC T6 Industrial Park, Katuugo, Nakasongola, Uganda',
  landAreaAcres: 60,
  landValuationUSD: 1800000,
  annualCapacityGWh: 10,
  packEnergyKWh: 35.23,
  targetAnnualGoodPacks: 283849,
  targetAnnualProcessedPacks: 292628,
  firstPassYield: 0.97,
  oee: 0.90,
  workingDaysPerYear: 240,
  shiftHoursPerDay: 10,
  effectiveProductionSecPerYr: 7776000,
  taktTimeSec: 26.57,
  targetDailyGoodPacks: 1183,
  totalCapExUSD: 140232979,
  processEquipmentCapExUSD: 30086462,
  buildingsCapExUSD: 67240000,
  landAndSiteCapExUSD: 3800000,
  utilitiesCapExUSD: 6915000,
  mheCapExUSD: 5476000,
  safetyAndServicesCapExUSD: 1466328,
  licensingAndPermitsCapExUSD: 2825000,
  preOpStartUpCapExUSD: 9675736,
  contingencyCapExUSD: 12748453,
  annualPayrollUSD: 2400000,
  engineeredWorkforceCount: 313,
  housingCapacity: 400,
  connectedLoadKW: 6500,
  maximumDemandKW: 4875,
  substationRatingKVA: 6300,
  annualEnergyConsumptionMWh: 10140,
  annualElectricityCostUSD: 557700,
};

export const PROCESS_ZONES: ProcessZone[] = [
  {
    id: 'z1',
    name: 'Inbound Handling, Kitting & Sequencing',
    wbsCode: 'Z1',
    description: 'Automated cell tray movement, decant, barcode serialisation, genealogy capture & manual kitting benches.',
    machineUnitsCount: 24,
    totalCostUSD: 365000,
    shiftCrewDirect: 8,
    color: '#3B82F6', // Blue
    machines: [
      { id: 'C.1.1.1', wbsCode: 'C.1.1.1', name: 'AGVs, Cell Tray Transfer', description: 'Automated tray movement from controlled store to line side', cycleTimeSec: 290, machinesCount: 11, unitRateUSD: 30000, totalCostUSD: 330000, status: 'running', utilizationPct: 88 },
      { id: 'C.1.1.2', wbsCode: 'C.1.1.2', name: 'Robotic Manipulator', description: 'Tray decant and cell presentation to build sequence', cycleTimeSec: 24, machinesCount: 1, unitRateUSD: 35000, totalCostUSD: 35000, status: 'running', utilizationPct: 92 },
      { id: 'C.1.1.3', wbsCode: 'C.1.1.3', name: 'Barcode & MES Registration', description: 'Serialisation and genealogy capture at induction', cycleTimeSec: 96, machinesCount: 4, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 85 },
      { id: 'C.1.1.4', wbsCode: 'C.1.1.4', name: 'Kitting & Sequencing Benches', description: 'Manual-assist benches feeding the build sequence', cycleTimeSec: 210, machinesCount: 8, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 80 },
    ]
  },
  {
    id: 'z2',
    name: 'Cell Conditioning, Grading & Sorting',
    wbsCode: 'Z2',
    description: 'Prismatic cell OCV and internal resistance grading (600 cells/hr), Hi-Pot screening, EIS characterisation, and atmospheric plasma cleaning.',
    machineUnitsCount: 31,
    totalCostUSD: 582000,
    shiftCrewDirect: 7,
    color: '#06B6D4', // Cyan
    machines: [
      { id: 'C.1.2.1', wbsCode: 'C.1.2.1', name: 'Battery Cell Sorting Machine', description: 'Prismatic OCV & IR grading at 600 cells/hr, 10 grade sorting', cycleTimeSec: 265, machinesCount: 10, unitRateUSD: 13200, totalCostUSD: 132000, status: 'running', utilizationPct: 94 },
      { id: 'C.1.2.2', wbsCode: 'C.1.2.2', name: 'Hi-Pot & Leakage Test', description: 'Dielectric withstand screen before build', cycleTimeSec: 180, machinesCount: 7, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 86 },
      { id: 'C.1.2.3', wbsCode: 'C.1.2.3', name: 'Electrochemical Impedance Spectroscopy', description: '1 kHz internal resistance characterisation', cycleTimeSec: 96, machinesCount: 4, unitRateUSD: 25000, totalCostUSD: 100000, status: 'running', utilizationPct: 89 },
      { id: 'C.1.2.4', wbsCode: 'C.1.2.4', name: 'Cell Surface Plasma Cleaning', description: 'Atmospheric plasma activation of bonding faces', cycleTimeSec: 240, machinesCount: 10, unitRateUSD: 35000, totalCostUSD: 350000, status: 'running', utilizationPct: 91 },
    ]
  },
  {
    id: 'z3',
    name: 'Stack Build, Pressing & Fire Protection',
    wbsCode: 'Z3',
    description: 'Six-axis tape application, prismatic cell stacking, 30kN hydraulic compression, pressure verification, and Aerogel fire retardant application.',
    machineUnitsCount: 22,
    totalCostUSD: 769000,
    shiftCrewDirect: 4,
    color: '#8B5CF6', // Purple
    machines: [
      { id: 'C.1.3.1', wbsCode: 'C.1.3.1', name: 'Cell Adhesion Tape Manipulator', description: 'Six axis robot applying structural adhesive tape', cycleTimeSec: 105, machinesCount: 4, unitRateUSD: 20000, totalCostUSD: 80000, status: 'running', utilizationPct: 87 },
      { id: 'C.1.3.2', wbsCode: 'C.1.3.2', name: 'Cell Stacking Machine', description: 'Prismatic cell stacking at 50 groups per hour', cycleTimeSec: 90, machinesCount: 4, unitRateUSD: 120000, totalCostUSD: 480000, status: 'running', utilizationPct: 95 },
      { id: 'C.1.3.3', wbsCode: 'C.1.3.3', name: 'Cell Stack Pressing Machine', description: 'Hydraulic press, 30 kN stack compression', cycleTimeSec: 62, machinesCount: 3, unitRateUSD: 7000, totalCostUSD: 21000, status: 'running', utilizationPct: 82 },
      { id: 'C.1.3.4', wbsCode: 'C.1.3.4', name: 'Cell Stack Pressure Test Gauge', description: 'Digital verification of stack compression force', cycleTimeSec: 45, machinesCount: 2, unitRateUSD: 40000, totalCostUSD: 80000, status: 'running', utilizationPct: 84 },
      { id: 'C.1.3.5', wbsCode: 'C.1.3.5', name: 'Fire Retardant Application', description: 'Aerogel barrier and retardant spray applicator', cycleTimeSec: 216, machinesCount: 9, unitRateUSD: 12000, totalCostUSD: 108000, status: 'running', utilizationPct: 90 },
    ]
  },
  {
    id: 'z4',
    name: 'Terminal Prep & Laser Welding',
    wbsCode: 'Z4',
    description: '50W Fibre laser oxide removal, 3kW fibre laser busbar welding of copper-aluminum laminated busbars, and CCD weld bead vision inspection.',
    machineUnitsCount: 7,
    totalCostUSD: 370000,
    shiftCrewDirect: 1,
    color: '#EF4444', // Red / High Precision
    machines: [
      { id: 'C.1.4.1', wbsCode: 'C.1.4.1', name: 'Cell Terminal Laser Cleaning 50W', description: 'Fibre laser oxide removal from terminals before welding', cycleTimeSec: 96, machinesCount: 4, unitRateUSD: 25000, totalCostUSD: 100000, status: 'running', utilizationPct: 93 },
      { id: 'C.1.4.2', wbsCode: 'C.1.4.2', name: 'Cell Bus-Bar Laser Welding 3kW', description: 'Fibre laser welding of copper aluminium laminated busbars', cycleTimeSec: 38, machinesCount: 2, unitRateUSD: 120000, totalCostUSD: 240000, status: 'bottleneck', utilizationPct: 98 },
      { id: 'C.1.4.3', wbsCode: 'C.1.4.3', name: 'Weld Bead Inspection Vision', description: 'Vision inspection of every weld bead', cycleTimeSec: 12, machinesCount: 1, unitRateUSD: 30000, totalCostUSD: 30000, status: 'running', utilizationPct: 90 },
    ]
  },
  {
    id: 'z5',
    name: 'Pack Integration, TIM & Sealing',
    wbsCode: 'Z5',
    description: 'Guided conveyor spine, cooling plate installation, precision TIM dispensing, laser profiling, PU foam gasket, curing tunnel, and cell-to-pack heavy duty robotic insertion.',
    machineUnitsCount: 35,
    totalCostUSD: 1172000,
    shiftCrewDirect: 3,
    color: '#10B981', // Emerald
    machines: [
      { id: 'C.1.5.1', wbsCode: 'C.1.5.1', name: 'Guided Conveyor System Spine', description: 'Single conveyance spine through integration cell', cycleTimeSec: 26, machinesCount: 1, unitRateUSD: 60000, totalCostUSD: 60000, status: 'running', utilizationPct: 96 },
      { id: 'C.1.5.2', wbsCode: 'C.1.5.2', name: 'Robotic Pack Cleaning & Dispense', description: 'Pre-bond surface preparation', cycleTimeSec: 30, machinesCount: 2, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 88 },
      { id: 'C.1.5.3', wbsCode: 'C.1.5.3', name: 'Cooling Plate Sub-Assembly', description: 'Extruded aluminium plate and glycol manifold fitting', cycleTimeSec: 30, machinesCount: 2, unitRateUSD: 55000, totalCostUSD: 110000, status: 'running', utilizationPct: 87 },
      { id: 'C.1.5.4', wbsCode: 'C.1.5.4', name: 'Thermal Interface Material Dispenser', description: 'Precision dispensing of thermal interface material', cycleTimeSec: 43, machinesCount: 2, unitRateUSD: 35000, totalCostUSD: 70000, status: 'running', utilizationPct: 89 },
      { id: 'C.1.5.5', wbsCode: 'C.1.5.5', name: 'Laser Profilometer (Bond Line)', description: 'Laser displacement verification of the bond line', cycleTimeSec: 12, machinesCount: 1, unitRateUSD: 45000, totalCostUSD: 45000, status: 'running', utilizationPct: 85 },
      { id: 'C.1.5.6', wbsCode: 'C.1.5.6', name: 'PU Gun IP67 Template Fixture', description: 'Two component foam in place gasket application', cycleTimeSec: 240, machinesCount: 10, unitRateUSD: 8000, totalCostUSD: 80000, status: 'running', utilizationPct: 91 },
      { id: 'C.1.5.7', wbsCode: 'C.1.5.7', name: 'Adhesive Curing Tunnel', description: 'Offline batch cure; 50 pack positions per tunnel', cycleTimeSec: 3600, machinesCount: 3, packsPerCycle: 50, unitRateUSD: 120000, totalCostUSD: 360000, status: 'running', utilizationPct: 93 },
      { id: 'C.1.5.8', wbsCode: 'C.1.5.8', name: 'Cover Sealing Torque Assembly', description: 'Direct current nutrunner sealing to controlled torque', cycleTimeSec: 30, machinesCount: 2, unitRateUSD: 13500, totalCostUSD: 27000, status: 'running', utilizationPct: 86 },
      { id: 'C.1.5.9', wbsCode: 'C.1.5.9', name: 'Cell-to-Pack Heavy Duty Robot', description: 'Heavy duty robot inserting cell stacks into the tray', cycleTimeSec: 300, machinesCount: 12, unitRateUSD: 35000, totalCostUSD: 420000, status: 'running', utilizationPct: 92 },
    ]
  },
  {
    id: 'z6',
    name: 'Electrical Integration, BMS & HV Termination',
    wbsCode: 'Z6',
    description: 'Manual series interconnection, BMS slave/master installation, HV cable routing and termination (largest manual attendance block on line), BMS test & calibration.',
    machineUnitsCount: 83,
    totalCostUSD: 86060,
    shiftCrewDirect: 47,
    color: '#F59E0B', // Amber
    machines: [
      { id: 'C.1.6.1', wbsCode: 'C.1.6.1', name: 'Bus Bar Circuit Installation', description: 'Manual workstation, series interconnection', cycleTimeSec: 150, machinesCount: 6, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 84 },
      { id: 'C.1.6.2', wbsCode: 'C.1.6.2', name: 'BMS Slave & Master Installation', description: 'Semi-automated assembly of control and sensing boards', cycleTimeSec: 525, machinesCount: 20, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 88 },
      { id: 'C.1.6.3', wbsCode: 'C.1.6.3', name: 'HV Cable Routing & Termination', description: 'Manual stations; largest single attendance block on line', cycleTimeSec: 1125, machinesCount: 43, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 92 },
      { id: 'C.1.6.4', wbsCode: 'C.1.6.4', name: 'BMS Tester', description: 'Functional test of assembled management system', cycleTimeSec: 180, machinesCount: 7, unitRateUSD: 10580, totalCostUSD: 74060, status: 'running', utilizationPct: 89 },
      { id: 'C.1.6.5', wbsCode: 'C.1.6.5', name: 'BMS Calibration', description: 'Calibration of state of charge and state of health algorithms', cycleTimeSec: 150, machinesCount: 6, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 86 },
      { id: 'C.1.6.6', wbsCode: 'C.1.6.6', name: 'Off-Gas Sensors Integration', description: 'Continuous off-gas monitoring at integration cell', cycleTimeSec: 26, machinesCount: 1, unitRateUSD: 12000, totalCostUSD: 12000, status: 'running', utilizationPct: 80 },
    ]
  },
  {
    id: 'z7',
    name: 'End-of-Line Validation, Ageing & Durability',
    wbsCode: 'Z7',
    description: 'Gross leak testing, IP67 pressure decay, dielectric Hi-Pot, 5-hour batch ageing cycling (ISO 2859-1 sample 6.76%), and 9-hour vibration testing (S-2 sample 0.42%).',
    machineUnitsCount: 78,
    totalCostUSD: 2766000,
    shiftCrewDirect: 3,
    color: '#EC4899', // Pink
    machines: [
      { id: 'C.1.7.1', wbsCode: 'C.1.7.1', name: 'Seal Leak Testing', description: 'Pneumatic fixture, gross leak screen', cycleTimeSec: 300, machinesCount: 12, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 85 },
      { id: 'C.1.7.2', wbsCode: 'C.1.7.2', name: 'IP67 Pressure Decay Tester', description: 'Pressure decay verification of ingress protection', cycleTimeSec: 300, machinesCount: 12, unitRateUSD: 18000, totalCostUSD: 216000, status: 'running', utilizationPct: 88 },
      { id: 'C.1.7.3', wbsCode: 'C.1.7.3', name: 'Hi-Potential & Insulation Tester', description: 'Dielectric withstand and insulation resistance', cycleTimeSec: 30, machinesCount: 2, unitRateUSD: 15000, totalCostUSD: 30000, status: 'running', utilizationPct: 90 },
      { id: 'C.1.7.4', wbsCode: 'C.1.7.4', name: 'Battery Batch Ageing Test Cycler', description: 'Five hour dwell on ISO 2859-1 sample of 6.76%', cycleTimeSec: 1217, machinesCount: 46, unitRateUSD: 30000, totalCostUSD: 1380000, status: 'running', utilizationPct: 95 },
      { id: 'C.1.7.5', wbsCode: 'C.1.7.5', name: 'Vibration Test Rig', description: 'Nine hour sequence on destructive S-2 sample of 0.42%', cycleTimeSec: 136, machinesCount: 6, unitRateUSD: 190000, totalCostUSD: 1140000, status: 'running', utilizationPct: 80 },
    ]
  },
  {
    id: 'z8',
    name: 'Labelling, Digital Passport & Release',
    wbsCode: 'Z8',
    description: 'Label printing, export crating, EU Battery Passport registry authoring, and UPS clean power dispatch release.',
    machineUnitsCount: 5,
    totalCostUSD: 18000,
    shiftCrewDirect: 1,
    color: '#6366F1', // Indigo
    lineType: 'EV',
    machines: [
      { id: 'C.1.8.1', wbsCode: 'C.1.8.1', name: 'Labelling & Pack Protection', description: 'Label printing, application and export crating preparation', cycleTimeSec: 12, machinesCount: 1, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 85 },
      { id: 'C.1.8.2', wbsCode: 'C.1.8.2', name: 'Report & Digital Battery Passport', description: 'Server and registry authoring for the product passport', cycleTimeSec: 60, machinesCount: 3, unitRateUSD: 0, totalCostUSD: 0, status: 'running', utilizationPct: 92 },
      { id: 'C.1.8.3', wbsCode: 'C.1.8.3', name: 'UPS 30 kVA', description: 'Uninterruptible supply to the traceability spine', cycleTimeSec: 0, machinesCount: 1, unitRateUSD: 18000, totalCostUSD: 18000, status: 'running', utilizationPct: 100 },
    ]
  },
  {
    id: 'z_bess',
    name: 'BESS Utility Container & Rack Integration',
    wbsCode: 'Z_BESS',
    description: 'Dedicated Battery Energy Storage System (BESS) line: 52S/104S high-voltage cell stack grouping, liquid cooling cold plate manifolding, 1500V DC busbar connection, master BMU/BCU rack integration, 5kV Hi-Pot isolation, and 20ft/40ft utility container cabinet assembly.',
    machineUnitsCount: 22,
    totalCostUSD: 1850000,
    shiftCrewDirect: 14,
    color: '#F59E0B', // Amber / BESS Industrial
    lineType: 'BESS',
    machines: [
      { id: 'C.2.1.1', wbsCode: 'C.2.1.1', name: 'BESS Cell Stack Stacking & Compression Rig', description: 'Heavy-duty 52S high-voltage cell stack compression & side plate laser riveting', cycleTimeSec: 180, machinesCount: 4, unitRateUSD: 95000, totalCostUSD: 380000, status: 'running', utilizationPct: 89 },
      { id: 'C.2.1.2', wbsCode: 'C.2.1.2', name: 'BESS Liquid Cooling Manifold Coupler', description: 'Dual glycol circuit quick-connect fitting, vacuum hold and pressure test (6 bar)', cycleTimeSec: 140, machinesCount: 3, unitRateUSD: 45000, totalCostUSD: 135000, status: 'running', utilizationPct: 86 },
      { id: 'C.2.1.3', wbsCode: 'C.2.1.3', name: '1500V DC Busbar Laser Welding Cell', description: 'High-current copper busbar laser welding for utility storage racks (up to 300A)', cycleTimeSec: 120, machinesCount: 3, unitRateUSD: 140000, totalCostUSD: 420000, status: 'running', utilizationPct: 92 },
      { id: 'C.2.1.4', wbsCode: 'C.2.1.4', name: 'BESS Master BMU/BCU Rack Controller Cell', description: 'Installation of high-voltage controller box, shunt resistor, and pyrofuse disconnect', cycleTimeSec: 210, machinesCount: 4, unitRateUSD: 25000, totalCostUSD: 100000, status: 'running', utilizationPct: 87 },
      { id: 'C.2.1.5', wbsCode: 'C.2.1.5', name: '5kV DC Dielectric Isolation & Pre-Charge Tester', description: 'High-voltage withstand, insulation resistance (>1000 MΩ), and CANbus telemetry check', cycleTimeSec: 160, machinesCount: 3, unitRateUSD: 65000, totalCostUSD: 195000, status: 'running', utilizationPct: 90 },
      { id: 'C.2.1.6', wbsCode: 'C.2.1.6', name: 'Utility Container 20ft/40ft Gantry Docking Bay', description: 'Heavy overhead gantry insertion of 8-16 BESS racks into ISO container cabinet with HVAC & aerosol suppression', cycleTimeSec: 600, machinesCount: 2, unitRateUSD: 240000, totalCostUSD: 480000, status: 'running', utilizationPct: 84 },
      { id: 'C.2.1.7', wbsCode: 'C.2.1.7', name: 'BESS Microgrid Grid Simulation Tester', description: 'Full container charge/discharge verification with bi-directional 1MW regenerative load inverter', cycleTimeSec: 900, machinesCount: 3, unitRateUSD: 46666, totalCostUSD: 140000, status: 'running', utilizationPct: 93 },
    ]
  }
];

export const WAREHOUSES: WarehouseInfo[] = [
  {
    id: 'wh-inbound-cells',
    name: 'Inbound Cell Warehouse (WH-1)',
    areaSqm: 12000,
    type: 'hazardous_cell',
    capacityUnits: 350000, // Cells for ~30 days of production
    currentStockPct: 78,
    description: 'Class 9 Hazardous material warehouse with 5-level seismic racking, FM-200 gas fire suppression, and temperature HVAC control. Houses bare LFP/NMC cells.',
    rackingCostUSD: 1150000,
    mheAssigned: ['4 Reach Trucks (VNA)', '11 Line-side AGVs', '2 Counterbalance Forklifts'],
    safetyRating: 'Class 9 HazMat / FM-200 Gas',
    daysOfBuffer: 30,
    dailyProductionTarget: 1183,
  },
  {
    id: 'wh-production-materials',
    name: 'Production Material Warehouse (WH-4)',
    areaSqm: 6000,
    type: 'non_live_material',
    capacityUnits: 45000, // Pallet positions for non-live components
    currentStockPct: 84,
    description: 'Dedicated warehouse for non-live production components: composite housings, cooling plates, busbars, structural adhesives, BMS boards, wiring harnesses, screws, and export crating.',
    rackingCostUSD: 650000,
    mheAssigned: ['4 Electric Counterbalance Forklifts', '10 Pallet Stacker Trolleys'],
    safetyRating: 'Standard Industrial ESD',
    daysOfBuffer: 21,
    dailyProductionTarget: 1183,
  },
  {
    id: 'wh-outbound-packs',
    name: 'Outbound Finished Pack Warehouse (WH-2)',
    areaSqm: 8000,
    type: 'outbound_pack',
    capacityUnits: 10000, // Defensible 4 to 8 days finished stock buffer (~1,183 packs/day)
    currentStockPct: 48,
    description: 'Finished Goods Warehouse with 10,000 pack buffer capacity (engineered for min. 4-day holding buffer). Features dedicated bays for 24-hr QA cure dwell, EAC export staging, and consolidated heavy-duty HGV logistics convoys.',
    rackingCostUSD: 720000,
    mheAssigned: ['4 Electric Counterbalance Forklifts', '7 Pallet Stackers', '2 Overhead Cranes (10t)'],
    safetyRating: 'Class 9 Staging / Gas Suppression',
    daysOfBuffer: 4.2,
    dailyProductionTarget: 1183,
  },
  {
    id: 'wh-bess-yard',
    name: 'BESS Cabinet Storage & Yard (WH-3)',
    areaSqm: 4000,
    type: 'bess_yard',
    capacityUnits: 250, // Containerized BESS units
    currentStockPct: 35,
    description: 'Outdoor heavy-load slab yard equipped with 30-tonne gantry cranes for containerized utility-scale Battery Energy Storage System (BESS) cabinets and high-capacity transformer skids.',
    rackingCostUSD: 660000,
    mheAssigned: ['2 Gantry Cranes (30t)', '2 Heavy Duty Flatbeds', '1 60t Weighbridge'],
    safetyRating: 'Heavy Industrial Reinforced Outdoor',
    daysOfBuffer: 14,
    dailyProductionTarget: 12,
  }
];

export const MHE_FLEET: MheItem[] = [
  { id: 'mhe-1', name: 'Electric Counterbalance Forklifts', wbsCode: 'E.1', qty: 8, unitRateUSD: 65000, totalCostUSD: 520000, type: 'forklift', utilizationPct: 82, status: 'active' },
  { id: 'mhe-2', name: 'Reach Trucks (High-Bay VNA)', wbsCode: 'E.2', qty: 4, unitRateUSD: 85000, totalCostUSD: 340000, type: 'reach_truck', utilizationPct: 88, status: 'active' },
  { id: 'mhe-3', name: 'Pallet Stacker Trolleys (Manual/Power)', wbsCode: 'E.3', qty: 17, unitRateUSD: 3000, totalCostUSD: 51000, type: 'stacker', utilizationPct: 75, status: 'active' },
  { id: 'mhe-4', name: 'AGVs, Cell Tray Transfer Line-Side', wbsCode: 'C.1.1.1', qty: 11, unitRateUSD: 30000, totalCostUSD: 330000, type: 'agv', utilizationPct: 91, status: 'active' },
  { id: 'mhe-5', name: 'Overhead Cranes (10 Tonne)', wbsCode: 'E.7', qty: 4, unitRateUSD: 210000, totalCostUSD: 840000, type: 'crane', utilizationPct: 65, status: 'active' },
  { id: 'mhe-6', name: 'Gantry Cranes (30 Tonne BESS Yard)', wbsCode: 'E.8', qty: 2, unitRateUSD: 180000, totalCostUSD: 360000, type: 'crane', utilizationPct: 58, status: 'active' },
  { id: 'mhe-7', name: 'Inbound & Outbound Weighbridge (60t)', wbsCode: 'E.9', qty: 1, unitRateUSD: 95000, totalCostUSD: 95000, type: 'weighbridge', utilizationPct: 70, status: 'active' },
];

export const PERSONNEL_SUMMARY: PersonnelCategory[] = [
  { id: 'L.1', ref: 'L.1', zoneOrFunction: 'Zone Z1: Inbound & Kitting', basis: 'Pooled attendance tray transfer & kitting', machineUnits: 24, attendedUnits: 23, shiftCrew: 8, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 51000 },
  { id: 'L.2', ref: 'L.2', zoneOrFunction: 'Zone Z2: Cell Conditioning & Sorting', basis: 'Sorter & plasma cleaning attendance', machineUnits: 31, attendedUnits: 31, shiftCrew: 7, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 44625 },
  { id: 'L.3', ref: 'L.3', zoneOrFunction: 'Zone Z3: Stack Build & Pressing', basis: 'Stacking & fire retardant load/unload', machineUnits: 22, attendedUnits: 22, shiftCrew: 4, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 25500 },
  { id: 'L.4', ref: 'L.4', zoneOrFunction: 'Zone Z4: Terminal Prep & Welding', basis: 'Fully automated laser cells, supervisory', machineUnits: 7, attendedUnits: 7, shiftCrew: 1, classification: 'Direct', monthlySalaryUSD: 907, annualPayrollUSD: 10884 },
  { id: 'L.5', ref: 'L.5', zoneOrFunction: 'Zone Z5: Pack Integration & Sealing', basis: 'Robotic insertion & dispensing supervision', machineUnits: 35, attendedUnits: 31, shiftCrew: 3, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 19125 },
  { id: 'L.6', ref: 'L.6', zoneOrFunction: 'Zone Z6: Electrical Integration & BMS', basis: 'Manual routing, board install & calibration', machineUnits: 83, attendedUnits: 82, shiftCrew: 47, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 299625 },
  { id: 'L.7', ref: 'L.7', zoneOrFunction: 'Zone Z7: End-of-Line Validation', basis: 'Ageing farm load/unload supervision', machineUnits: 78, attendedUnits: 26, shiftCrew: 3, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 19125 },
  { id: 'L.8', ref: 'L.8', zoneOrFunction: 'Zone Z8: Labelling & Release', basis: 'Single operator dispatch release', machineUnits: 5, attendedUnits: 4, shiftCrew: 1, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 6375 },
  { id: 'L.9', ref: 'L.9', zoneOrFunction: 'Pack Line Shift Leaders', basis: 'Span of 12 attended stations', machineUnits: 0, attendedUnits: 0, shiftCrew: 7, classification: 'Direct', monthlySalaryUSD: 907, annualPayrollUSD: 76188 },
  { id: 'L.10', ref: 'L.10', zoneOrFunction: 'BESS Cabinet Integration Line', basis: '7 integration & 15 validation stations', machineUnits: 22, attendedUnits: 22, shiftCrew: 14, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 89250 },
  { id: 'L.11', ref: 'L.11', zoneOrFunction: 'BESS Cabinet Shift Leaders', basis: 'Span of 12 stations', machineUnits: 0, attendedUnits: 0, shiftCrew: 2, classification: 'Direct', monthlySalaryUSD: 907, annualPayrollUSD: 21768 },
  { id: 'L.12', ref: 'L.12', zoneOrFunction: 'Enclosure Coating Shop', basis: 'Spray operations (manual/semi)', machineUnits: 0, attendedUnits: 0, shiftCrew: 12, classification: 'Direct', monthlySalaryUSD: 425, annualPayrollUSD: 76500 },
  { id: 'L.14', ref: 'L.14', zoneOrFunction: 'Maintenance & Reliability Techs', basis: '1 per 25 automated units + off-shift posts', machineUnits: 17, attendedUnits: 20, shiftCrew: 20, classification: 'Indirect', monthlySalaryUSD: 425, annualPayrollUSD: 127500 },
  { id: 'L.15', ref: 'L.15', zoneOrFunction: 'Quality, Lab & Metrology', basis: 'ISO 2859-1 sample + S-2 vibration sample', machineUnits: 16, attendedUnits: 19, shiftCrew: 19, classification: 'Indirect', monthlySalaryUSD: 907, annualPayrollUSD: 206796 },
  { id: 'L.16', ref: 'L.16', zoneOrFunction: 'Warehouse, Logistics & Inventory', basis: '30,000m² storage, 63 HGV movements/day', machineUnits: 22, attendedUnits: 26, shiftCrew: 26, classification: 'Indirect', monthlySalaryUSD: 255, annualPayrollUSD: 79560 },
  { id: 'L.17', ref: 'L.17', zoneOrFunction: 'Security & Class 9 Store Guards', basis: '8 fixed posts over 3.2km perimeter, 3 shifts', machineUnits: 27, attendedUnits: 31, shiftCrew: 31, classification: 'Indirect', monthlySalaryUSD: 255, annualPayrollUSD: 94860 },
  { id: 'L.21', ref: 'L.21', zoneOrFunction: 'Engineering, Process & Automation', basis: 'Robotics, controls, electrical & coating eng.', machineUnits: 16, attendedUnits: 17, shiftCrew: 17, classification: 'Indirect', monthlySalaryUSD: 907, annualPayrollUSD: 185028 },
  { id: 'L.25', ref: 'L.25', zoneOrFunction: 'Executive Management & Plant Directors', basis: 'Plant director and 6 functional heads', machineUnits: 7, attendedUnits: 7, shiftCrew: 7, classification: 'Indirect', monthlySalaryUSD: 2100, annualPayrollUSD: 176400 },
];

export const TARIFF_SCHEDULE: TariffPeriod[] = [
  { id: 'tariff-offpeak', name: 'Off-Peak Window', startHour: 0, endHour: 6, rateUGX: 188.7, rateUSD: 0.050, recommendedTask: 'Run high-draw 5-hr Battery Ageing Cyclers (46 units) and 9-hr Vibration Rigs' },
  { id: 'tariff-shoulder', name: 'Shoulder Window', startHour: 6, endHour: 18, rateUGX: 207.7, rateUSD: 0.055, recommendedTask: 'Main Production Shift (Cell sorting, laser welding, conveyor, assembly & kitting)' },
  { id: 'tariff-peak', name: 'Peak Window', startHour: 18, endHour: 24, rateUGX: 233.2, rateUSD: 0.061, recommendedTask: 'Shift handover, maintenance routines, low-power buffer charging and data sync' },
];

// CapEx breakdown, previously hardcoded inside CapExCostingModel.tsx — now a single source of truth.
// `pct` is intentionally NOT stored here: it's always derived from costUSD / total at render time
// so it can never drift out of sync when a line item is edited.
export const CAPEX_ITEMS: CapExItem[] = [
  { id: 'capex-buildings', code: 'B.1', category: 'Buildings & Civil Infrastructure', costUSD: 67240000, color: '#3B82F6' },
  { id: 'capex-process-equip', code: 'B.2', category: 'Process Lines & Testing Equipment', costUSD: 30089850, color: '#10B981' },
  { id: 'capex-utilities', code: 'B.3', category: 'Plant Utilities & Substation', costUSD: 6920000, color: '#F59E0B' },
  { id: 'capex-land', code: 'B.4', category: 'Land Acquisition (6.7 Ha Katuugo)', costUSD: 3800000, color: '#8B5CF6' },
  { id: 'capex-licensing', code: 'B.5', category: 'Licensing, Permits & ISO Certification', costUSD: 2830000, color: '#EC4899' },
  { id: 'capex-preop', code: 'B.6', category: 'Pre-Operational Commissioning & Ramp', costUSD: 9680000, color: '#06B6D4' },
  { id: 'capex-contingency', code: 'B.7', category: 'Contingency Allowance (10%)', costUSD: 12748000, color: '#64748B' },
  { id: 'capex-mhe', code: 'B.8', category: 'MHE Fleet & AGV Systems', costUSD: 6922150, color: '#EF4444' },
];
