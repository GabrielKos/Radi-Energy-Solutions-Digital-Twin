import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessZone, WarehouseInfo, SimulationState, MheItem, ThemeMode } from '../types/plant';
import {
  Layers,
  Settings,
  Truck,
  RotateCcw,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Cpu,
  Package,
  Activity,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Building2,
  Lock,
  Unlock,
  Move,
  Info
} from 'lucide-react';
import plantOpsAerialImg from '../assets/images/plant_ops_aerial_layout_1786912839030.jpg';

interface PlantLayout2DProps {
  zones: ProcessZone[];
  warehouses: WarehouseInfo[];
  simState: SimulationState;
  setSimState?: React.Dispatch<React.SetStateAction<SimulationState>>;
  mheFleet?: MheItem[];
  onSelectZone?: (zoneId: string) => void;
  onSelectWarehouse?: (whId: string) => void;
  theme?: ThemeMode;
}

interface CanvasNode {
  id: string;
  label: string;
  type: 'IO' | 'M' | 'B'; // IO = Dock, M = Machine, B = Buffer
  x: number;
  y: number;
  w: number;
  h: number;
  cap: number;
  inventory: number;
  auxInventory?: number;
  processingTime: number;
  currentTimer: number;
  next: string[];
  status: 'idle' | 'working' | 'holding' | 'blocked' | 'defect';
  isTransformer?: boolean;
  unit: string;
  zoneId: string;
}

interface Particle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  progress: number;
  type: 'cell' | 'module' | 'pack' | 'tray';
}

interface TruckVehicle {
  id: string;
  type: 'inbound_cell' | 'material_tray' | 'outbound_pack';
  x: number;
  y: number;
  state: 'arriving' | 'docked' | 'departing';
  timer: number;
  batchSize: number;
}

interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
}

export const PlantLayout2D: React.FC<PlantLayout2DProps> = ({
  zones,
  warehouses,
  simState,
  setSimState,
  mheFleet = [],
  onSelectZone,
  onSelectWarehouse,
  theme = 'dark',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Controller Sidebar Drawer State (default open on desktop, closed on mobile)
  const [isControlPanelOpen, setIsControlPanelOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  });
  const [activeControlTab, setActiveControlTab] = useState<'capacity' | 'logistics' | 'cycles' | 'engine'>('capacity');

  // Mobile Top HUD Expansion State
  const [isHudExpanded, setIsHudExpanded] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 768 : false;
  });

  // Selected Node / Zone Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // View Camera State (Pan & Zoom) - Centered Default around (1780, 2625)
  const [camera, setCamera] = useState<{ x: number; y: number; scale: number }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const h = typeof window !== 'undefined' ? window.innerHeight - 140 : 800;
    const scale = Math.min(Math.max(Math.min((w - 40) / 3400, (h - 40) / 1350), 0.18), 0.52);
    return {
      x: Math.round(w / 2 - 1780 * scale),
      y: Math.round(h / 2 - 2625 * scale),
      scale,
    };
  });
  const hasInitializedCameraRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch Screen Gestures (Pan, Pinch to Zoom, Tap Station)
  const touchStartRef = useRef<{ x: number; y: number; dist?: number }>({ x: 0, y: 0 });
  const touchStartTimeRef = useRef<number>(0);

  // Station Re-arrangement Dragging & Lock State
  const [isLayoutLocked, setIsLayoutLocked] = useState<boolean>(true); // Default LOCKED to prevent accidental moves
  const draggingNodeIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedNodeRef = useRef<boolean>(false);
  const dragStartScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isNodeDragging, setIsNodeDragging] = useState<boolean>(false);

  // Display Toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [showTrucks, setShowTrucks] = useState<boolean>(true);
  const [isRebuildingLayout, setIsRebuildingLayout] = useState<boolean>(false);

  // Dynamic Capacity & BOM Local Controls
  const [gwhTarget, setGwhTarget] = useState<number>(simState.annualGwhTarget || 10);
  const [packKwh, setPackKwh] = useState<number>(simState.packKwhCapacity || 35);
  const [packsPerBess, setPacksPerBess] = useState<number>(simState.packsPerBessContainer || 24);
  const [shiftsCount, setShiftsCount] = useState<number>(simState.operatingShiftsPerDay || 1);
  const [shiftHours, setShiftHours] = useState<number>(simState.shiftLengthHours || 10);
  const [cellsPerPack, setCellsPerPack] = useState<number>(simState.cellsPerPackBom || 108);

  // Supply Chain Logistics Controls
  const [inboundRate, setInboundRate] = useState<number>(simState.inboundTruckRatePerHour || 2.0);
  const [cellsPerInboundTruck, setCellsPerInboundTruck] = useState<number>(simState.cellsPerInboundTruck || 25000);
  const [materialRate, setMaterialRate] = useState<number>(1.5);
  const [outboundBatch, setOutboundBatch] = useState<number>(simState.outboundDispatchBatchSize || 30);

  // Machine Cycle Time Controls
  const [stackerCycle, setStackerCycle] = useState<number>(simState.stackerCycleTimeSec || 120);
  const [weldCycle, setWeldCycle] = useState<number>(simState.weldCycleTimeSec || 25);
  const [cyclerCycle, setCyclerCycle] = useState<number>(simState.eolCyclerTimeSec || 180);
  const [defectRate, setDefectRate] = useState<number>(simState.defectRejectRatePct || 2.5);

  // Live Calculated Target KPI Preview
  const annualPacksReq = Math.ceil((gwhTarget * 1000000) / Math.max(1, packKwh));
  const dailyPacksReq = Math.ceil(annualPacksReq / 240); // 240 operating days
  const shiftPacksReq = Math.ceil(dailyPacksReq / Math.max(1, shiftsCount));
  const requiredLineTakt = parseFloat(((shiftHours * 3600) / Math.max(1, shiftPacksReq)).toFixed(2));

  // Auto-Scaled Machine Threads
  const tOCV = Math.max(1, Math.ceil(0.1 / requiredLineTakt));
  const tStack = Math.max(1, Math.ceil(stackerCycle / requiredLineTakt));
  const tCln = Math.max(1, Math.ceil(15 / requiredLineTakt));
  const tFpc = Math.max(1, Math.ceil(20 / requiredLineTakt));
  const tWeld = Math.max(1, Math.ceil(weldCycle / requiredLineTakt));
  const tCcd = Math.max(1, Math.ceil(10 / requiredLineTakt));
  const tCycler = Math.max(1, Math.ceil(cyclerCycle / requiredLineTakt));

  // Factory Dimensions
  const FACTORY_W = 3600;
  const FACTORY_H = Math.max(1800, 450 + Math.max(tStack, tWeld, tCycler) * 110);

  // Refs for Animation Loop State
  const nodesRef = useRef<{ [key: string]: CanvasNode }>({});
  const linksRef = useRef<{ from: string; to: string }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const trucksRef = useRef<TruckVehicle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const plantZonesRef = useRef<{ [key: string]: string[] }>({});
  const statsRef = useRef<{ cellsIn: number; packsOut: number }>({ cellsIn: 0, packsOut: 0 });

  // Timers for logistics arrivals
  const inboundTimerRef = useRef<number>(5);
  const materialTimerRef = useRef<number>(10);

  // Build / Re-provision Factory Model Function
  const buildFactoryModel = useCallback(() => {
    const nodes: { [key: string]: CanvasNode } = {};
    const links: { from: string; to: string }[] = [];

    const addNode = (
      id: string,
      label: string,
      type: 'IO' | 'M' | 'B',
      x: number,
      y: number,
      cap: number,
      baseTime: number,
      zoneId: string,
      isTransformer = false,
      unit = 'Cells'
    ) => {
      nodes[id] = {
        id,
        label,
        type,
        x,
        y,
        w: type === 'B' ? 64 : 48,
        h: type === 'B' ? 64 : 48,
        cap,
        inventory: 0,
        processingTime: baseTime,
        currentTimer: 0,
        next: [],
        status: 'idle',
        isTransformer,
        unit,
        zoneId,
      };
    };

    const addLink = (fromId: string, toId: string) => {
      if (!nodes[fromId] || !nodes[toId]) return;
      links.push({ from: fromId, to: toId });
      if (!nodes[fromId].next.includes(toId)) {
        nodes[fromId].next.push(toId);
      }
    };

    const addParallelBlock = (
      prefix: string,
      label: string,
      type: 'M' | 'B',
      baseX: number,
      centerY: number,
      count: number,
      cap: number,
      time: number,
      zoneId: string,
      spacingY = 90,
      isTransformer = false,
      unit = 'Cells'
    ) => {
      const startY = centerY - ((count - 1) * spacingY) / 2;
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const id = `${prefix}${i + 1}`;
        addNode(id, `${label} #${i + 1}`, type, baseX, startY + i * spacingY, cap, time, zoneId, isTransformer, unit);
        ids.push(id);
      }
      return ids;
    };

    const midY = FACTORY_H / 2 - 220;

    // --- ZONE 1: CELL WAREHOUSE & INBOUND OCV (Z1) ---
    addNode('W01', 'WH-1 Inbound Cell Dock', 'IO', 120, midY, 150000, 0.01, 'z1', false, 'Cells');
    addNode('W02', 'Cell Depalletizer Robot', 'M', 280, midY, 200, 0.01, 'z1', false, 'Cells');
    addNode('B01', 'Cell Storage Buffer', 'B', 440, midY, 10000, 0.01, 'z1', false, 'Cells');

    const ocvNodes = addParallelBlock('OCV_', 'Cell OCV Tester', 'M', 640, midY, tOCV, 1, 0.1, 'z1', 80, false, 'Cells');
    addNode('C_Sort', 'OCV Sort Gateway', 'M', 840, midY, 20, 0.1, 'z1', false, 'Cells');
    addNode('Q_Bay', 'Defect Cell Reject Bay', 'B', 840, midY + 130, 100, 0.1, 'z1', false, 'Cells');
    addNode('C_Clean', 'Plasma Surface Cleaner', 'M', 1000, midY, 20, 0.1, 'z1', false, 'Cells');
    addNode('B02', 'Pre-Stack Cell Buffer', 'B', 1160, midY, 500, 1, 'z1', false, 'Cells');

    // --- ZONE 2: MODULE STACKING & BANDING (Z2) ---
    const stackCap = cellsPerPack * 2;
    const stackNodes = addParallelBlock(
      'S_BOT_',
      'Stacker Robot',
      'M',
      1360,
      midY,
      tStack,
      stackCap,
      stackerCycle,
      'z2',
      90,
      true,
      'Cells'
    );
    addNode('S_Comp', 'Compress & Banding', 'M', 1560, midY, 4, 8, 'z2', false, 'Modules');
    addNode('B03', 'Pre-Weld Module Buffer', 'B', 1720, midY, 25, 1, 'z2', false, 'Modules');

    // --- ZONE 3: CLEAN & DRY ROOM BUSBAR WELDING (Z3) ---
    const clnNodes = addParallelBlock('W_CLN_', 'Pole Laser Cleaner', 'M', 1880, midY, tCln, 2, 15, 'z3', 95, false, 'Modules');
    addNode('B_C1', 'Clean Buffer #1', 'B', 2000, midY, 10, 1, 'z3', false, 'Modules');

    const fpcNodes = addParallelBlock('W_FPC_', 'Busbar Inserter', 'M', 2120, midY, tFpc, 2, 20, 'z3', 95, false, 'Modules');
    addNode('B_C2', 'Clean Buffer #2', 'B', 2240, midY, 10, 1, 'z3', false, 'Modules');

    const weldNodes = addParallelBlock('W_L_', '3kW Laser Welder', 'M', 2360, midY, tWeld, 2, weldCycle, 'z3', 95, false, 'Modules');
    addNode('B_C3', 'Clean Buffer #3', 'B', 2480, midY, 10, 1, 'z3', false, 'Modules');

    const ccdNodes = addParallelBlock('W_CCD_', 'Bead Inspection', 'M', 2600, midY, tCcd, 2, 10, 'z3', 95, false, 'Modules');
    addNode('CCD_Sort', 'Bead Quality Gateway', 'M', 2720, midY, 10, 0.1, 'z3', false, 'Modules');
    addNode('Q_Bead_Reject', 'Bead Reject Quarantine', 'B', 2720, midY + 130, 50, 0.1, 'z3', false, 'Modules');
    addNode('B04', 'Module Buffer', 'B', 2860, midY, 30, 1, 'z3', false, 'Modules');

    // --- ZONE 4: PACK MARRIAGE & ASSEMBLY (Z4 - Lower Serpentine Track) ---
    const lowerY = midY + 420;
    addNode('P01', 'WH-4 Material Tray Unloader', 'M', 3020, lowerY, 5, 5, 'z4', false, 'Trays');
    addNode('P02', 'TIM Thermal Paste Dispenser', 'M', 2860, lowerY, 5, 10, 'z4', false, 'Trays');

    addNode('M01', 'Pack Marriage Robot', 'M', 2700, lowerY, 2, 15, 'z4', false, 'Packs');
    nodes['M01'].auxInventory = 0;

    addNode('M02', 'Structural Fastening Cell', 'M', 2500, lowerY, 2, 20, 'z4', false, 'Packs');
    addNode('M03', 'HV/LV Harnessing Line', 'M', 2300, lowerY, 2, 25, 'z4', false, 'Packs');
    addNode('M04', 'BMS Controller Integration', 'M', 2100, lowerY, 2, 15, 'z4', false, 'Packs');
    addNode('B05', 'Pre-Seal Pack Buffer', 'B', 1940, lowerY, 20, 1, 'z4', false, 'Packs');
    addNode('E01', 'Pack Cover & Seal Station', 'M', 1780, lowerY, 2, 25, 'z4', false, 'Packs');

    // --- ZONE 5: END OF LINE VALIDATION (Z5) ---
    addNode('B06', 'EOL Test Buffer', 'B', 1620, lowerY, 30, 1, 'z5', false, 'Packs');
    addNode('T01', 'Helium Leak Detector', 'M', 1460, lowerY, 2, 20, 'z5', false, 'Packs');
    addNode('T02', 'Hipot Electrical Isolation', 'M', 1300, lowerY, 2, 15, 'z5', false, 'Packs');

    // "E"-Type Multi-Tier Comb / Hatch Array for EOL Battery Cyclers
    // Distribute cyclers across 3 horizontal prongs/tiers:
    // Tier A (Top Arm, y = lowerY - 100) -> High-Rate Formation & Pre-Charge
    // Tier B (Mid Arm, y = lowerY)       -> Retention Aging & OCV Drift
    // Tier C (Bot Arm, y = lowerY + 100) -> Capacity Verification & DCIR
    const eolArms = 3;
    const cyclerNodes: string[] = [];
    const cyclerPerArm = Math.ceil(tCycler / eolArms);
    const cyclerSpacingX = 80;
    const cyclerArmSpacingY = 100;
    const cyclerBaseX = 1170;
    const cyclerBaseY = lowerY;

    for (let i = 0; i < tCycler; i++) {
      const arm = i % eolArms; // 0 (Tier A Top), 1 (Tier B Mid), 2 (Tier C Bot)
      const slot = Math.floor(i / eolArms); // 0, 1, 2...
      const cycX = cyclerBaseX - slot * cyclerSpacingX;
      const cycY = cyclerBaseY + (arm - 1) * cyclerArmSpacingY;
      const id = `CY_${i + 1}`;
      const tierLabel = arm === 0 ? 'Tier A Form' : arm === 1 ? 'Tier B Age' : 'Tier C Cap';
      addNode(id, `EOL Cycler #${i + 1} (${tierLabel})`, 'M', cycX, cycY, 1, cyclerCycle, 'z5', false, 'Packs');
      cyclerNodes.push(id);
    }

    const minCycX = cyclerBaseX - (cyclerPerArm - 1) * cyclerSpacingX;
    const qgX = Math.min(minCycX - 100, 720);
    addNode('T_QG', 'Final Quality Gate (QG)', 'M', qgX, lowerY, 2, 10, 'z5', false, 'Packs');
    addNode('W03_Out', 'WH-2 Pack Racking Store', 'B', qgX - 180, lowerY, 2000, 1, 'z8', false, 'Packs');
    addNode('W04_Out', 'WH-2 Outbound Dispatch Dock', 'IO', qgX - 360, lowerY, 1000, 1, 'z8', false, 'Packs');

    // --- ZONE 7: BESS UTILITY INTEGRATION LINE (Z_BESS) ---
    // Physically fed directly from Pack Marriage Robot M01 via dedicated 20-Pack Buffer Bank
    const bessY = lowerY + 340;
    addNode('B_BESS_Buf', 'BESS Pack Buffer Bank (Min. 20 Packs)', 'B', 2700, lowerY + 160, 50, 1, 'z_bess', false, 'Packs');
    addNode('BESS_Stack', 'BESS Module/Pack Stacking & Rigging', 'M', 2700, bessY, 2, 45, 'z_bess', false, 'Packs');
    addNode('BESS_Plate', 'Cold Plate Cooling Integration', 'M', 2500, bessY, 2, 35, 'z_bess', false, 'Racks');
    addNode('BESS_Weld', '1500V DC Busbar Welder', 'M', 2300, bessY, 2, 40, 'z_bess', false, 'Racks');
    addNode('BESS_BMS', 'HV String BMS Controller Cell', 'M', 2100, bessY, 2, 30, 'z_bess', false, 'Racks');
    addNode('BESS_Test', '1500V Megawatt Hipot Cycler', 'M', 1900, bessY, 2, 120, 'z_bess', false, 'Racks');
    addNode('BESS_Gantry', 'Twin 30T Gantry Crane Bay', 'M', 1700, bessY, 2, 60, 'z_bess', false, 'Containers');
    addNode('W05_BESS', 'WH-3 BESS Container Staging Yard', 'IO', 1480, bessY, 50, 1, 'z_bess', false, 'Containers');

    // --- WH-4 MATERIAL DOCK ---
    addNode('W05_Mat_In', 'WH-4 Material Delivery Dock', 'IO', 3220, lowerY, 15000, 0.01, 'z4', false, 'Trays');
    addNode('B_Mat', 'WH-4 Non-Live Component Store', 'B', 3120, lowerY, 2000, 0.01, 'z4', false, 'Trays');

    // Linkages
    addLink('W01', 'W02');
    addLink('W02', 'B01');
    ocvNodes.forEach(id => addLink('B01', id));
    ocvNodes.forEach(id => addLink(id, 'C_Sort'));
    addLink('C_Sort', 'C_Clean');
    addLink('C_Sort', 'Q_Bay');
    addLink('C_Clean', 'B02');

    stackNodes.forEach(id => addLink('B02', id));
    stackNodes.forEach(id => addLink(id, 'S_Comp'));
    addLink('S_Comp', 'B03');

    clnNodes.forEach(id => addLink('B03', id));
    clnNodes.forEach(id => addLink(id, 'B_C1'));

    fpcNodes.forEach(id => addLink('B_C1', id));
    fpcNodes.forEach(id => addLink(id, 'B_C2'));

    weldNodes.forEach(id => addLink('B_C2', id));
    weldNodes.forEach(id => addLink(id, 'B_C3'));

    ccdNodes.forEach(id => addLink('B_C3', id));
    ccdNodes.forEach(id => addLink(id, 'CCD_Sort'));
    addLink('CCD_Sort', 'B04');
    addLink('CCD_Sort', 'Q_Bead_Reject');

    // Branch to EV Pack Assembly
    addLink('W05_Mat_In', 'B_Mat');
    addLink('B_Mat', 'P01');
    addLink('P01', 'P02');
    addLink('P02', 'M01');

    addLink('B04', 'M01');
    addLink('M01', 'M02');
    addLink('M02', 'M03');
    addLink('M03', 'M04');
    addLink('M04', 'B05');
    addLink('B05', 'E01');
    addLink('E01', 'B06');

    addLink('B06', 'T01');
    addLink('T01', 'T02');

    cyclerNodes.forEach(id => addLink('T02', id));
    cyclerNodes.forEach(id => addLink(id, 'T_QG'));

    addLink('T_QG', 'W03_Out');
    addLink('W03_Out', 'W04_Out');

    // Branch to BESS Integration Line (Fed directly from Pack Marriage M01 through Buffer Bank)
    addLink('M01', 'B_BESS_Buf');
    addLink('B_BESS_Buf', 'BESS_Stack');
    addLink('BESS_Stack', 'BESS_Plate');
    addLink('BESS_Plate', 'BESS_Weld');
    addLink('BESS_Weld', 'BESS_BMS');
    addLink('BESS_BMS', 'BESS_Test');
    addLink('BESS_Test', 'BESS_Gantry');
    addLink('BESS_Gantry', 'W05_BESS');

    // Plant zones definition mapping
    plantZonesRef.current = {
      'Z1: CELL RECEIVING & OCV SORTING': ['W01', 'W02', 'B01', ...ocvNodes, 'C_Sort', 'Q_Bay', 'C_Clean', 'B02'],
      'Z2: MODULE STACKING & BANDING': [...stackNodes, 'S_Comp', 'B03'],
      'Z3: CLEANROOM LASER BUSBAR WELDING': [...clnNodes, 'B_C1', ...fpcNodes, 'B_C2', ...weldNodes, 'B_C3', ...ccdNodes, 'CCD_Sort', 'Q_Bead_Reject', 'B04'],
      'Z4: PACK MARRIAGE & ASSEMBLY': ['W05_Mat_In', 'B_Mat', 'P01', 'P02', 'M01', 'M02', 'M03', 'M04', 'B05', 'E01'],
      'Z5: END-OF-LINE TESTING & QUALITY': ['B06', 'T01', 'T02', ...cyclerNodes, 'T_QG'],
      'Z8: PACKAGING & FINISHED STORE (4-DAY BUFFER)': ['W03_Out', 'W04_Out'],
      'Z_BESS: BESS CONTAINER & RACK INTEGRATION': ['B_BESS_Buf', 'BESS_Stack', 'BESS_Plate', 'BESS_Weld', 'BESS_BMS', 'BESS_Test', 'BESS_Gantry', 'W05_BESS'],
    };

    // Store in refs
    nodesRef.current = nodes;
    linksRef.current = links;

    // Initial stock
    nodes['W01'].inventory = 120000;
    nodes['B01'].inventory = 4500;
    nodes['B02'].inventory = 250;
    nodes['B03'].inventory = 12;
    nodes['B04'].inventory = 15;
    nodes['B_BESS_Buf'].inventory = 20; // Min. 20 Pack buffer bank initialized
    nodes['B_Mat'].inventory = 120;
    nodes['W03_Out'].inventory = 280;
  }, [FACTORY_H, stackerCycle, weldCycle, cyclerCycle, requiredLineTakt, cellsPerPack, tOCV, tStack, tCln, tFpc, tWeld, tCcd, tCycler]);

  // Apply Capacity Settings Handler
  const handleApplyCapacity = () => {
    setIsRebuildingLayout(true);
    if (setSimState) {
      setSimState(prev => ({
        ...prev,
        annualGwhTarget: gwhTarget,
        packKwhCapacity: packKwh,
        packsPerBessContainer: packsPerBess,
        operatingShiftsPerDay: shiftsCount,
        shiftLengthHours: shiftHours,
        cellsPerPackBom: cellsPerPack,
        targetPacks: shiftPacksReq,
        currentTaktSec: requiredLineTakt,
        inboundTruckRatePerHour: inboundRate,
        cellsPerInboundTruck: cellsPerInboundTruck,
        outboundDispatchBatchSize: outboundBatch,
        stackerCycleTimeSec: stackerCycle,
        weldCycleTimeSec: weldCycle,
        eolCyclerTimeSec: cyclerCycle,
        defectRejectRatePct: defectRate,
      }));
    }

    setTimeout(() => {
      buildFactoryModel();
      setIsRebuildingLayout(false);
    }, 400);
  };

  // Rebuild factory on initial load or parameter change
  useEffect(() => {
    buildFactoryModel();
  }, [buildFactoryModel]);

  // Canvas Mouse Pan, Zoom, and Node Dragging / Rearrangement Handling
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - camera.x) / camera.scale;
    const worldY = (e.clientY - rect.top - camera.y) / camera.scale;

    dragStartScreenRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedNodeRef.current = false;

    // Check if clicking on any node
    let clickedNodeId: string | null = null;
    for (const id in nodesRef.current) {
      const n = nodesRef.current[id];
      if (
        worldX >= n.x - n.w / 2 &&
        worldX <= n.x + n.w / 2 &&
        worldY >= n.y - n.h / 2 &&
        worldY <= n.y + n.h / 2
      ) {
        clickedNodeId = id;
        break;
      }
    }

    // Only allow dragging nodes if Layout Edit Mode is unlocked!
    if (!isLayoutLocked && clickedNodeId) {
      draggingNodeIdRef.current = clickedNodeId;
      const targetNode = nodesRef.current[clickedNodeId];
      dragOffsetRef.current = { x: worldX - targetNode.x, y: worldY - targetNode.y };
      setIsNodeDragging(true);
    } else {
      // Locked layout or background canvas pan
      setIsDragging(true);
      setDragStart({ x: e.clientX - camera.x, y: e.clientY - camera.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - camera.x) / camera.scale;
    const worldY = (e.clientY - rect.top - camera.y) / camera.scale;

    if (!isLayoutLocked && draggingNodeIdRef.current) {
      const dist = Math.hypot(
        e.clientX - dragStartScreenRef.current.x,
        e.clientY - dragStartScreenRef.current.y
      );
      if (dist > 3) {
        hasDraggedNodeRef.current = true;
      }
      const n = nodesRef.current[draggingNodeIdRef.current];
      if (n) {
        n.x = Math.round(worldX - dragOffsetRef.current.x);
        n.y = Math.round(worldY - dragOffsetRef.current.y);
      }
    } else if (isDragging) {
      setCamera(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    } else {
      // Check node hovering for cursor feedback
      let foundHover: string | null = null;
      for (const id in nodesRef.current) {
        const n = nodesRef.current[id];
        if (
          worldX >= n.x - n.w / 2 &&
          worldX <= n.x + n.w / 2 &&
          worldY >= n.y - n.h / 2 &&
          worldY <= n.y + n.h / 2
        ) {
          foundHover = id;
          break;
        }
      }
      setHoveredNodeId(foundHover);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingNodeIdRef.current) {
      const nodeId = draggingNodeIdRef.current;
      if (!hasDraggedNodeRef.current) {
        // Direct click without dragging -> select node for inspector!
        setSelectedNodeId(nodeId);
        const node = nodesRef.current[nodeId];
        if (node && onSelectZone) {
          onSelectZone(node.zoneId);
        }
      } else {
        // Station rearranged feedback
        floatingTextsRef.current.push({
          text: `Station ${nodeId} Repositioned`,
          x: nodesRef.current[nodeId]?.x || 0,
          y: (nodesRef.current[nodeId]?.y || 0) - 35,
          color: '#3B82F6',
          life: 2.0,
        });
      }
      draggingNodeIdRef.current = null;
      hasDraggedNodeRef.current = false;
      setIsNodeDragging(false);
    } else if (isDragging) {
      // In locked mode, check if this was a fast click on a station (mouse moved < 4px)
      const dist = Math.hypot(
        e.clientX - dragStartScreenRef.current.x,
        e.clientY - dragStartScreenRef.current.y
      );
      if (dist <= 4) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const worldX = (e.clientX - rect.left - camera.x) / camera.scale;
          const worldY = (e.clientY - rect.top - camera.y) / camera.scale;
          for (const id in nodesRef.current) {
            const n = nodesRef.current[id];
            if (
              worldX >= n.x - n.w / 2 &&
              worldX <= n.x + n.w / 2 &&
              worldY >= n.y - n.h / 2 &&
              worldY <= n.y + n.h / 2
            ) {
              setSelectedNodeId(id);
              const node = nodesRef.current[id];
              if (node && onSelectZone) {
                onSelectZone(node.zoneId);
              }
              break;
            }
          }
        }
      }
    }
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setCamera(prev => {
      const newScale = Math.max(0.2, Math.min(2.5, prev.scale * zoomFactor));
      return {
        scale: newScale,
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
      };
    });
  };

  // Auto-Center & Fit Plant Floor in Workspace (Centered at X: 1780, Y: 2625)
  const fitCameraToPlantFloor = useCallback((customW?: number, customH?: number) => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const w = customW || canvas?.width || (parent ? parent.clientWidth : window.innerWidth) || 1400;
    const h = customH || canvas?.height || (parent ? parent.clientHeight : window.innerHeight) || 800;

    // Plant layout spans X: ~60 to ~3400 (width ~ 3340), Y: ~1900 to ~3250 (height ~ 1350)
    const plantW = 3400;
    const plantH = 1350;
    const paddingX = 60;
    const paddingY = 60;

    const scaleX = (w - paddingX * 2) / Math.max(100, plantW);
    const scaleY = (h - paddingY * 2) / Math.max(100, plantH);
    const optimalScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 0.55);

    // Target center coordinates specified by engineering blueprint
    const targetCenterX = 1780;
    const targetCenterY = 2625;

    const newCam = {
      x: Math.round(w / 2 - targetCenterX * optimalScale),
      y: Math.round(h / 2 - targetCenterY * optimalScale),
      scale: optimalScale,
    };

    setCamera(newCam);
    return newCam;
  }, []);

  // Reset Factory Floor Layout Positions
  const handleResetLayout = () => {
    buildFactoryModel();
    floatingTextsRef.current.push({
      text: 'Floor Layout Reset to Default',
      x: 1780,
      y: 2525,
      color: '#10B981',
      life: 2.5,
    });
  };

  // Reset & Center Camera View
  const handleResetCamera = () => {
    fitCameraToPlantFloor();
  };

  // Auto-center camera on component mount
  useEffect(() => {
    const timer1 = setTimeout(() => {
      fitCameraToPlantFloor();
    }, 40);
    const timer2 = setTimeout(() => {
      fitCameraToPlantFloor();
    }, 200);

    const handleResize = () => {
      fitCameraToPlantFloor();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResize);
    };
  }, [fitCameraToPlantFloor]);

  // Main Canvas Render & Simulation Update Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const updateSimulation = (dt: number) => {
      if (!simState.isRunning) return;

      const simDt = dt * simState.simulationSpeed;
      const nodes = nodesRef.current;
      const particles = particlesRef.current;
      const trucks = trucksRef.current;
      const floatingTexts = floatingTextsRef.current;

      // Handle Trucks Logistics Arrival
      inboundTimerRef.current -= simDt;
      if (inboundTimerRef.current <= 0) {
        if (!trucks.some(t => t.type === 'inbound_cell' && t.state === 'arriving')) {
          trucks.push({
            id: `inbound-${Date.now()}`,
            type: 'inbound_cell',
            x: -250,
            y: nodes['W01'] ? nodes['W01'].y : 300,
            state: 'arriving',
            timer: 0,
            batchSize: cellsPerInboundTruck,
          });
        }
        inboundTimerRef.current = 3600 / Math.max(0.1, inboundRate);
      }

      materialTimerRef.current -= simDt;
      if (materialTimerRef.current <= 0) {
        if (!trucks.some(t => t.type === 'material_tray' && t.state === 'arriving')) {
          trucks.push({
            id: `material-${Date.now()}`,
            type: 'material_tray',
            x: FACTORY_W + 250,
            y: nodes['W05_Mat_In'] ? nodes['W05_Mat_In'].y : 700,
            state: 'arriving',
            timer: 0,
            batchSize: 30,
          });
        }
        materialTimerRef.current = 3600 / Math.max(0.1, materialRate);
      }

      if (nodes['W04_Out'] && nodes['W04_Out'].inventory >= outboundBatch) {
        if (!trucks.some(t => t.type === 'outbound_pack' && t.state === 'arriving')) {
          trucks.push({
            id: `outbound-${Date.now()}`,
            type: 'outbound_pack',
            x: -250,
            y: nodes['W04_Out'].y,
            state: 'arriving',
            timer: 0,
            batchSize: outboundBatch,
          });
        }
      }

      // Update Truck Movements & Docking
      const truckSpeed = 90;
      for (let i = trucks.length - 1; i >= 0; i--) {
        const t = trucks[i];
        const visualDt = (simDt / simState.simulationSpeed) * 2;

        if (t.state === 'arriving') {
          if (t.type === 'material_tray') {
            t.x -= visualDt * truckSpeed;
            if (nodes['W05_Mat_In'] && t.x <= nodes['W05_Mat_In'].x + 60) {
              t.state = 'docked';
              t.timer = 8;
            }
          } else {
            t.x += visualDt * truckSpeed;
            if (t.x >= 10) {
              t.state = 'docked';
              t.timer = 8;
            }
          }
        } else if (t.state === 'docked') {
          t.timer -= visualDt;
          if (t.timer <= 0) {
            if (t.type === 'inbound_cell' && nodes['W01']) {
              nodes['W01'].inventory = Math.min(nodes['W01'].cap, nodes['W01'].inventory + t.batchSize);
              statsRef.current.cellsIn += t.batchSize;
              floatingTexts.push({
                id: `ft-${Date.now()}`,
                text: `+${t.batchSize.toLocaleString()} Raw Cells`,
                x: 120,
                y: nodes['W01'].y - 35,
                color: '#10B981',
                life: 2.5,
              });
            } else if (t.type === 'material_tray' && nodes['W05_Mat_In']) {
              nodes['W05_Mat_In'].inventory = Math.min(nodes['W05_Mat_In'].cap, nodes['W05_Mat_In'].inventory + t.batchSize);
              floatingTexts.push({
                id: `ft-${Date.now()}`,
                text: `+${t.batchSize} Material Trays`,
                x: nodes['W05_Mat_In'].x,
                y: nodes['W05_Mat_In'].y - 35,
                color: '#F59E0B',
                life: 2.5,
              });
            } else if (t.type === 'outbound_pack' && nodes['W04_Out']) {
              nodes['W04_Out'].inventory = Math.max(0, nodes['W04_Out'].inventory - t.batchSize);
              statsRef.current.packsOut += t.batchSize;
              floatingTexts.push({
                id: `ft-${Date.now()}`,
                text: `-${t.batchSize} Packs Dispatched`,
                x: 120,
                y: nodes['W04_Out'].y - 35,
                color: '#F97316',
                life: 2.5,
              });
            }
            t.state = 'departing';
          }
        } else if (t.state === 'departing') {
          if (t.type === 'material_tray') {
            t.x += visualDt * truckSpeed;
            if (t.x > FACTORY_W + 400) trucks.splice(i, 1);
          } else {
            t.x -= visualDt * truckSpeed;
            if (t.x < -300) trucks.splice(i, 1);
          }
        }
      }

      // Update Node Machine Processing & Logic Flow
      for (const id in nodes) {
        const n = nodes[id];
        const batchRequired = n.isTransformer ? cellsPerPack : 1;
        const outputQty = 1;

        if (n.currentTimer > 0) {
          n.currentTimer -= simDt;
          if (n.currentTimer <= 0) {
            n.currentTimer = 0;
            n.status = 'holding';
          } else {
            n.status = 'working';
          }
        }

        let canStart = false;
        if (id === 'M01') {
          canStart = n.inventory >= 1 && (n.auxInventory || 0) >= 1;
        } else {
          canStart = n.inventory >= batchRequired;
        }

        if (n.type === 'M') {
          if (canStart && n.currentTimer === 0 && n.status !== 'holding') {
            let pTime = n.processingTime;
            if (id.startsWith('S_BOT_')) pTime = stackerCycle;
            if (id.startsWith('W_L_')) pTime = weldCycle;
            if (id.startsWith('CY_')) pTime = cyclerCycle;

            n.currentTimer = pTime * (0.92 + Math.random() * 0.16);
            n.status = 'working';
          }
        } else if (n.type === 'B' || n.type === 'IO') {
          if (canStart) n.status = 'holding';
          else n.status = 'idle';
        }

        // Push to Next Line Nodes
        if (n.status === 'holding' && n.next.length > 0) {
          const availableNexts = n.next.filter(nxt => {
            const nextNode = nodes[nxt];
            if (!nextNode) return false;
            if (id === 'P02' && nxt === 'M01') {
              return (nextNode.cap - (nextNode.auxInventory || 0)) >= outputQty;
            }
            return (nextNode.cap - nextNode.inventory) >= outputQty;
          });

          if (availableNexts.length > 0) {
            let targetId: string | null = null;

            if (id === 'C_Sort') {
              const isDefect = Math.random() < defectRate / 100;
              targetId = isDefect && availableNexts.includes('Q_Bay') ? 'Q_Bay' : 'C_Clean';
            } else if (id === 'CCD_Sort') {
              const isDefect = Math.random() < (defectRate * 1.2) / 100;
              targetId = isDefect && availableNexts.includes('Q_Bead_Reject') ? 'Q_Bead_Reject' : 'B04';
            } else if (id === 'M01') {
              // Pack Marriage Robot M01 distributes finished packs to EV Line (M02) and BESS Buffer Bank (B_BESS_Buf)
              const bessBuf = nodes['B_BESS_Buf'];
              if (bessBuf && bessBuf.inventory < 20 && availableNexts.includes('B_BESS_Buf')) {
                // Priority: Keep BESS Buffer at minimum 20 Packs
                targetId = 'B_BESS_Buf';
              } else if (availableNexts.includes('B_BESS_Buf') && Math.random() < 0.10) {
                // Nominal ~10% flow allocation to BESS utility line
                targetId = 'B_BESS_Buf';
              } else if (availableNexts.includes('M02')) {
                targetId = 'M02';
              } else {
                targetId = availableNexts[0];
              }
            } else {
              availableNexts.sort((a, b) => nodes[a].inventory - nodes[b].inventory);
              targetId = availableNexts[0];
            }

            if (targetId && nodes[targetId]) {
              const hasReq = id === 'M01' ? n.inventory >= 1 && (n.auxInventory || 0) >= 1 : n.inventory >= batchRequired;

              if (hasReq) {
                if (id === 'M01') {
                  n.inventory -= 1;
                  n.auxInventory = (n.auxInventory || 1) - 1;
                } else {
                  n.inventory -= batchRequired;
                }

                if (id === 'P02' && targetId === 'M01') {
                  nodes[targetId].auxInventory = (nodes[targetId].auxInventory || 0) + outputQty;
                } else {
                  nodes[targetId].inventory += outputQty;
                }

                // Spawn particle
                let pType: 'cell' | 'module' | 'pack' | 'tray' = 'cell';
                if (id.startsWith('S_BOT_') || id.startsWith('W_') || id === 'CCD_Sort' || id === 'B04') {
                  pType = 'module';
                }
                if (
                  id.startsWith('M0') ||
                  id.startsWith('B05') ||
                  id.startsWith('E01') ||
                  id.startsWith('B06') ||
                  id.startsWith('T') ||
                  id.startsWith('CY_') ||
                  id.startsWith('W03') ||
                  id === 'B_BESS_Buf' ||
                  id.startsWith('BESS_')
                ) {
                  pType = 'pack';
                }
                if (id.startsWith('P0') || id === 'B_Mat' || id === 'W05_Mat_In') {
                  pType = 'tray';
                }

                if (showParticles) {
                  particles.push({
                    startX: n.x,
                    startY: n.y,
                    targetX: nodes[targetId].x,
                    targetY: nodes[targetId].y,
                    x: n.x,
                    y: n.y,
                    progress: 0,
                    type: pType,
                  });
                }
              }

              const stillHasReq = id === 'M01' ? n.inventory >= 1 && (n.auxInventory || 0) >= 1 : n.inventory >= batchRequired;

              if (stillHasReq) {
                if (n.type === 'M') {
                  let pTime = n.processingTime;
                  if (id.startsWith('S_BOT_')) pTime = stackerCycle;
                  if (id.startsWith('W_L_')) pTime = weldCycle;
                  if (id.startsWith('CY_')) pTime = cyclerCycle;
                  n.currentTimer = pTime * (0.92 + Math.random() * 0.16);
                  n.status = 'working';
                } else {
                  n.status = 'holding';
                }
              } else {
                n.status = 'idle';
              }
            } else {
              if (n.type === 'M') n.status = 'blocked';
            }
          }
        }
      }

      // Update particles
      const pSpeed = simDt * 1.6;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.progress += pSpeed;
        p.x = p.startX + (p.targetX - p.startX) * p.progress;
        p.y = p.startY + (p.targetY - p.startY) * p.progress;
        if (p.progress >= 1) particles.splice(i, 1);
      }

      // Update floating texts
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 0.6;
        ft.life -= 0.03;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }
    };

    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isDark = theme === 'dark';

      // Match canvas container dimensions
      const rect = canvas.parentNode ? (canvas.parentNode as HTMLElement).getBoundingClientRect() : null;
      if (rect) {
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          if (!hasInitializedCameraRef.current && rect.width > 200) {
            hasInitializedCameraRef.current = true;
            fitCameraToPlantFloor(rect.width, rect.height);
          }
        }
      }

      ctx.fillStyle = isDark ? '#0B0C0E' : '#F8FAFC';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.scale(camera.scale, camera.scale);

      // Blueprint Background Grid
      if (showGrid) {
        ctx.strokeStyle = isDark ? '#232731' : '#E2E8F0';
        ctx.lineWidth = 1;
        const gridSize = 60;
        for (let x = -500; x < FACTORY_W + 500; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, -500);
          ctx.lineTo(x, FACTORY_H + 500);
          ctx.stroke();
        }
        for (let y = -500; y < FACTORY_H + 500; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(-500, y);
          ctx.lineTo(FACTORY_W + 500, y);
          ctx.stroke();
        }
      }

      // Draw Plant Zones Bounding Boxes
      const zoneColors: { [key: string]: string } = {
        'Z1: CELL RECEIVING & OCV SORTING': '59, 130, 246', // Blue
        'Z2: MODULE STACKING & BANDING': '16, 185, 129', // Emerald
        'Z3: CLEANROOM LASER BUSBAR WELDING': '139, 92, 246', // Purple
        'Z4: PACK MARRIAGE & ASSEMBLY': '245, 158, 11', // Amber
        'Z5: END-OF-LINE TESTING & QUALITY': '239, 68, 68', // Red
        'Z8: PACKAGING & FINISHED STORE (4-DAY BUFFER)': '249, 115, 22', // Orange
        'Z_BESS: BESS CONTAINER & RACK INTEGRATION': '14, 165, 233', // Sky / Cyan
      };

      for (const zoneName in plantZonesRef.current) {
        const nodeIds = plantZonesRef.current[zoneName];
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        let valid = false;

        nodeIds.forEach(id => {
          const n = nodesRef.current[id];
          if (n) {
            minX = Math.min(minX, n.x - n.w / 2);
            minY = Math.min(minY, n.y - n.h / 2);
            maxX = Math.max(maxX, n.x + n.w / 2);
            maxY = Math.max(maxY, n.y + n.h / 2);
            valid = true;
          }
        });

        if (valid) {
          minX -= 50;
          minY -= 50;
          maxX += 50;
          maxY += 50;
          const rgb = zoneColors[zoneName] || '107, 114, 128';

          ctx.fillStyle = isDark ? `rgba(${rgb}, 0.05)` : `rgba(${rgb}, 0.07)`;
          ctx.strokeStyle = `rgba(${rgb}, 0.5)`;
          ctx.lineWidth = 2;
          ctx.setLineDash([12, 6]);
          ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
          ctx.setLineDash([]);

          ctx.fillStyle = isDark ? `rgba(${rgb}, 0.95)` : `rgba(${rgb}, 1)`;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(zoneName, minX + 16, minY + 26);

          // Render "E"-Type Comb/Hatch Floor Graphics for Zone 5
          if (zoneName.includes('Z5: END-OF-LINE')) {
            const centerY = (minY + maxY) / 2;
            const tierYTop = centerY - 100;
            const tierYMid = centerY;
            const tierYBot = centerY + 100;
            const spineX = maxX - 40;
            const leftSpineX = minX + 40;

            // Draw 3 horizontal floor track lanes for Tier A, B, C (the 3 prongs of the E)
            const tiers = [
              { y: tierYTop, label: 'TIER A: HIGH-RATE FORMATION PRONG' },
              { y: tierYMid, label: 'TIER B: CELL RETENTION & AGING PRONG' },
              { y: tierYBot, label: 'TIER C: CAPACITY & DCIR TEST PRONG' },
            ];

            tiers.forEach((t, idx) => {
              ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.04)';
              ctx.fillRect(leftSpineX, t.y - 32, spineX - leftSpineX, 64);
              ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)';
              ctx.lineWidth = 1;
              ctx.strokeRect(leftSpineX, t.y - 32, spineX - leftSpineX, 64);

              // Tier designation tag
              ctx.fillStyle = isDark ? '#FCA5A5' : '#DC2626';
              ctx.font = 'bold 10px monospace';
              ctx.textAlign = 'right';
              ctx.fillText(`[ARM ${idx + 1}: ${t.label}]`, spineX - 10, t.y - 18);
            });

            // Draw Vertical Spine Distribution Manifold (the vertical spine of the "E")
            ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)';
            ctx.fillRect(spineX - 15, tierYTop - 32, 30, (tierYBot - tierYTop) + 64);
            ctx.strokeStyle = isDark ? 'rgba(239, 68, 68, 0.4)' : 'rgba(239, 68, 68, 0.3)';
            ctx.strokeRect(spineX - 15, tierYTop - 32, 30, (tierYBot - tierYTop) + 64);
            
            ctx.save();
            ctx.translate(spineX + 2, tierYMid);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = isDark ? '#F87171' : '#B91C1C';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('E-HATCH SPINAL CONVEYOR', 0, 0);
            ctx.restore();
          }
        }
      }

      // Draw Conveyor Links
      ctx.lineWidth = 3;
      linksRef.current.forEach(l => {
        const n1 = nodesRef.current[l.from];
        const n2 = nodesRef.current[l.to];
        if (!n1 || !n2) return;

        ctx.strokeStyle = isDark ? '#374151' : '#94A3B8';
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);

        if (Math.abs(n1.x - n2.x) > Math.abs(n1.y - n2.y)) {
          ctx.lineTo(n2.x, n1.y);
        } else {
          ctx.lineTo(n1.x, n2.y);
        }
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();
      });

      // Draw Machine Nodes & Buffers
      for (const id in nodesRef.current) {
        const n = nodesRef.current[id];
        const isBuf = n.type === 'B';
        const isSelected = selectedNodeId === id;
        const isDraggingThis = draggingNodeIdRef.current === id;
        const isHovered = hoveredNodeId === id;
        const rx = n.x - n.w / 2;
        const ry = n.y - n.h / 2;

        // If actively dragging this station, draw crosshair guide lines
        if (isDraggingThis) {
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(n.x, -500);
          ctx.lineTo(n.x, FACTORY_H + 500);
          ctx.moveTo(-500, n.y);
          ctx.lineTo(FACTORY_W + 500, n.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = isDark ? (isBuf ? '#1A1D24' : '#111318') : (isBuf ? '#F1F5F9' : '#FFFFFF');

        if (isDraggingThis) ctx.strokeStyle = '#3B82F6';
        else if (isSelected) ctx.strokeStyle = '#2563EB';
        else if (isHovered) ctx.strokeStyle = '#06B6D4';
        else if (n.status === 'blocked') ctx.strokeStyle = '#EF4444';
        else if (n.status === 'working') ctx.strokeStyle = '#10B981';
        else if (isBuf) ctx.strokeStyle = '#8B5CF6';
        else ctx.strokeStyle = isDark ? '#2D3139' : '#CBD5E1';

        ctx.lineWidth = isDraggingThis ? 4 : isSelected ? 3.5 : isHovered ? 2.5 : 2;
        ctx.fillRect(rx, ry, n.w, n.h);
        ctx.strokeRect(rx, ry, n.w, n.h);

        // Node ID Header
        ctx.fillStyle = isDraggingThis ? '#60A5FA' : isSelected ? (isDark ? '#60A5FA' : '#1D4ED8') : (isDark ? '#E5E7EB' : '#0F172A');
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(id, n.x, ry + 14);

        // Capacity Meter Fill
        const fillPct = Math.min(1, n.inventory / Math.max(1, n.cap));
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(rx + 3, n.y + 4, n.w - 6, n.h / 2 - 6);

        let meterColor = '#10B981';
        if (fillPct > 0.8) meterColor = '#EF4444';
        else if (fillPct > 0.5) meterColor = '#F59E0B';

        ctx.fillStyle = meterColor;
        ctx.fillRect(rx + 3, n.y + 4, (n.w - 6) * fillPct, n.h / 2 - 6);

        // Stock Number
        ctx.fillStyle = isDark ? '#9CA3AF' : '#475569';
        ctx.font = '9px monospace';
        if (id === 'M01') {
          ctx.fillText(`M:${n.inventory} | T:${n.auxInventory || 0}`, n.x, n.y + 14);
        } else {
          ctx.fillText(`${n.inventory}/${n.cap}`, n.x, n.y + 14);
        }

        // Node Label below box
        ctx.fillStyle = isDark ? '#94A3B8' : '#334155';
        ctx.font = '10px sans-serif';
        const labelText = n.label.length > 22 ? n.label.substring(0, 20) + '..' : n.label;
        ctx.fillText(labelText, n.x, ry + n.h + 14);

        // If hovered or dragging, render position coordinate badge
        if (isDraggingThis || isHovered) {
          const coordText = `${id} (X: ${Math.round(n.x)}, Y: ${Math.round(n.y)})`;
          ctx.font = 'bold 10px monospace';
          const tw = ctx.measureText(coordText).width + 12;
          ctx.fillStyle = isDraggingThis ? '#2563EB' : '#0F172A';
          ctx.fillRect(n.x - tw / 2, ry - 22, tw, 18);
          ctx.strokeStyle = isDraggingThis ? '#93C5FD' : '#38BDF8';
          ctx.lineWidth = 1;
          ctx.strokeRect(n.x - tw / 2, ry - 22, tw, 18);

          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.fillText(coordText, n.x, ry - 9);
        }
      }

      // Draw Animated Material Flow Particles
      if (showParticles) {
        particlesRef.current.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.type === 'pack' ? 6 : p.type === 'module' ? 4.5 : 3.5, 0, Math.PI * 2);

          if (p.type === 'cell') {
            ctx.fillStyle = '#10B981';
            ctx.shadowColor = '#10B981';
          } else if (p.type === 'module') {
            ctx.fillStyle = '#F59E0B';
            ctx.shadowColor = '#F59E0B';
          } else if (p.type === 'pack') {
            ctx.fillStyle = '#F97316';
            ctx.shadowColor = '#F97316';
          } else {
            ctx.fillStyle = '#A855F7';
            ctx.shadowColor = '#A855F7';
          }

          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.type === 'pack' ? 2.5 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw Animated Trucks
      if (showTrucks) {
        trucksRef.current.forEach(t => {
          ctx.fillStyle = t.type === 'inbound_cell' ? '#10B981' : t.type === 'material_tray' ? '#F59E0B' : '#F97316';

          if (t.type === 'material_tray') {
            ctx.fillRect(t.x, t.y - 20, 110, 42);
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(t.x - 32, t.y - 15, 32, 32);
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(t.x + 10, t.y + 22, 16, 6);
            ctx.fillRect(t.x + 85, t.y + 22, 16, 6);

            ctx.fillStyle = '#1E293B';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('TRAYS', t.x + 55, t.y + 5);
          } else {
            ctx.fillRect(t.x, t.y - 20, 110, 42);
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(t.x + 110, t.y - 15, 32, 32);
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(t.x + 10, t.y + 22, 16, 6);
            ctx.fillRect(t.x + 85, t.y + 22, 16, 6);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.type === 'inbound_cell' ? 'RAW CELLS' : 'PACKS OUT', t.x + 55, t.y + 5);
          }
        });
      }

      // Draw Floating Notification Text
      floatingTextsRef.current.forEach(ft => {
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = Math.max(0, ft.life / 2.5);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
      });

      ctx.restore();
    };

    const loop = (timestamp: number) => {
      let dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      if (dt > 0.1) dt = 0.1;

      updateSimulation(dt);
      renderCanvas();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [simState.isRunning, simState.simulationSpeed, inboundRate, materialRate, outboundBatch, stackerCycle, weldCycle, cyclerCycle, defectRate, cellsPerPack, showParticles, showTrucks, showGrid, selectedNodeId, camera]);

  // Active selected node details for Inspector
  const selectedNode = selectedNodeId ? nodesRef.current[selectedNodeId] : null;
  const isDark = theme === 'dark';

  return (
    <div className={`flex h-full w-full overflow-hidden relative select-none transition-colors duration-200 ${
      isDark ? 'bg-[#0B0C0E] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Floating Operational Controller Drawer (Left) */}
      <div
        className={`fixed top-16 left-0 bottom-0 z-30 overflow-hidden border-r transition-all duration-300 flex flex-col ${
          isDark
            ? 'bg-[#0B0D14]/80 border-[#2D3139]/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
            : 'bg-white/80 border-slate-200/90 shadow-2xl'
        } ${isControlPanelOpen ? 'w-96' : 'w-10'}`}
      >
        {/* Aerial Plant Layout Background Image with Frosted Glass Morphism Overlay */}
        <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
          <img
            src={plantOpsAerialImg}
            alt="Plant Operations Complex"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center scale-110 opacity-30 dark:opacity-20 filter blur-[1.2px] transition-all duration-500"
          />
          {/* Frosted glass morphism blur & gradient backdrop */}
          <div
            className={`absolute inset-0 backdrop-blur-2xl ${
              isDark
                ? 'bg-gradient-to-b from-[#0B0D14]/92 via-[#0F1422]/85 to-[#0B0D14]/94'
                : 'bg-gradient-to-b from-white/94 via-slate-50/88 to-white/95'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent dark:via-white/5 pointer-events-none" />
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsControlPanelOpen(!isControlPanelOpen)}
          className="absolute -right-3.5 top-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white p-1 rounded-full border border-blue-300/40 shadow-[0_0_12px_rgba(37,99,235,0.5)] z-40 transition-transform transform hover:scale-110"
        >
          {isControlPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isControlPanelOpen && (
          <div className="relative z-10 flex flex-col h-full overflow-hidden">
            {/* Control Panel Header with Frosted Glass styling */}
            <div className={`p-4 border-b flex items-center justify-between backdrop-blur-xl ${
              isDark ? 'border-white/10 bg-black/20' : 'border-slate-200/80 bg-white/40'
            }`}>
              <div className={`flex items-center gap-2 font-extrabold uppercase text-xs tracking-wider ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <div className="p-1 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <span>Plant Operations Controller</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold backdrop-blur-md">
                Auto-Scaling
              </span>
            </div>

            {/* Navigation Tabs - Frosted Glass Bar */}
            <div className={`flex border-b text-[11px] font-medium backdrop-blur-xl ${
              isDark ? 'border-white/10 bg-black/30' : 'border-slate-200/80 bg-slate-100/60'
            }`}>
              <button
                onClick={() => setActiveControlTab('capacity')}
                className={`flex-1 py-2.5 text-center transition-all border-b-2 font-semibold ${
                  activeControlTab === 'capacity'
                    ? 'border-blue-500 font-bold ' + (isDark ? 'text-white bg-white/10 shadow-inner' : 'text-blue-700 bg-white/90 shadow-xs')
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                Capacity
              </button>
              <button
                onClick={() => setActiveControlTab('logistics')}
                className={`flex-1 py-2.5 text-center transition-all border-b-2 font-semibold ${
                  activeControlTab === 'logistics'
                    ? 'border-blue-500 font-bold ' + (isDark ? 'text-white bg-white/10 shadow-inner' : 'text-blue-700 bg-white/90 shadow-xs')
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                Logistics
              </button>
              <button
                onClick={() => setActiveControlTab('cycles')}
                className={`flex-1 py-2.5 text-center transition-all border-b-2 font-semibold ${
                  activeControlTab === 'cycles'
                    ? 'border-blue-500 font-bold ' + (isDark ? 'text-white bg-white/10 shadow-inner' : 'text-blue-700 bg-white/90 shadow-xs')
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                Cycles
              </button>
              <button
                onClick={() => setActiveControlTab('engine')}
                className={`flex-1 py-2.5 text-center transition-all border-b-2 font-semibold ${
                  activeControlTab === 'engine'
                    ? 'border-blue-500 font-bold ' + (isDark ? 'text-white bg-white/10 shadow-inner' : 'text-blue-700 bg-white/90 shadow-xs')
                    : isDark ? 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                Engine
              </button>
            </div>

            {/* Control Tab Contents with Glass Cards */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* TAB 1: CAPACITY & BOM */}
              {activeControlTab === 'capacity' && (
                <div className="space-y-3.5 text-xs">
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Annual Capacity Target (GWh)</span>
                      <span className="font-mono text-blue-500 font-bold text-sm bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{gwhTarget} GWh</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      step="1"
                      value={gwhTarget}
                      onChange={e => setGwhTarget(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Battery Pack Capacity (kWh)</span>
                      <span className="font-mono text-purple-500 font-bold text-sm bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">{packKwh} kWh</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="150"
                      step="5"
                      value={packKwh}
                      onChange={e => setPackKwh(parseInt(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className={`p-2.5 rounded-xl border backdrop-blur-xl ${
                      isDark ? 'bg-[#141720]/80 border-white/10' : 'bg-white/80 border-slate-200/90'
                    }`}>
                      <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Shifts per Day</label>
                      <select
                        value={shiftsCount}
                        onChange={e => setShiftsCount(parseInt(e.target.value))}
                        className={`w-full border rounded-lg px-2 py-1 font-mono text-xs ${
                          isDark ? 'bg-[#0B0D14] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="1">1 Shift</option>
                        <option value="2">2 Shifts</option>
                        <option value="3">3 Shifts (24/7)</option>
                      </select>
                    </div>

                    <div className={`p-2.5 rounded-xl border backdrop-blur-xl ${
                      isDark ? 'bg-[#141720]/80 border-white/10' : 'bg-white/80 border-slate-200/90'
                    }`}>
                      <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Shift Duration</label>
                      <select
                        value={shiftHours}
                        onChange={e => setShiftHours(parseInt(e.target.value))}
                        className={`w-full border rounded-lg px-2 py-1 font-mono text-xs ${
                          isDark ? 'bg-[#0B0D14] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="8">8 Hours</option>
                        <option value="10">10 Hours</option>
                        <option value="12">12 Hours</option>
                      </select>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Cells per Pack (BOM)</span>
                      <span className="font-mono text-emerald-500 font-bold text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{cellsPerPack} Cells</span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="200"
                      step="4"
                      value={cellsPerPack}
                      onChange={e => setCellsPerPack(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* BESS Container Packs Slider */}
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Packs per BESS Container</span>
                      <span className="font-mono text-cyan-500 font-bold text-sm bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">{packsPerBess} Racks</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="48"
                      step="2"
                      value={packsPerBess}
                      onChange={e => setPacksPerBess(parseInt(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>Utility BESS Rating:</span>
                      <span className="text-cyan-500 font-bold">{(packsPerBess * packKwh).toFixed(1)} kWh ({((packsPerBess * packKwh) / 1000).toFixed(2)} MWh)</span>
                    </div>
                  </div>

                  {/* Calculated KPI Output Box with Glassmorphism */}
                  <div className={`p-3.5 rounded-xl border space-y-2 font-mono text-[11px] backdrop-blur-xl ${
                    isDark
                      ? 'bg-blue-950/40 border-blue-500/30 text-gray-200 shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
                      : 'bg-blue-50/80 border-blue-200 text-slate-800 shadow-xs'
                  }`}>
                    <div className="text-[10px] text-blue-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Derived Production Targets</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Shift Target Output:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{shiftPacksReq.toLocaleString()} Packs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Required Line Takt:</span>
                      <span className="text-emerald-500 font-bold">{requiredLineTakt}s / Pack</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">BESS Shift Target:</span>
                      <span className="text-cyan-500 font-bold">{Math.min(12, Math.max(1, Math.round((shiftPacksReq / 1183) * 12)))} Cabinets</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Auto-Scaled Threads:</span>
                      <span className="text-amber-500 font-bold">
                        {tStack} Stk • {tWeld} Wld • {tCycler} Cyc
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleApplyCapacity}
                    className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-400/30 flex items-center justify-center gap-2 transform hover:scale-[1.01]"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span>Apply Settings & Scale Line Layout</span>
                  </button>
                </div>
              )}

              {/* TAB 2: SUPPLY LOGISTICS */}
              {activeControlTab === 'logistics' && (
                <div className="space-y-3.5 text-xs">
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Inbound Cell Truck Frequency</span>
                      <span className="font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{inboundRate} Trucks / hr</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={inboundRate}
                      onChange={e => setInboundRate(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-gray-400">WH-1 Class 9 Hazardous Cell Receiving Dock</p>
                  </div>

                  {/* Cells per Inbound Truck Slider */}
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Bare Cells per Inbound Truck</span>
                      <span className="font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{cellsPerInboundTruck.toLocaleString()} Cells</span>
                    </div>
                    <input
                      type="range"
                      min="5000"
                      max="50000"
                      step="2500"
                      value={cellsPerInboundTruck}
                      onChange={e => setCellsPerInboundTruck(parseInt(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>Total Inflow Rate:</span>
                      <span className="text-emerald-500 font-bold">{(inboundRate * cellsPerInboundTruck).toLocaleString()} Cells / hr</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Outbound Dispatch Batch Size</span>
                      <span className="font-mono text-orange-500 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{outboundBatch} Packs</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      step="5"
                      value={outboundBatch}
                      onChange={e => setOutboundBatch(parseInt(e.target.value))}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-gray-400">WH-2 Outbound Finished Product Dispatch Dock (4-Day Buffer)</p>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Material & Components Freight</span>
                      <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{materialRate} Trucks / hr</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.5"
                      value={materialRate}
                      onChange={e => setMaterialRate(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <p className="text-[10px] text-gray-400">WH-4 Non-Live Component Delivery</p>
                  </div>
                </div>
              )}

              {/* TAB 3: MACHINE CYCLES */}
              {activeControlTab === 'cycles' && (
                <div className="space-y-3.5 text-xs">
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Cell Stacker Cycle Time</span>
                      <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{stackerCycle}s / Module</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="300"
                      step="5"
                      value={stackerCycle}
                      onChange={e => setStackerCycle(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Laser Busbar Weld Cycle Time</span>
                      <span className="font-mono text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{weldCycle}s / Module</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="1"
                      value={weldCycle}
                      onChange={e => setWeldCycle(parseInt(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/80 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/80 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>EOL Cycler Charge/Discharge Test</span>
                      <span className="font-mono text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{cyclerCycle}s / Pack</span>
                    </div>
                    <input
                      type="range"
                      min="60"
                      max="300"
                      step="10"
                      value={cyclerCycle}
                      onChange={e => setCyclerCycle(parseInt(e.target.value))}
                      className="w-full accent-rose-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: TIME ENGINE */}
              {activeControlTab === 'engine' && (
                <div className="space-y-3.5 text-xs">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (setSimState) {
                          setSimState(prev => ({ ...prev, isRunning: !prev.isRunning }));
                        }
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm backdrop-blur-md ${
                        simState.isRunning
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_12px_rgba(217,119,6,0.3)]'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      }`}
                    >
                      {simState.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{simState.isRunning ? 'Pause Shift' : 'Start Shift'}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (setSimState) {
                          setSimState(prev => ({
                            ...prev,
                            shiftTimeSeconds: 0,
                            goodPacks: 0,
                            reworkedPacks: 0,
                            scrappedPacks: 0,
                          }));
                        }
                        statsRef.current = { cellsIn: 0, packsOut: 0 };
                        particlesRef.current = [];
                        trucksRef.current = [];
                      }}
                      className={`border p-2.5 rounded-xl backdrop-blur-md transition-all ${
                        isDark ? 'bg-[#141720]/80 border-white/10 text-gray-300 hover:bg-white/10' : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                      title="Reset Clock"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Simulation Warp Speed</div>
                    <div className="grid grid-cols-4 gap-1.5 font-mono">
                      {[1, 5, 20, 100].map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            if (setSimState) {
                              setSimState(prev => ({ ...prev, simulationSpeed: s }));
                            }
                          }}
                          className={`py-1.5 rounded-lg text-center transition-all backdrop-blur-md ${
                            simState.simulationSpeed === s
                              ? 'bg-blue-600 text-white font-bold shadow-[0_0_10px_rgba(37,99,235,0.4)] border border-blue-400/30'
                              : isDark ? 'bg-[#141720]/80 text-gray-400 hover:text-white border border-white/5' : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Canvas Area */}
      <div className={`flex-1 flex flex-col h-full relative overflow-hidden ${isDark ? 'bg-[#0B0C0E]' : 'bg-[#F8FAFC]'}`}>
        {/* Top Floating HUD Bar - Frosted Glassmorphism with Shadow Glow */}
        <div className={`absolute top-4 left-14 right-4 z-20 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border text-xs backdrop-blur-2xl transition-all ${
          isDark
            ? 'bg-[#0B0D14]/80 text-white border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
            : 'bg-white/85 text-slate-900 border-slate-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
        }`}>
          <div className="flex items-center gap-4 font-mono">
            <div>
              <span className="text-[10px] text-gray-400 uppercase block font-semibold">Shift Target</span>
              <span className="font-bold text-amber-500 drop-shadow-xs">{shiftPacksReq.toLocaleString()} Packs</span>
            </div>
            <div className="w-[1px] h-6 bg-gray-300 dark:bg-white/10" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase block font-semibold">Req. Line Takt</span>
              <span className="font-bold text-emerald-500 drop-shadow-xs">{requiredLineTakt}s / Pack</span>
            </div>
            <div className="w-[1px] h-6 bg-gray-300 dark:bg-white/10" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase block font-semibold">Active Threads</span>
              <span className="font-bold text-blue-500">
                {tStack} Stackers • {tWeld} Welders • {tCycler} Cyclers
              </span>
            </div>
          </div>

          {/* Color Particles Legend & Layout Lock Status */}
          <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap">
            {/* Lock / Unlock Station Rearrangement Toggle Button */}
            <button
              onClick={() => {
                setIsLayoutLocked(prev => !prev);
                floatingTextsRef.current.push({
                  text: isLayoutLocked ? '🔓 Edit Mode: Drag Stations to Move' : '🔒 Layout Locked (Accidental Moves Blocked)',
                  x: 1800,
                  y: FACTORY_H / 2 - 100,
                  color: isLayoutLocked ? '#F59E0B' : '#10B981',
                  life: 2.5,
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all select-none backdrop-blur-xl ${
                isLayoutLocked
                  ? isDark
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-xs'
                  : isDark
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 hover:bg-amber-500/30 animate-pulse'
                  : 'bg-amber-100 text-amber-900 border border-amber-400 hover:bg-amber-200 animate-pulse'
              }`}
              title={isLayoutLocked ? 'Layout is Locked: Click to Unlock Drag & Drop Station Rearrangement' : 'Layout is in Edit Mode: Click to Lock & Protect Positions'}
            >
              {isLayoutLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Layout Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit Layout Active</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
              <span>Raw Cells</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500" />
              <span>Modules</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500" />
              <span>EV Packs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-sm shadow-sky-500" />
              <span>BESS Racks</span>
            </div>
          </div>
        </div>

        {/* Canvas Element */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`w-full h-full block ${
            isNodeDragging
              ? 'cursor-grabbing'
              : hoveredNodeId
              ? 'cursor-move'
              : isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
        />

        {/* Rebuilding Overlay */}
        {isRebuildingLayout && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center">
            <Cpu className="w-10 h-10 text-blue-400 animate-spin mb-3" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Re-provisioning Line Layout</h3>
            <p className="text-xs text-gray-400 mt-1">Recalculating parallel machine threads for {gwhTarget} GWh target...</p>
          </div>
        )}

        {/* Bottom Right Floating Camera & Display Controls */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
          <div className={`backdrop-blur-md p-1.5 rounded-lg border flex flex-col gap-1 ${
            isDark ? 'bg-[#111318]/90 border-[#2D3139] text-gray-300' : 'bg-white/90 border-slate-200 text-slate-700 shadow-sm'
          }`}>
            <button
              onClick={() => {
                setIsLayoutLocked(prev => !prev);
                floatingTextsRef.current.push({
                  text: isLayoutLocked ? '🔓 Edit Mode: Drag Stations to Move' : '🔒 Layout Locked (Accidental Moves Blocked)',
                  x: 1800,
                  y: FACTORY_H / 2 - 100,
                  color: isLayoutLocked ? '#F59E0B' : '#10B981',
                  life: 2.5,
                });
              }}
              className={`p-1.5 rounded transition-all ${
                isLayoutLocked
                  ? 'text-emerald-500 hover:bg-emerald-500/15'
                  : 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30 animate-pulse'
              }`}
              title={isLayoutLocked ? 'Layout is Locked: Click to Unlock Drag & Drop' : 'Layout is in Edit Mode: Click to Lock'}
            >
              {isLayoutLocked ? <Lock className="w-4 h-4 text-emerald-500" /> : <Unlock className="w-4 h-4 text-amber-500" />}
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, scale: Math.min(2.5, prev.scale * 1.2) }))}
              className="p-1.5 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-all"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, scale: Math.max(0.2, prev.scale / 1.2) }))}
              className="p-1.5 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleResetCamera} className="p-1.5 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-all" title="Fit Camera View">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={handleResetLayout} className="p-1.5 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg text-amber-500 hover:text-amber-400 transition-all" title="Reset Floor Layout to Default Blueprint">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className={`backdrop-blur-2xl p-2.5 rounded-2xl border flex flex-col gap-1.5 text-[10px] shadow-lg transition-all ${
            isDark ? 'bg-[#0B0D14]/80 border-white/10 text-gray-300' : 'bg-white/85 border-slate-200/90 text-slate-700 shadow-sm'
          }`}>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={e => setShowGrid(e.target.checked)}
                className="rounded border-white/20 text-blue-600 focus:ring-0"
              />
              <span>Grid</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showParticles}
                onChange={e => setShowParticles(e.target.checked)}
                className="rounded border-white/20 text-blue-600 focus:ring-0"
              />
              <span>Particles</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showTrucks}
                onChange={e => setShowTrucks(e.target.checked)}
                className="rounded border-white/20 text-blue-600 focus:ring-0"
              />
              <span>Trucks</span>
            </label>
          </div>
        </div>

        {/* Selected Node Inspector Drawer - Frosted Glassmorphism Card */}
        {selectedNode && (
          <div className={`absolute bottom-4 left-14 z-20 w-84 p-4 rounded-2xl border space-y-3 text-xs backdrop-blur-2xl transition-all ${
            isDark
              ? 'bg-[#0B0D14]/85 border-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
              : 'bg-white/90 border-slate-200/90 text-slate-900 shadow-2xl'
          }`}>
            <div className={`flex justify-between items-center border-b pb-2 ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}>
              <div>
                <span className="font-bold text-sm block font-mono text-blue-500 drop-shadow-xs">{selectedNode.id}</span>
                <span className="text-[10px] text-gray-400">{selectedNode.label}</span>
              </div>
              <button onClick={() => setSelectedNodeId(null)} className="text-gray-400 hover:text-slate-800 dark:hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Position & Nudge Controls */}
            <div className={`p-2.5 rounded-xl border space-y-2 font-mono text-[11px] backdrop-blur-xl ${
              isDark ? 'bg-[#141720]/80 border-white/10' : 'bg-slate-50/90 border-slate-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-gray-400 uppercase font-semibold">Station Floor Coords</span>
                <span className="text-blue-500 font-bold">
                  X: {Math.round(selectedNode.x)} | Y: {Math.round(selectedNode.y)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <button
                  onClick={() => {
                    selectedNode.x -= 20;
                  }}
                  className="flex-1 py-1 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-blue-600 hover:text-white transition-all font-semibold"
                  title="Nudge Left 20px"
                >
                  ← 20px
                </button>
                <button
                  onClick={() => {
                    selectedNode.x += 20;
                  }}
                  className="flex-1 py-1 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-blue-600 hover:text-white transition-all font-semibold"
                  title="Nudge Right 20px"
                >
                  → 20px
                </button>
                <button
                  onClick={() => {
                    selectedNode.y -= 20;
                  }}
                  className="flex-1 py-1 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-blue-600 hover:text-white transition-all font-semibold"
                  title="Nudge Up 20px"
                >
                  ↑ 20px
                </button>
                <button
                  onClick={() => {
                    selectedNode.y += 20;
                  }}
                  className="flex-1 py-1 rounded-lg bg-gray-200 dark:bg-white/10 hover:bg-blue-600 hover:text-white transition-all font-semibold"
                  title="Nudge Down 20px"
                >
                  ↓ 20px
                </button>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 dark:border-white/10">
                <span className="text-[9px] text-gray-400 uppercase font-semibold">Floor Drag Mode</span>
                <button
                  onClick={() => setIsLayoutLocked(prev => !prev)}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    isLayoutLocked
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30'
                  }`}
                >
                  {isLayoutLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{isLayoutLocked ? 'Locked' : 'Unlocked'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className={`p-2.5 rounded-xl border backdrop-blur-xl ${
                isDark ? 'bg-[#141720]/80 border-white/10' : 'bg-slate-50/90 border-slate-200'
              }`}>
                <span className="text-[9px] text-gray-400 uppercase block font-semibold">Occupancy</span>
                <span className="font-bold">
                  {selectedNode.inventory} / {selectedNode.cap} {selectedNode.unit}
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border backdrop-blur-xl ${
                isDark ? 'bg-[#141720]/80 border-white/10' : 'bg-slate-50/90 border-slate-200'
              }`}>
                <span className="text-[9px] text-gray-400 uppercase block font-semibold">Station State</span>
                <span
                  className={`font-bold ${
                    selectedNode.status === 'working'
                      ? 'text-emerald-500'
                      : selectedNode.status === 'blocked'
                      ? 'text-red-500'
                      : 'text-gray-400'
                  }`}
                >
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>
            </div>

            {selectedNode.id === 'B_BESS_Buf' && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-400 leading-tight backdrop-blur-xl">
                <strong>BESS Input Buffer Bank:</strong> Dedicated supply line from Pack Marriage Robot M01. Maintains minimum 20 Battery Packs buffer reserve before BESS rack assembly.
              </div>
            )}

            {selectedNode.id === 'M01' && (
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-[10px] text-blue-400 leading-tight backdrop-blur-xl">
                <strong>Pack Marriage Robot:</strong> Marries module stacks (from B04) and trays (from TIM Dispenser P02). Distributes finished married packs to EV Line (M02) and BESS Buffer Bank (B_BESS_Buf).
              </div>
            )}

            {selectedNode.processingTime > 0 && (
              <div className={`p-2.5 rounded-xl border space-y-1 text-[11px] backdrop-blur-xl ${
                isDark ? 'bg-[#141720]/80 border-white/10' : 'bg-slate-50/90 border-slate-200'
              }`}>
                <div className="flex justify-between text-gray-500 dark:text-gray-400 font-mono">
                  <span>Station Cycle Time:</span>
                  <span className="font-bold text-amber-500">
                    {selectedNode.processingTime}s
                  </span>
                </div>
                <div className="flex justify-between text-gray-500 dark:text-gray-400 font-mono text-[10px]">
                  <span>Line Cadence Takt:</span>
                  <span className="font-bold text-emerald-500">
                    {requiredLineTakt}s / Exit
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
