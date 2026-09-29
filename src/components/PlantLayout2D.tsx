import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ProcessZone, WarehouseInfo, SimulationState, MheItem, ThemeMode } from '../types/plant';
import { requestEditAuthorization, getRememberedEmail } from '../lib/editAuth';
import { useStationPositions } from '../lib/stationPositions';
import { classifyStation, drawEquipmentGlyph, EquipmentKind } from '../lib/equipmentGlyphs';
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
import plantOpsBackgroundImg from '../assets/images/robotics.jpg';
import plantFloorBackgroundImg from '../assets/images/plant.png';

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
  labelWidth?: number;
  cycleCount: number;
  targetRoute?: string | null;
}

const formatShiftTime = (seconds: number) => {
  const startHour = 6;
  const totalMinutes = Math.floor(seconds / 60);
  const hrs = startHour + Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const secs = Math.floor(seconds % 60);
  const hh = String(hrs).padStart(2, '0');
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

interface Particle {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
  progress: number;
  type: 'cell' | 'cell_stack' | 'pack' | 'tray';
}

interface TruckVehicle {
  id: string;
  type: 'inbound_cell' | 'material_tray' | 'outbound_pack';
  /**
   * The dock node this truck has been dispatched to. Arrival, dwell and the
   * stock transfer are all resolved through this id, so a truck can only ever
   * berth at its own warehouse — previously every westbound truck stopped at a
   * fixed `x >= 10`, which put the cell truck's nose through the WH-1 wall and
   * left the outbound truck parked ~200 units short of the WH-2 dispatch bay.
   */
  dockNodeId: string;
  /** +1 approaches from the west and berths on the dock's west face; -1 from the east. */
  dir: 1 | -1;
  x: number;
  y: number;
  state: 'arriving' | 'docked' | 'departing';
  timer: number;
  batchSize: number;
}

/**
 * Truck body geometry in world units. These mirror the canvas draw calls in
 * `renderCanvas` exactly: a 110-wide trailer with a 32-wide cab on the leading
 * end, so a truck occupies 142 units from tail to nose.
 */
const TRUCK_TRAILER_W = 110;
const TRUCK_CAB_W = 32;
const TRUCK_LENGTH = TRUCK_TRAILER_W + TRUCK_CAB_W;
/** Gap held between the truck's nose and the dock face when berthed. */
const TRUCK_DOCK_CLEARANCE = 12;
/** How far outside its berth a truck spawns / drives to before it is culled. */
const TRUCK_APPROACH_RUN = 420;

/**
 * Trims `text` with an ellipsis until it fits `maxWidth` at the context's
 * current font. Measured rather than cut at a fixed character count, because
 * "CY_14" and "BESS Module/Pack Stacking & Rigging" occupy very different room
 * for the same number of characters.
 */
const elideCache: Record<string, string> = {};
const textWidthCache: Record<string, number> = {};

function getCachedTextWidth(ctx: CanvasRenderingContext2D, text: string, font: string): number {
  const key = `${font}:${text}`;
  const hit = textWidthCache[key];
  if (hit !== undefined) return hit;
  const w = ctx.measureText(text).width;
  if (Object.keys(textWidthCache).length < 2500) {
    textWidthCache[key] = w;
  }
  return w;
}

function elideToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const font = ctx.font;
  const cacheKey = `${font}:${Math.round(maxWidth)}:${text}`;
  const hit = elideCache[cacheKey];
  if (hit !== undefined) return hit;

  if (getCachedTextWidth(ctx, text, font) <= maxWidth) {
    elideCache[cacheKey] = text;
    return text;
  }
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (getCachedTextWidth(ctx, text.slice(0, mid) + '…', font) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  const result = lo > 0 ? text.slice(0, lo) + '…' : '';
  if (Object.keys(elideCache).length < 2500) {
    elideCache[cacheKey] = result;
  }
  return result;
}

/**
 * The x a truck body must rest at so its nose stops just short of `node`'s
 * face rather than inside or past the building. `dir` is the truck's travel
 * direction, matching `TruckVehicle.dir`.
 */
const dockRestX = (node: { x: number; w: number }, dir: 1 | -1): number =>
  dir === 1
    ? node.x - node.w / 2 - TRUCK_DOCK_CLEARANCE - TRUCK_LENGTH
    : node.x + node.w / 2 + TRUCK_DOCK_CLEARANCE + TRUCK_CAB_W;

interface FloatingText {
  /**
   * Optional: nothing reads it. These are drawn straight to the canvas and
   * removed by index as their `life` expires, so there is no React key to
   * satisfy — and four of the eight push sites never supplied one anyway.
   */
  id?: string;
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
  const [isPipelineHudExpanded, setIsPipelineHudExpanded] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  });

  // Selected Node / Zone Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // View Camera State (Pan & Zoom) - Centered Default around (1900, 1050)
  const [camera, setCamera] = useState<{ x: number; y: number; scale: number }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const h = typeof window !== 'undefined' ? window.innerHeight - 140 : 800;
    const scale = Math.min(Math.max(Math.min((w - 40) / 3900, (h - 40) / 1500), 0.18), 0.52);
    return {
      x: Math.round(w / 2 - 1900 * scale),
      y: Math.round(h / 2 - 1050 * scale),
      scale,
    };
  });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
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

  // Shift Target sliders — normally just a readout of gwhTarget/packKwh/
  // shiftsCount, but dragging either slider sets a direct override (packs is
  // authoritative; capacity is packs × packKwh). Editing any upstream driver
  // clears the override so the two sliders go back to auto-tracking it.
  const [targetOverridePacks, setTargetOverridePacks] = useState<number | null>(null);

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
  const autoShiftPacksReq = Math.ceil(dailyPacksReq / Math.max(1, shiftsCount));
  // The slider override (see targetOverridePacks above) takes over here, so
  // every downstream number below — required takt, auto-scaled threads,
  // factory height, the HUD/summary readouts — reflects it automatically.
  const shiftPacksReq = targetOverridePacks ?? autoShiftPacksReq;
  const requiredLineTakt = parseFloat(((shiftHours * 3600) / Math.max(1, shiftPacksReq)).toFixed(2));
  const shiftCapacityKwh = Math.round(shiftPacksReq * packKwh);

  // Any upstream driver of the auto shift target clears a standing override,
  // so the two new sliders resume tracking it — "adjusts when related
  // quantities are edited".
  const clearTargetOverride = () => setTargetOverridePacks(null);

  // Auto-Scaled Machine Threads
  const tOCV = Math.max(1, Math.ceil(0.1 / requiredLineTakt));
  const tStack = Math.max(1, Math.ceil(stackerCycle / requiredLineTakt));
  const tCln = Math.max(1, Math.ceil(15 / requiredLineTakt));
  const tFpc = Math.max(1, Math.ceil(20 / requiredLineTakt));
  const tWeld = Math.max(1, Math.ceil(weldCycle / requiredLineTakt));
  const tCcd = Math.max(1, Math.ceil(10 / requiredLineTakt));
  const tCycler = Math.max(1, Math.ceil(cyclerCycle / requiredLineTakt));

  // Dynamic Pipeline Priming Lead Time (Physical transit across all 8 zones)
  const dynamicPrimingTimeSec = useMemo(() => {
    const z1Transit = 45; // Inbound AGVs & Depalletizing
    const z2Transit = 60; // OCV/IR, Hi-Pot, EIS, Plasma Cleaning
    const z3Transit = Math.round((stackerCycle * Math.ceil(cellsPerPack / 48)) / Math.max(1, tStack) + 75);
    const z4Transit = Math.round(15 + 20 + (weldCycle * 2) / Math.max(1, tWeld) + 12);
    const z5Transit = 45 + 15 + 40 + 50; // Tray Prep, TIM, Marriage M01, Fastening
    const z6Transit = 30 + 40 + 35 + 45; // BMS Install, HV Cabling, BMS Test, Gasket Dispense, Cover Torque
    const z7Transit = Math.round(30 + 25 + (cyclerCycle / Math.max(1, tCycler)) + 30); // Leak, Hipot, EOL Cycler, Quality Gate
    const z8Transit = 30; // Transfer to finished racking
    return Math.max(300, z1Transit + z2Transit + z3Transit + z4Transit + z5Transit + z6Transit + z7Transit + z8Transit);
  }, [stackerCycle, weldCycle, cyclerCycle, cellsPerPack, tStack, tWeld, tCycler]);

  // Factory Dimensions
  const FACTORY_W = 4000;
  const FACTORY_H = Math.max(1900, 500 + Math.max(tStack, tWeld, tCycler) * 110);

  // Line Priming Mode State (Steady-State 26.7s Cadence vs Cold-Start Priming)
  const isLinePrimedState = simState.isPrimed ?? true;

  // Refs for Animation Loop State
  const nodesRef = useRef<{ [key: string]: CanvasNode }>({});
  const linksRef = useRef<{ from: string; to: string }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const trucksRef = useRef<TruckVehicle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const glyphKindCacheRef = useRef<Record<string, EquipmentKind>>({});

  // Shared station positions: saved to Supabase on drop, applied over the
  // generated layout on load, and pushed live to every other open browser.
  const stationPositions = useStationPositions();
  // Read inside buildFactoryModel without making it a dependency — the model
  // must not be rebuilt (resetting every buffer's stock) just because a
  // colleague nudged one station.
  const savedPositionsRef = useRef(stationPositions.positions);
  savedPositionsRef.current = stationPositions.positions;


  /**
   * Unlocking lets stations be dragged to new floor positions, so it goes
   * behind the same engineering password challenge as a database write.
   * Re-locking is always allowed — nothing is at risk in making the floor
   * read-only again, and an operator must never be unable to protect it.
   */
  const toggleLayoutLock = useCallback(async () => {
    const wasLocked = isLayoutLocked;
    if (wasLocked) {
      const authResult = await requestEditAuthorization(
        'Unlock plant floor layout',
        'Allows stations to be dragged and repositioned on the digital twin canvas'
      );
      if (!authResult.authorised) return;
    }
    setIsLayoutLocked(!wasLocked);
    floatingTextsRef.current.push({
      text: wasLocked ? '🔓 Edit Mode: Drag Stations to Move' : '🔒 Layout Locked (Accidental Moves Blocked)',
      x: 1900,
      y: FACTORY_H / 2 - 100,
      color: wasLocked ? '#F59E0B' : '#10B981',
      life: 2.5,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLayoutLocked, FACTORY_H]);
  const plantZonesRef = useRef<{ [key: string]: string[] }>({});
  const statsRef = useRef<{ cellsIn: number; packsOut: number }>({ cellsIn: 0, packsOut: 0 });

  // Timers for logistics arrivals
  const inboundTimerRef = useRef<number>(5);
  const materialTimerRef = useRef<number>(10);
  const outboundTimerRef = useRef<number>(15);

  // Build / Re-provision Factory Model Function
  const buildFactoryModel = useCallback((forcePrimed?: boolean) => {
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
        cycleCount: 0,
        targetRoute: null,
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

    const midY = 560;
    const lowerY = 1000;
    const bessY = 1420;

    // --- ZONE 1: CELL RECEIVING, BARCODE & INBOUND HANDLING (Z1) ---
    addNode('W01', 'WH-1 Inbound Cell Dock', 'IO', 120, midY, 150000, 0.01, 'z1', false, 'Cells');
    addNode('C.1.1.1', 'AGVs, Cell Tray Transfer', 'M', 260, midY, 100, 12, 'z1', false, 'Cells');
    addNode('C.1.1.2', 'Cell Depalletizer Robot', 'M', 400, midY, 50, 24, 'z1', false, 'Cells');
    addNode('C.1.1.3', 'Barcode & MES Registration', 'M', 540, midY, 50, 24, 'z1', false, 'Cells');
    addNode('C.1.1.4', 'Kitting & Sequencing Benches', 'M', 680, midY, 50, 26, 'z1', false, 'Cells');
    addNode('B01', 'Cell Storage Buffer', 'B', 820, midY, 10000, 0.01, 'z1', false, 'Cells');

    // --- ZONE 2: CELL CONDITIONING, GRADING & SORTING (Z2) ---
    const ocvNodes = addParallelBlock('OCV_', 'Cell OCV Tester', 'M', 980, midY, tOCV, 1, 0.1, 'z2', 80, false, 'Cells');
    addNode('C_Sort', 'OCV Sort Gateway', 'M', 1140, midY, 20, 0.1, 'z2', false, 'Cells');
    addNode('Q_Bay', 'Defect Cell Reject Bay', 'B', 1140, midY + 140, 500, 0.1, 'z2', false, 'Cells');
    addNode('C.1.2.2', 'Hi-Pot & Leakage Test', 'M', 1280, midY, 20, 25, 'z2', false, 'Cells');
    addNode('C.1.2.3', 'EIS Characterisation', 'M', 1420, midY, 20, 24, 'z2', false, 'Cells');
    addNode('C_Clean', 'Cell Surface Plasma Cleaner', 'M', 1560, midY, 20, 24, 'z2', false, 'Cells');
    addNode('B02', 'Pre-Stack Cell Buffer', 'B', 1700, midY, 1000, 1, 'z2', false, 'Cells');

    // --- ZONE 3: CELL STACKING, 2K ADHESIVE (AMBIENT CHEMICAL CURE) & COMPRESSION (Z3) ---
    const stackCap = cellsPerPack * 2;
    const stackNodes = addParallelBlock(
      'S_BOT_',
      'Stacker Robot',
      'M',
      1860,
      midY,
      tStack,
      stackCap,
      stackerCycle,
      'z3',
      90,
      true,
      'Cells'
    );
    addNode('S_Adhesive', '2K Cell Structural Adhesive (Chemical Cure)', 'M', 2020, midY, 4, 18, 'z3', false, 'Cell Stacks');
    addNode('S_Comp', 'Stack Compression & Banding (30kN)', 'M', 2160, midY, 4, 8, 'z3', false, 'Cell Stacks');
    addNode('C.1.3.4', 'Stack Pressure Test Gauge', 'M', 2300, midY, 4, 12, 'z3', false, 'Cell Stacks');
    addNode('C.1.3.5', 'Fire Retardant Application', 'M', 2440, midY, 4, 24, 'z3', false, 'Cell Stacks');
    addNode('B03', 'Pre-Weld Cell Stack Buffer', 'B', 2580, midY, 50, 1, 'z3', false, 'Cell Stacks');

    // --- ZONE 4: CLEAN & DRY ROOM LASER BUSBAR WELDING (Z4) ---
    const clnNodes = addParallelBlock('W_CLN_', 'Cell Terminal Laser Cleaner', 'M', 2720, midY, tCln, 2, 15, 'z4', 95, false, 'Cell Stacks');
    addNode('B_C1', 'Clean Buffer #1', 'B', 2840, midY, 20, 1, 'z4', false, 'Cell Stacks');

    const fpcNodes = addParallelBlock('W_FPC_', 'Busbar Inserter', 'M', 2980, midY, tFpc, 2, 20, 'z4', 95, false, 'Cell Stacks');
    addNode('B_C2', 'Clean Buffer #2', 'B', 3100, midY, 20, 1, 'z4', false, 'Cell Stacks');

    const weldNodes = addParallelBlock('W_L_', '3kW Busbar Laser Welder', 'M', 3240, midY, tWeld, 2, weldCycle, 'z4', 95, false, 'Cell Stacks');
    addNode('B_C3', 'Clean Buffer #3', 'B', 3360, midY, 20, 1, 'z4', false, 'Cell Stacks');

    const ccdNodes = addParallelBlock('W_CCD_', 'Weld Bead Inspection', 'M', 3500, midY, tCcd, 2, 10, 'z4', 95, false, 'Cell Stacks');
    addNode('CCD_Sort', 'Bead Quality Gateway', 'M', 3640, midY, 10, 0.1, 'z4', false, 'Cell Stacks');
    addNode('Q_Bead_Reject', 'Bead Reject Quarantine', 'B', 3640, midY + 140, 100, 0.1, 'z4', false, 'Cell Stacks');
    addNode('B04', 'Cell Stack Buffer', 'B', 3780, midY, 50, 1, 'z4', false, 'Cell Stacks');

    // --- ZONE 5 & ZONE 6: PACK MARRIAGE & ASSEMBLY (Z5 & Z6 - Lower Serpentine Track) ---
    addNode('W05_Mat_In', 'WH-4 Material Delivery Dock', 'IO', 3780, lowerY, 15000, 0.01, 'z5', false, 'Trays');
    addNode('B_Mat', 'WH-4 Non-Live Component Store', 'B', 3640, lowerY, 2000, 0.01, 'z5', false, 'Trays');
    addNode('P01', 'Conveyor Spine / Tray Infeed', 'M', 3500, lowerY, 5, 5, 'z5', false, 'Trays');
    addNode('C.1.5.2', 'Robotic Pack Cleaning & Dispense', 'M', 3360, lowerY, 5, 15, 'z5', false, 'Trays');
    addNode('C.1.5.3', 'Cooling Plate Sub-Assembly', 'M', 3220, lowerY, 5, 15, 'z5', false, 'Trays');
    addNode('P02', 'TIM Thermal Paste Dispenser', 'M', 3080, lowerY, 5, 10, 'z5', false, 'Trays');
    addNode('C.1.5.5', 'Laser Profilometer (Bond Line)', 'M', 2940, lowerY, 5, 12, 'z5', false, 'Trays');

    addNode('M01', 'Pack Marriage Robot', 'M', 2780, lowerY, 2, 15, 'z5', false, 'Packs');
    nodes['M01'].auxInventory = 0;

    addNode('M02', 'Structural Fastening Cell', 'M', 2620, lowerY, 2, 20, 'z5', false, 'Packs');
    addNode('M03', 'BMS Slave & Master Installation', 'M', 2460, lowerY, 2, 15, 'z6', false, 'Packs');
    addNode('M04', 'HV Cable Routing & Termination', 'M', 2300, lowerY, 2, 25, 'z6', false, 'Packs');
    addNode('C.1.6.4', 'BMS Tester', 'M', 2140, lowerY, 2, 18, 'z6', false, 'Packs');
    addNode('C.1.6.5', 'BMS Calibration', 'M', 2000, lowerY, 2, 15, 'z6', false, 'Packs');
    addNode('C.1.6.6', 'Off-Gas Sensors Integration', 'M', 1860, lowerY, 2, 12, 'z6', false, 'Packs');
    addNode('C.1.5.8', '2K PU Foam IP67 Gasket Dispenser', 'M', 1720, lowerY, 4, 24, 'z5', false, 'Packs');
    addNode('C.1.5.9', '2K Adhesive Room-Temp Cure Buffer', 'B', 1580, lowerY, 50, 0.01, 'z5', false, 'Packs');
    addNode('C.1.5.10', 'Cover Sealing Torque Assembly', 'M', 1440, lowerY, 2, 15, 'z5', false, 'Packs');
    addNode('B05', 'Pre-Seal Pack Buffer', 'B', 1300, lowerY, 30, 1, 'z5', false, 'Packs');

    // --- ZONE 7 & ZONE 8: END OF LINE VALIDATION, AGEING & FINISHED STORE (Z7 & Z8) ---
    addNode('B06', 'EOL Test Buffer', 'B', 1160, lowerY, 30, 1, 'z7', false, 'Packs');
    addNode('C.1.7.1', 'Seal Leak Testing', 'M', 1020, lowerY, 2, 25, 'z7', false, 'Packs');
    addNode('T01', 'IP67 Pressure Decay & Helium Test', 'M', 880, lowerY, 2, 20, 'z7', false, 'Packs');
    addNode('T02', 'Hipot Electrical Isolation', 'M', 740, lowerY, 2, 15, 'z7', false, 'Packs');

    // "E"-Type Multi-Tier Comb / Hatch Array for EOL Battery Cyclers
    const eolArms = 3;
    const cyclerNodes: string[] = [];
    const cyclerPerArm = Math.ceil(tCycler / eolArms);
    const cyclerSpacingX = 80;
    const cyclerArmSpacingY = 100;
    const cyclerBaseX = 660;
    const cyclerBaseY = lowerY;

    for (let i = 0; i < tCycler; i++) {
      const arm = i % eolArms; // 0 (Tier A Top), 1 (Tier B Mid), 2 (Tier C Bot)
      const slot = Math.floor(i / eolArms); // 0, 1, 2...
      const cycX = cyclerBaseX - slot * cyclerSpacingX;
      const cycY = cyclerBaseY + (arm - 1) * cyclerArmSpacingY;
      const id = `CY_${i + 1}`;
      const tierLabel = arm === 0 ? 'Tier A Form' : arm === 1 ? 'Tier B Age' : 'Tier C Cap';
      addNode(id, `EOL Cycler #${i + 1} (${tierLabel})`, 'M', cycX, cycY, 1, cyclerCycle, 'z7', false, 'Packs');
      cyclerNodes.push(id);
    }

    const minCycX = cyclerBaseX - (cyclerPerArm - 1) * cyclerSpacingX;
    const qgX = Math.min(minCycX - 90, 360);
    addNode('C.1.7.5', 'Vibration Test Rig', 'M', qgX + 40, lowerY + 140, 2, 30, 'z7', false, 'Packs');
    addNode('T_QG', 'Final Quality Gate (QG)', 'M', qgX, lowerY, 2, 10, 'z7', false, 'Packs');
    addNode('W03_Out', 'WH-2 Pack Racking Store', 'B', qgX - 140, lowerY, 2000, 1, 'z8', false, 'Packs');
    addNode('W04_Out', 'WH-2 Outbound Dispatch Dock', 'IO', qgX - 260, lowerY, 1000, 1, 'z8', false, 'Packs');

    // --- ZONE BESS: BESS UTILITY CONTAINER INTEGRATION LINE (Z_BESS) ---
    addNode('B_BESS_Buf', 'BESS Pack Buffer Bank (Min. 20 Packs)', 'B', 2780, lowerY + 170, 50, 1, 'z_bess', false, 'Packs');
    addNode('BESS_Stack', 'BESS Module/Pack Stacking & Rigging', 'M', 2780, bessY, 2, 45, 'z_bess', false, 'Packs');
    addNode('BESS_Plate', 'Cold Plate Cooling Integration', 'M', 2560, bessY, 2, 35, 'z_bess', false, 'Racks');
    addNode('BESS_Weld', '1500V DC Busbar Welder', 'M', 2340, bessY, 2, 40, 'z_bess', false, 'Racks');
    addNode('BESS_BMS', 'HV String BMS Controller Cell', 'M', 2120, bessY, 2, 30, 'z_bess', false, 'Racks');
    addNode('BESS_Test', '1500V Megawatt Hipot Cycler', 'M', 1900, bessY, 2, 120, 'z_bess', false, 'Racks');
    addNode('BESS_Gantry', 'Twin 30T Gantry Crane Bay', 'M', 1680, bessY, 2, 60, 'z_bess', false, 'Containers');
    addNode('W05_BESS', 'WH-3 BESS Container Staging Yard', 'IO', 1460, bessY, 50, 1, 'z_bess', false, 'Containers');

    // Linkages - Top Row
    addLink('W01', 'C.1.1.1');
    addLink('C.1.1.1', 'C.1.1.2');
    addLink('C.1.1.2', 'C.1.1.3');
    addLink('C.1.1.3', 'C.1.1.4');
    addLink('C.1.1.4', 'B01');

    ocvNodes.forEach(id => addLink('B01', id));
    ocvNodes.forEach(id => addLink(id, 'C_Sort'));
    addLink('C_Sort', 'C.1.2.2');
    addLink('C_Sort', 'Q_Bay');
    addLink('C.1.2.2', 'C.1.2.3');
    addLink('C.1.2.3', 'C_Clean');
    addLink('C_Clean', 'B02');

    stackNodes.forEach(id => addLink('B02', id));
    stackNodes.forEach(id => addLink(id, 'S_Adhesive'));
    addLink('S_Adhesive', 'S_Comp');
    addLink('S_Comp', 'C.1.3.4');
    addLink('C.1.3.4', 'C.1.3.5');
    addLink('C.1.3.5', 'B03');

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

    // Linkages - Lower Serpentine Track
    addLink('W05_Mat_In', 'B_Mat');
    addLink('B_Mat', 'P01');
    addLink('P01', 'C.1.5.2');
    addLink('C.1.5.2', 'C.1.5.3');
    addLink('C.1.5.3', 'P02');
    addLink('P02', 'C.1.5.5');
    addLink('C.1.5.5', 'M01');

    addLink('B04', 'M01');
    addLink('M01', 'M02');
    addLink('M02', 'M03');
    addLink('M03', 'M04');
    addLink('M04', 'C.1.6.4');
    addLink('C.1.6.4', 'C.1.6.5');
    addLink('C.1.6.5', 'C.1.6.6');
    addLink('C.1.6.6', 'C.1.5.8');
    addLink('C.1.5.8', 'C.1.5.9');
    addLink('C.1.5.9', 'C.1.5.10');
    addLink('C.1.5.10', 'B05');
    addLink('B05', 'B06');

    addLink('B06', 'C.1.7.1');
    addLink('C.1.7.1', 'T01');
    addLink('T01', 'T02');

    cyclerNodes.forEach(id => addLink('T02', id));
    cyclerNodes.forEach(id => addLink(id, 'T_QG'));
    addLink('T02', 'C.1.7.5');
    addLink('C.1.7.5', 'T_QG');

    addLink('T_QG', 'W03_Out');
    addLink('W03_Out', 'W04_Out');

    // Linkages - BESS Integration Line
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
      'Z1: CELL RECEIVING & INBOUND HANDLING': ['W01', 'C.1.1.1', 'C.1.1.2', 'C.1.1.3', 'C.1.1.4', 'B01'],
      'Z2: CELL CONDITIONING, GRADING & SORTING': [...ocvNodes, 'C_Sort', 'Q_Bay', 'C.1.2.2', 'C.1.2.3', 'C_Clean', 'B02'],
      'Z3: CELL STACKING, 2K ADHESIVE & COMPRESSION': [...stackNodes, 'S_Adhesive', 'S_Comp', 'C.1.3.4', 'C.1.3.5', 'B03'],
      'Z4: CLEANROOM LASER BUSBAR WELDING': [...clnNodes, 'B_C1', ...fpcNodes, 'B_C2', ...weldNodes, 'B_C3', ...ccdNodes, 'CCD_Sort', 'Q_Bead_Reject', 'B04'],
      'Z5: PACK MARRIAGE & SEALING ASSEMBLY': ['W05_Mat_In', 'B_Mat', 'P01', 'C.1.5.2', 'C.1.5.3', 'P02', 'C.1.5.5', 'M01', 'M02', 'C.1.5.8', 'C.1.5.9', 'C.1.5.10', 'B05'],
      'Z6: BMS & ELECTRICAL HARNESSING': ['M03', 'M04', 'C.1.6.4', 'C.1.6.5', 'C.1.6.6'],
      'Z7: END-OF-LINE TESTING & QUALITY': ['B06', 'C.1.7.1', 'T01', 'T02', ...cyclerNodes, 'C.1.7.5', 'T_QG'],
      'Z8: PACKAGING & FINISHED STORE (4-DAY BUFFER)': ['W03_Out', 'W04_Out'],
      'Z_BESS: BESS CONTAINER & RACK INTEGRATION': ['B_BESS_Buf', 'BESS_Stack', 'BESS_Plate', 'BESS_Weld', 'BESS_BMS', 'BESS_Test', 'BESS_Gantry', 'W05_BESS'],
    };

    // Dictionary of Census machine alias mappings to standard model nodes
    const censusNodeMap: Record<string, string> = {
      'C.1.1.1': 'C.1.1.1',
      'C.1.1.2': 'C.1.1.2',
      'C.1.1.3': 'C.1.1.3',
      'C.1.1.4': 'C.1.1.4',
      'C.1.2.1': 'OCV_1',
      'C.1.2.2': 'C.1.2.2',
      'C.1.2.3': 'C.1.2.3',
      'C.1.2.4': 'C_Clean',
      'C.1.3.1': 'S_BOT_1',
      'C.1.3.2': 'S_Adhesive',
      'C.1.3.3': 'S_Comp',
      'C.1.3.4': 'C.1.3.4',
      'C.1.3.5': 'C.1.3.5',
      'C.1.4.1': 'W_CLN_1',
      'C.1.4.2': 'W_L_1',
      'C.1.4.3': 'W_CCD_1',
      'C.1.5.1': 'P01',
      'C.1.5.2': 'C.1.5.2',
      'C.1.5.3': 'C.1.5.3',
      'C.1.5.4': 'P02',
      'C.1.5.5': 'C.1.5.5',
      'C.1.5.6': 'M01',
      'C.1.5.7': 'M02',
      'C.1.5.8': 'C.1.5.8',
      'C.1.5.9': 'C.1.5.9',
      'C.1.5.10': 'C.1.5.10',
      'C.1.6.1': 'W_FPC_1',
      'C.1.6.2': 'M03',
      'C.1.6.3': 'M04',
      'C.1.6.4': 'C.1.6.4',
      'C.1.6.5': 'C.1.6.5',
      'C.1.6.6': 'C.1.6.6',
      'C.1.7.1': 'C.1.7.1',
      'C.1.7.2': 'T01',
      'C.1.7.3': 'T02',
      'C.1.7.4': 'CY_1',
      'C.1.7.5': 'C.1.7.5',
      'C.2.1.1': 'BESS_Stack',
      'C.2.1.2': 'BESS_Plate',
      'C.2.1.3': 'BESS_Weld',
      'C.2.1.4': 'BESS_BMS',
      'C.2.1.5': 'BESS_Test',
      'C.2.1.6': 'BESS_Gantry',
      'C.2.1.7': 'W05_BESS',
    };

    // Dynamically instantiate and route ANY custom machines added from the Machine Census
    (zones || []).forEach(z => {
      z.machines.forEach(m => {
        const mappedId = censusNodeMap[m.id] || m.id;
        // If node already exists or is mapped to a standard machine, do not create duplicate
        if (nodes[mappedId] || nodes[m.id]) return;

        let posX = 1500;
        let posY = midY;

        // Helper to find a node by ID, WBS code, or station name
        const findNodeRef = (refKey?: string) => {
          if (!refKey || refKey === 'auto') return null;
          const targetKey = censusNodeMap[refKey] || refKey;
          if (nodes[targetKey]) return nodes[targetKey];
          if (nodes[refKey]) return nodes[refKey];
          // Match against wbs code or id
          for (const nid in nodes) {
            if (nid.toLowerCase() === refKey.toLowerCase() || nodes[nid].label.toLowerCase().includes(refKey.toLowerCase())) {
              return nodes[nid];
            }
          }
          return null;
        };

        const prev = findNodeRef(m.precedingStationId);
        const next = findNodeRef(m.succeedingStationId);

        if (prev && next) {
          posX = (prev.x + next.x) / 2;
          posY = (prev.y + next.y) / 2;
        } else if (prev) {
          const isLower = prev.y > midY + 100;
          posX = isLower ? prev.x - 140 : prev.x + 140;
          posY = prev.y;
        } else if (next) {
          const isLower = next.y > midY + 100;
          posX = isLower ? next.x + 140 : next.x - 140;
          posY = next.y;
        } else {
          const zoneKey = z.wbsCode.toLowerCase();
          if (zoneKey.includes('z1')) { posX = 750; posY = midY; }
          else if (zoneKey.includes('z2')) { posX = 1630; posY = midY; }
          else if (zoneKey.includes('z3')) { posX = 2510; posY = midY; }
          else if (zoneKey.includes('z4')) { posX = 3040; posY = midY; }
          else if (zoneKey.includes('z5')) { posX = 3150; posY = lowerY; }
          else if (zoneKey.includes('z6')) { posX = 2220; posY = lowerY; }
          else if (zoneKey.includes('z7') || zoneKey.includes('z8')) { posX = 950; posY = lowerY; }
          else if (zoneKey.includes('bess')) { posX = 2200; posY = bessY; }
        }

        const unitType = m.unit || (z.wbsCode === 'Z1' ? 'Cells' : z.wbsCode === 'Z4' || z.wbsCode === 'Z5' ? 'Packs' : 'Cell Stacks');
        addNode(
          m.id,
          m.name,
          'M',
          posX,
          posY,
          Math.max(2, m.machinesCount * (m.packsPerCycle || 1) * 2),
          Math.max(1, m.cycleTimeSec / Math.max(1, m.machinesCount)),
          z.id,
          false,
          unitType
        );

        if (prev) {
          addLink(prev.id, m.id);
        }
        if (next) {
          addLink(m.id, next.id);
        }

        const targetZoneHeader = Object.keys(plantZonesRef.current).find(k => k.includes(z.wbsCode)) || 'Z3: CELL STACKING, 2K ADHESIVE & COMPRESSION';
        if (plantZonesRef.current[targetZoneHeader]) {
          plantZonesRef.current[targetZoneHeader].push(m.id);
        }
      });
    });

    // Caption width budget: the gap to the nearest station on the same row,
    // less a small margin. A station standing alone keeps its full name; one in
    // a dense block gets an elided one rather than colliding with its
    // neighbours. `n.w` is the floor, so a caption is never narrower than the
    // station it names.
    const layoutIds = Object.keys(nodes);
    for (const id of layoutIds) {
      const n = nodes[id];
      let nearest = 240;
      for (const otherId of layoutIds) {
        if (otherId === id) continue;
        const o = nodes[otherId];
        if (Math.abs(o.y - n.y) > 45) continue; // not on this row
        const dx = Math.abs(o.x - n.x);
        if (dx > 0) nearest = Math.min(nearest, dx);
      }
      n.labelWidth = Math.max(n.w, nearest - 10);
    }

    // Labels can change when the census changes, and the glyph is chosen from
    // the label — so the classification cache is dropped with the old model.
    glyphKindCacheRef.current = {};

    // Lay the team's saved positions over the generated layout. Entries for
    // stations this build did not produce are ignored rather than treated as an
    // error — editing the machine census changes which stations exist, and a
    // stale saved row must never be able to break the floor.
    const saved = savedPositionsRef.current;
    for (const id in saved) {
      if (nodes[id]) {
        nodes[id].x = saved[id].x;
        nodes[id].y = saved[id].y;
      }
    }

    // Store in refs
    nodesRef.current = nodes;
    linksRef.current = links;

    // Initial stock - calibrated for steady-state 26.7s cadence vs cold-start priming
    const isPrimed = forcePrimed !== undefined ? forcePrimed : (simState.isPrimed ?? true);
    nodes['W01'].inventory = 150000;
    nodes['B_Mat'].inventory = 1000;
    if (!isPrimed) {
      nodes['B01'].inventory = 0;
      nodes['B02'].inventory = 0;
      nodes['B03'].inventory = 0;
      nodes['B04'].inventory = 0;
      if (nodes['B_C1']) nodes['B_C1'].inventory = 0;
      if (nodes['B_C2']) nodes['B_C2'].inventory = 0;
      if (nodes['B_C3']) nodes['B_C3'].inventory = 0;
      if (nodes['B05']) nodes['B05'].inventory = 0;
      if (nodes['B06']) nodes['B06'].inventory = 0;
      nodes['B_BESS_Buf'].inventory = 0;
      nodes['W03_Out'].inventory = 0;
      if (nodes['W04_Out']) nodes['W04_Out'].inventory = 0;
      for (const nid in nodes) {
        nodes[nid].cycleCount = 0;
        nodes[nid].targetRoute = null;
      }
    } else {
      nodes['B01'].inventory = 4500;
      nodes['B02'].inventory = 250;
      nodes['B03'].inventory = 12;
      if (nodes['B_C1']) nodes['B_C1'].inventory = 4;
      if (nodes['B_C2']) nodes['B_C2'].inventory = 4;
      if (nodes['B_C3']) nodes['B_C3'].inventory = 4;
      nodes['B04'].inventory = 15;
      if (nodes['B05']) nodes['B05'].inventory = 10;
      if (nodes['B06']) nodes['B06'].inventory = 12;
      nodes['B_BESS_Buf'].inventory = 20;
      nodes['W03_Out'].inventory = 280;
      if (nodes['W04_Out']) nodes['W04_Out'].inventory = 35;
      // Pre-seed logical, sequential gradient of completed production cycles down the line
      for (const nid in nodes) {
        const n = nodes[nid];
        const prevCount = nodesRef.current[nid]?.cycleCount;
        if (prevCount && prevCount > 0) {
          n.cycleCount = prevCount;
        } else if (n.zoneId === 'z1') {
          n.cycleCount = 1250;
        } else if (n.zoneId === 'z2') {
          n.cycleCount = 1220;
        } else if (n.zoneId === 'z3') {
          n.cycleCount = 1190;
        } else if (n.zoneId === 'z4') {
          n.cycleCount = 1165;
        } else if (n.zoneId === 'z5') {
          n.cycleCount = 1145;
        } else if (n.zoneId === 'z6') {
          n.cycleCount = 1125;
        } else if (n.zoneId === 'z7') {
          n.cycleCount = 1105;
        } else if (n.zoneId === 'z8') {
          n.cycleCount = 1080;
        } else if (n.zoneId === 'z_bess') {
          n.cycleCount = 24;
        } else {
          n.cycleCount = 1000;
        }
        n.targetRoute = null;
      }
    }
  }, [FACTORY_H, stackerCycle, weldCycle, cyclerCycle, requiredLineTakt, cellsPerPack, tOCV, tStack, tCln, tFpc, tWeld, tCcd, tCycler, zones, simState.isPrimed]);

  // Start / Simulate Cold-Start Priming
  const handleStartColdPriming = () => {
    if (setSimState) {
      setSimState(prev => ({
        ...prev,
        isPrimed: false,
        primingProgressPct: 0,
        primingLeadTimeSec: dynamicPrimingTimeSec,
        shiftTimeSeconds: 0,
        goodPacks: 0,
        processedPacks: 0,
        reworkedPacks: 0,
        scrappedPacks: 0,
        isRunning: true,
      }));
    }
    statsRef.current = { cellsIn: 0, packsOut: 0 };
    particlesRef.current = [];
    trucksRef.current = [];
    floatingTextsRef.current.push({
      text: `⏱️ Cold-Start Priming Active (Est. Lead: ${(dynamicPrimingTimeSec / 60).toFixed(0)} min)`,
      x: 1900,
      y: 950,
      color: '#06B6D4',
      life: 3.5,
    });
    buildFactoryModel(false);
  };

  // Switch to Pre-Primed Steady-State 26.7s Cadence
  const handleSetSteadyState = () => {
    if (setSimState) {
      setSimState(prev => ({
        ...prev,
        isPrimed: true,
        primingProgressPct: 100,
        primingLeadTimeSec: dynamicPrimingTimeSec,
        shiftTimeSeconds: Math.max(prev.shiftTimeSeconds, dynamicPrimingTimeSec),
        goodPacks: Math.max(1, prev.goodPacks),
        processedPacks: Math.max(1, prev.processedPacks),
        isRunning: true,
      }));
    }
    floatingTextsRef.current.push({
      text: `🚀 Steady-State Active: ${requiredLineTakt}s Continuous Cadence`,
      x: 1900,
      y: 950,
      color: '#10B981',
      life: 3.5,
    });
    buildFactoryModel(true);
  };

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

  // Positions arriving after the build — the first load finishing, or a
  // colleague moving a station — are applied straight onto the live nodes.
  // Rebuilding instead would reset every buffer's stock and restart the
  // material flow, which is far too violent a response to one station moving.
  useEffect(() => {
    const nodes = nodesRef.current;
    for (const id in stationPositions.positions) {
      const node = nodes[id];
      const saved = stationPositions.positions[id];
      // Never yank a station out from under the operator mid-drag.
      if (node && draggingNodeIdRef.current !== id) {
        node.x = saved.x;
        node.y = saved.y;
      }
    }
  }, [stationPositions.positions]);

  /**
   * Commits a dragged station's new position for the whole team.
   *
   * The layout was already unlocked behind the password challenge, so the drag
   * itself is not re-challenged — that would mean a prompt per nudge. If the
   * save fails (migration 0004 not run, or the database unreachable) the
   * station snaps back to where everyone else still sees it, rather than
   * leaving this browser showing a move nobody received.
   */
  const commitStationMove = useCallback(
    async (nodeId: string) => {
      const node = nodesRef.current[nodeId];
      if (!node) return;
      const { x, y } = node;
      const previous = savedPositionsRef.current[nodeId];
      try {
        await stationPositions.savePosition(nodeId, x, y, getRememberedEmail(), node.label);
        floatingTextsRef.current.push({
          text: `${node.label} moved — saved for everyone`,
          x,
          y: y - 35,
          color: '#3B82F6',
          life: 2.5,
        });
      } catch {
        const live = nodesRef.current[nodeId];
        if (live && previous) {
          live.x = previous.x;
          live.y = previous.y;
        }
        floatingTextsRef.current.push({
          text: 'Could not save station position — move reverted',
          x,
          y: y - 35,
          color: '#EF4444',
          life: 3.5,
        });
      }
    },
    [stationPositions]
  );

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
        // Dropped after a real drag: commit the move for the whole team.
        void commitStationMove(nodeId);
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

  // Touch Gesture Ref State (Pinch-to-zoom, single finger pan, station tap)
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startDist: number;
    startScale: number;
    startCamX: number;
    startCamY: number;
    isPinching: boolean;
    touchStartTime: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    startDist: 0,
    startScale: 1,
    startCamX: 0,
    startCamY: 0,
    isPinching: false,
    touchStartTime: 0,
    hasMoved: false,
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const t = e.touches[0];
      const clientX = t.clientX;
      const clientY = t.clientY;
      const worldX = (clientX - rect.left - camera.x) / camera.scale;
      const worldY = (clientY - rect.top - camera.y) / camera.scale;

      touchStateRef.current = {
        startX: clientX,
        startY: clientY,
        startDist: 0,
        startScale: camera.scale,
        startCamX: camera.x,
        startCamY: camera.y,
        isPinching: false,
        touchStartTime: Date.now(),
        hasMoved: false,
      };

      // Check if tapping a node
      let touchedNodeId: string | null = null;
      for (const id in nodesRef.current) {
        const n = nodesRef.current[id];
        if (
          worldX >= n.x - n.w / 2 - 12 &&
          worldX <= n.x + n.w / 2 + 12 &&
          worldY >= n.y - n.h / 2 - 12 &&
          worldY <= n.y + n.h / 2 + 12
        ) {
          touchedNodeId = id;
          break;
        }
      }

      if (!isLayoutLocked && touchedNodeId) {
        draggingNodeIdRef.current = touchedNodeId;
        const targetNode = nodesRef.current[touchedNodeId];
        dragOffsetRef.current = { x: worldX - targetNode.x, y: worldY - targetNode.y };
        setIsNodeDragging(true);
      }
    } else if (e.touches.length === 2) {
      // Pinch-to-zoom multi-touch start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      touchStateRef.current = {
        startX: midX,
        startY: midY,
        startDist: Math.max(10, dist),
        startScale: camera.scale,
        startCamX: camera.x,
        startCamY: camera.y,
        isPinching: true,
        touchStartTime: Date.now(),
        hasMoved: true,
      };
      draggingNodeIdRef.current = null;
      setIsNodeDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1 && !touchStateRef.current.isPinching) {
      const t = e.touches[0];
      const dx = t.clientX - touchStateRef.current.startX;
      const dy = t.clientY - touchStateRef.current.startY;
      if (Math.hypot(dx, dy) > 5) {
        touchStateRef.current.hasMoved = true;
      }

      if (!isLayoutLocked && draggingNodeIdRef.current) {
        const worldX = (t.clientX - rect.left - camera.x) / camera.scale;
        const worldY = (t.clientY - rect.top - camera.y) / camera.scale;
        const n = nodesRef.current[draggingNodeIdRef.current];
        if (n) {
          n.x = Math.round(worldX - dragOffsetRef.current.x);
          n.y = Math.round(worldY - dragOffsetRef.current.y);
        }
      } else {
        // Single-touch plant floor pan
        setCamera(prev => ({
          ...prev,
          x: touchStateRef.current.startCamX + dx,
          y: touchStateRef.current.startCamY + dy,
        }));
      }
    } else if (e.touches.length === 2) {
      // Pinch-to-zoom live interpolation
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const midY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const scaleRatio = dist / touchStateRef.current.startDist;
      const newScale = Math.min(2.5, Math.max(0.18, touchStateRef.current.startScale * scaleRatio));

      const worldPinchX = (touchStateRef.current.startX - touchStateRef.current.startCamX) / touchStateRef.current.startScale;
      const worldPinchY = (touchStateRef.current.startY - touchStateRef.current.startCamY) / touchStateRef.current.startScale;

      setCamera({
        scale: newScale,
        x: Math.round(midX - worldPinchX * newScale),
        y: Math.round(midY - worldPinchY * newScale),
      });
      touchStateRef.current.hasMoved = true;
    }
  };

  const handleTouchEnd = () => {
    if (draggingNodeIdRef.current) {
      const nodeId = draggingNodeIdRef.current;
      if (!touchStateRef.current.hasMoved) {
        setSelectedNodeId(nodeId);
        const node = nodesRef.current[nodeId];
        if (node && onSelectZone) onSelectZone(node.zoneId);
      } else {
        void commitStationMove(nodeId);
      }
      draggingNodeIdRef.current = null;
      setIsNodeDragging(false);
    } else if (!touchStateRef.current.hasMoved && Date.now() - touchStateRef.current.touchStartTime < 300) {
      // Tap on a station
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const touchX = touchStateRef.current.startX;
        const touchY = touchStateRef.current.startY;
        const worldX = (touchX - rect.left - camera.x) / camera.scale;
        const worldY = (touchY - rect.top - camera.y) / camera.scale;

        let foundNode: string | null = null;
        for (const id in nodesRef.current) {
          const n = nodesRef.current[id];
          if (
            worldX >= n.x - n.w / 2 - 14 &&
            worldX <= n.x + n.w / 2 + 14 &&
            worldY >= n.y - n.h / 2 - 14 &&
            worldY <= n.y + n.h / 2 + 14
          ) {
            foundNode = id;
            break;
          }
        }
        setSelectedNodeId(foundNode);
        if (foundNode && nodesRef.current[foundNode] && onSelectZone) {
          onSelectZone(nodesRef.current[foundNode].zoneId);
        }
      }
    }
    touchStateRef.current.isPinching = false;
  };

  // Auto-Center & Fit Plant Floor in Workspace (Centered at X: 1900, Y: 1050)
  const fitCameraToPlantFloor = useCallback((customW?: number, customH?: number) => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const w = customW || canvas?.width || (parent ? parent.clientWidth : window.innerWidth) || 1400;
    const h = customH || canvas?.height || (parent ? parent.clientHeight : window.innerHeight) || 800;

    // Plant layout spans X: ~60 to ~3850 (width ~ 3800), Y: ~400 to ~1600 (height ~ 1200)
    const plantW = 3900;
    const plantH = 1450;
    const paddingX = 60;
    const paddingY = 60;

    const scaleX = (w - paddingX * 2) / Math.max(100, plantW);
    const scaleY = (h - paddingY * 2) / Math.max(100, plantH);
    const optimalScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.18), 0.55);

    // Target center coordinates specified by engineering blueprint
    const targetCenterX = 1900;
    const targetCenterY = 1050;

    const newCam = {
      x: Math.round(w / 2 - targetCenterX * optimalScale),
      y: Math.round(h / 2 - targetCenterY * optimalScale),
      scale: optimalScale,
    };

    setCamera(newCam);
    return newCam;
  }, []);

  /**
   * Returns the floor to its generated blueprint. This discards the team's
   * saved positions for everyone, not just this browser, so it is challenged
   * and recorded like any other shared change.
   */
  const handleResetLayout = async () => {
    const { authorised, actorEmail } = await requestEditAuthorization(
      'Reset plant floor layout',
      'Discards every saved station position, for all users'
    );
    if (!authorised) return;
    try {
      await stationPositions.resetAll(actorEmail);
    } catch {
      floatingTextsRef.current.push({
        text: 'Could not clear saved positions — layout unchanged for others',
        x: 1900,
        y: 950,
        color: '#EF4444',
        life: 3.5,
      });
      return;
    }
    buildFactoryModel();
    floatingTextsRef.current.push({
      text: 'Floor Layout Reset to Default',
      x: 1900,
      y: 950,
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

      // Handle Trucks Logistics Arrival.
      // Each bay holds one vehicle at a time: a truck is only released when its
      // own dock is clear, and it carries that dock's id with it so arrival is
      // resolved against the real node position instead of a fixed x.
      const bayIsClear = (dockNodeId: string) => !trucks.some(t => t.dockNodeId === dockNodeId);

      const dispatchTruck = (
        type: TruckVehicle['type'],
        dockNodeId: string,
        dir: 1 | -1,
        batchSize: number
      ) => {
        const dock = nodes[dockNodeId];
        if (!dock || !bayIsClear(dockNodeId)) return;
        trucks.push({
          id: `${type}-${Date.now()}`,
          type,
          dockNodeId,
          dir,
          // Spawns one approach run outside its own berth, so the run-in length
          // is the same no matter where on the site that dock sits.
          x: dockRestX(dock, dir) - dir * TRUCK_APPROACH_RUN,
          y: dock.y,
          state: 'arriving',
          timer: 0,
          batchSize,
        });
      };

      inboundTimerRef.current -= simDt;
      if (inboundTimerRef.current <= 0) {
        dispatchTruck('inbound_cell', 'W01', 1, cellsPerInboundTruck);
        inboundTimerRef.current = 3600 / Math.max(0.1, inboundRate);
      }

      materialTimerRef.current -= simDt;
      if (materialTimerRef.current <= 0) {
        dispatchTruck('material_tray', 'W05_Mat_In', -1, 30);
        materialTimerRef.current = 3600 / Math.max(0.1, materialRate);
      }

      // STRICT GATING FOR OUTBOUND DISPATCH (W04_Out):
      // Gated by priming completion AND actual physical finished inventory accumulation in W04_Out
      const isLinePrimed = (simState.isPrimed ?? true) || simState.shiftTimeSeconds >= dynamicPrimingTimeSec;
      const w04Node = nodes['W04_Out'];
      const finishedPacksAvailable = w04Node ? w04Node.inventory : 0;

      outboundTimerRef.current -= simDt;
      if (isLinePrimed && w04Node && finishedPacksAvailable >= outboundBatch && outboundTimerRef.current <= 0) {
        dispatchTruck('outbound_pack', 'W04_Out', 1, outboundBatch);
        // Minimum pacing between outbound dispatch runs to prevent duplicate truck spawns
        outboundTimerRef.current = Math.max(12, requiredLineTakt * outboundBatch * 0.8);
      }

      // Update Truck Movements & Docking
      const truckSpeed = 90;
      for (let i = trucks.length - 1; i >= 0; i--) {
        const t = trucks[i];
        const visualDt = (simDt / simState.simulationSpeed) * 2;
        const dock = nodes[t.dockNodeId];

        // Its dock no longer exists (layout was rebuilt mid-run) — send it away
        // rather than let it berth on empty floor or transfer stock nowhere.
        if (!dock && t.state !== 'departing') {
          t.state = 'departing';
        }

        if (t.state === 'arriving' && dock) {
          // Re-derived every frame so a dock dragged in unlocked layout mode
          // still gets its truck squared up against the right wall.
          const restX = dockRestX(dock, t.dir);
          t.y = dock.y;
          t.x += t.dir * visualDt * truckSpeed;
          // Hard clamp at the berth: the nose stops at the dock face and the
          // truck can never run through or past the building.
          if (t.dir === 1 ? t.x >= restX : t.x <= restX) {
            t.x = restX;
            t.state = 'docked';
            t.timer = 8;
          }
        } else if (t.state === 'docked' && dock) {
          t.x = dockRestX(dock, t.dir);
          t.y = dock.y;
          t.timer -= visualDt;
          if (t.timer <= 0) {
            if (t.type === 'outbound_pack') {
              dock.inventory = Math.max(0, dock.inventory - t.batchSize);
              statsRef.current.packsOut += t.batchSize;
              floatingTexts.push({
                id: `ft-${Date.now()}`,
                text: `-${t.batchSize} Packs Dispatched`,
                x: dock.x,
                y: dock.y - 35,
                color: '#F97316',
                life: 2.5,
              });
            } else {
              dock.inventory = Math.min(dock.cap, dock.inventory + t.batchSize);
              if (t.type === 'inbound_cell') statsRef.current.cellsIn += t.batchSize;
              floatingTexts.push({
                id: `ft-${Date.now()}`,
                text:
                  t.type === 'inbound_cell'
                    ? `+${t.batchSize.toLocaleString()} Raw Cells`
                    : `+${t.batchSize} Material Trays`,
                x: dock.x,
                y: dock.y - 35,
                color: t.type === 'inbound_cell' ? '#10B981' : '#F59E0B',
                life: 2.5,
              });
            }
            t.state = 'departing';
          }
        } else if (t.state === 'departing') {
          // Reverses back out the way it came in.
          t.x -= t.dir * visualDt * truckSpeed;
          if (t.x < -TRUCK_APPROACH_RUN * 2 || t.x > FACTORY_W + TRUCK_APPROACH_RUN * 2) {
            trucks.splice(i, 1);
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
          if (canStart && n.currentTimer === 0 && n.status !== 'holding' && n.status !== 'blocked') {
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

        // Push to Next Line Nodes (from holding or unblocking machine / buffer)
        if ((n.status === 'holding' || n.status === 'blocked') && n.next.length > 0) {
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
              if (!n.targetRoute) {
                // Determine defect status ONCE when unit completes; do not re-roll 60Hz while blocked
                const isDefect = Math.random() < (defectRate / 100);
                n.targetRoute = isDefect ? 'Q_Bay' : 'C.1.2.2';
              }
              targetId = availableNexts.includes(n.targetRoute) ? n.targetRoute : null;
            } else if (id === 'CCD_Sort') {
              if (!n.targetRoute) {
                const isDefect = Math.random() < ((defectRate * 0.6) / 100);
                n.targetRoute = isDefect ? 'Q_Bead_Reject' : 'B04';
              }
              targetId = availableNexts.includes(n.targetRoute) ? n.targetRoute : null;
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

                if ((id === 'P02' || id === 'C.1.5.5') && targetId === 'M01') {
                  nodes[targetId].auxInventory = (nodes[targetId].auxInventory || 0) + outputQty;
                } else {
                  nodes[targetId].inventory += outputQty;
                }

                // Increment sequential completed cycles on machine
                if (n.type === 'M') {
                  n.cycleCount = (n.cycleCount || 0) + 1;
                }
                // Clear single-unit target route once transferred
                n.targetRoute = null;

                // Spawn particle
                let pType: 'cell' | 'cell_stack' | 'pack' | 'tray' = 'cell';
                if (
                  id.startsWith('S_') ||
                  id.startsWith('W_') ||
                  id === 'CCD_Sort' ||
                  id === 'B03' ||
                  id === 'B04' ||
                  id.startsWith('B_C') ||
                  id === 'C.1.3.4' ||
                  id === 'C.1.3.5'
                ) {
                  pType = 'cell_stack';
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
                  id.startsWith('BESS_') ||
                  id.startsWith('C.1.5.6') ||
                  id.startsWith('C.1.5.7') ||
                  id.startsWith('C.1.5.8') ||
                  id.startsWith('C.1.6.') ||
                  id.startsWith('C.1.7.')
                ) {
                  pType = 'pack';
                }
                if (id.startsWith('P0') || id === 'B_Mat' || id === 'W05_Mat_In' || id.startsWith('C.1.5.1') || id.startsWith('C.1.5.2') || id.startsWith('C.1.5.3') || id.startsWith('C.1.5.4') || id.startsWith('C.1.5.5')) {
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
          } else {
            if (n.type === 'M') n.status = 'blocked';
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

      // Periodic Quarantine Bay Clearance to prevent full-buffer deadlocks
      const qBay = nodes['Q_Bay'];
      if (qBay && qBay.inventory >= 12) {
        const teardownQty = Math.min(10, qBay.inventory);
        qBay.inventory -= teardownQty;
        floatingTexts.push({
          id: `ft-${Date.now()}`,
          text: `-${teardownQty} Defect Cells to QA Teardown`,
          x: qBay.x,
          y: qBay.y - 35,
          color: '#F43F5E',
          life: 2.5,
        });
      }

      const qBead = nodes['Q_Bead_Reject'];
      if (qBead && qBead.inventory >= 4) {
        const reworkQty = Math.min(4, qBead.inventory);
        qBead.inventory -= reworkQty;
        floatingTexts.push({
          id: `ft-${Date.now()}`,
          text: `-${reworkQty} Defect Stacks to Rework`,
          x: qBead.x,
          y: qBead.y - 35,
          color: '#FB923C',
          life: 2.5,
        });
      }

      // Safe bounds to eliminate memory spikes and freezing
      if (particles.length > 200) {
        particles.splice(0, particles.length - 200);
      }
      if (floatingTexts.length > 25) {
        floatingTexts.splice(0, floatingTexts.length - 25);
      }
    };

    const renderCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const isDark = theme === 'dark';

      // Wall-clock seconds, used to phase the moving parts of the equipment
      // glyphs. Each station is phased by its own cycle time, so a slow cycler
      // visibly works more slowly than a fast stacking robot.
      const nowSec = performance.now() / 1000;

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

      // Transparent clear (not a solid fill) — the plant photo sits in a layer
      // behind this canvas, and the diagram only paints opaque node boxes and
      // lightly-tinted zone rectangles, so leaving the rest clear lets the
      // photo read through the negative space between stations.
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      const cam = cameraRef.current;
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

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
        'Z2: CELL STACKING & COMPRESSION': '16, 185, 129', // Emerald
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

        // The station's enclosure. The equipment itself is drawn inside it, so
        // this is deliberately quiet — a machine housing, not the subject.
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

        // The machine that actually stands here. Classification is memoised per
        // station id: it parses the label, and re-deriving it for every station
        // on every frame would be pure waste.
        let kind = glyphKindCacheRef.current[id];
        if (!kind) {
          kind = classifyStation(id, n.label, n.type, n.unit);
          glyphKindCacheRef.current[id] = kind;
        }

        // Only a working station gets a moving phase, so motion on the floor
        // always means work rather than merely that the canvas is animating.
        const phase = n.status === 'working' ? (nowSec / Math.max(0.6, n.processingTime)) % 1 : 0.25;

        const statusAccent =
          n.status === 'blocked'
            ? '#EF4444'
            : n.status === 'defect'
            ? '#F97316'
            : n.status === 'working'
            ? '#10B981'
            : n.status === 'holding'
            ? '#F59E0B'
            : isBuf
            ? '#8B5CF6'
            : isDark
            ? '#64748B'
            : '#94A3B8';

        drawEquipmentGlyph(ctx, kind, n.x, n.y - 2, n.w * 0.82, {
          stroke: isDark ? '#94A3B8' : '#475569',
          body: isDark ? '#232833' : '#E2E8F0',
          accent: statusAccent,
          detail: isDark ? '#39404E' : '#CBD5E1',
        }, phase);

        // Capacity meter: a thin strip along the base of the enclosure, so it
        // reads as a fill gauge without competing with the machine above it.
        const fillPct = Math.min(1, n.inventory / Math.max(1, n.cap));
        const meterH = 5;
        const meterY = ry + n.h - meterH - 2;
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
        ctx.fillRect(rx + 3, meterY, n.w - 6, meterH);

        let meterColor = '#10B981';
        if (fillPct > 0.8) meterColor = '#EF4444';
        else if (fillPct > 0.5) meterColor = '#F59E0B';

        ctx.fillStyle = meterColor;
        ctx.fillRect(rx + 3, meterY, (n.w - 6) * fillPct, meterH);

        // Identity and stock, below the enclosure where they no longer sit on
        // top of the equipment.
        ctx.textAlign = 'center';
        ctx.fillStyle = isDraggingThis
          ? '#60A5FA'
          : isSelected
          ? isDark
            ? '#60A5FA'
            : '#1D4ED8'
          : isDark
          ? '#E5E7EB'
          : '#0F172A';
        const budget = n.labelWidth ?? n.w * 1.6;

        ctx.font = 'bold 10px sans-serif';
        const stockText =
          id === 'M01' ? `${n.inventory}+${n.auxInventory || 0}t` : `${n.inventory}/${n.cap}`;
        const cycleText = n.type === 'M' && n.cycleCount > 0 ? ` · #${n.cycleCount}` : '';
        const idLine = `${id}${cycleText}  ·  ${stockText}`;
        ctx.fillText(
          elideToWidth(ctx, idLine, budget),
          n.x,
          ry + n.h + 13
        );

        ctx.fillStyle = isDark ? '#94A3B8' : '#334155';
        ctx.font = '10px sans-serif';
        ctx.fillText(elideToWidth(ctx, n.label, budget), n.x, ry + n.h + 25);

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
          ctx.arc(p.x, p.y, p.type === 'pack' ? 6 : p.type === 'cell_stack' ? 4.5 : 3.5, 0, Math.PI * 2);

          if (p.type === 'cell') {
            ctx.fillStyle = '#10B981';
            ctx.shadowColor = '#10B981';
          } else if (p.type === 'cell_stack') {
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

          // Trailer always occupies [t.x, t.x + TRUCK_TRAILER_W]; the cab hangs
          // off whichever end is leading. `dockRestX` is derived from exactly
          // this geometry, so the nose lands on the dock face.
          ctx.fillRect(t.x, t.y - 20, TRUCK_TRAILER_W, 42);
          ctx.fillStyle = '#E2E8F0';
          ctx.fillRect(
            t.dir === 1 ? t.x + TRUCK_TRAILER_W : t.x - TRUCK_CAB_W,
            t.y - 15,
            TRUCK_CAB_W,
            32
          );
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(t.x + 10, t.y + 22, 16, 6);
          ctx.fillRect(t.x + 85, t.y + 22, 16, 6);

          ctx.fillStyle = t.type === 'material_tray' ? '#1E293B' : '#FFFFFF';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            t.type === 'inbound_cell' ? 'RAW CELLS' : t.type === 'material_tray' ? 'TRAYS' : 'PACKS OUT',
            t.x + TRUCK_TRAILER_W / 2,
            t.y + 5
          );
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
      if (isNaN(dt) || dt <= 0) dt = 0.016;
      if (dt > 0.05) dt = 0.05;

      updateSimulation(dt);
      renderCanvas();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [simState.isRunning, simState.simulationSpeed, inboundRate, materialRate, outboundBatch, stackerCycle, weldCycle, cyclerCycle, defectRate, cellsPerPack, showParticles, showTrucks, showGrid, selectedNodeId]);

  // Active selected node details for Inspector
  const selectedNode = selectedNodeId ? nodesRef.current[selectedNodeId] : null;
  const isDark = theme === 'dark';

  return (
    <div className={`flex h-full w-full overflow-hidden relative select-none transition-colors duration-200 ${
      isDark ? 'bg-[#0B0C0E] text-[#D1D5DB]' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Mobile Drawer Backdrop Overlay */}
      {isControlPanelOpen && (
        <div
          onClick={() => setIsControlPanelOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-35 transition-opacity"
        />
      )}

      {/* Floating Operational Controller Drawer (Left) */}
      <div
        // No `overflow-hidden` on the outer shell so the desktop collapse button stays clickable.
        className={`fixed lg:absolute top-0 left-0 bottom-0 z-40 lg:z-30 border-r transition-all duration-300 flex flex-col ${
          isDark
            ? 'bg-[#0B0D14]/90 border-[#2D3139]/80 shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
            : 'bg-white/95 border-slate-200/90 shadow-2xl'
        } ${isControlPanelOpen ? 'w-[88vw] sm:w-96 max-w-sm' : 'w-0 border-r-0 lg:w-10 lg:border-r'}`}
      >
        {/* Battery Pack Robotics Line Background Image with Frosted Glass Morphism Overlay */}
        <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden rounded-r-none">
          <img
            src={plantOpsBackgroundImg}
            alt="Battery Pack Robotics Line"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center scale-110 opacity-100 transition-all duration-500"
          />
          <div
            className={`absolute inset-0 ${
              isDark
                ? 'bg-gradient-to-b from-[#0B0D14]/55 via-[#0F1422]/40 to-[#0B0D14]/62'
                : 'bg-gradient-to-b from-white/58 via-white/42 to-white/64'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent dark:via-white/5 pointer-events-none" />
        </div>

        {/* Toggle Button (Desktop & Tablet) */}
        <button
          onClick={() => setIsControlPanelOpen(!isControlPanelOpen)}
          title={isControlPanelOpen ? 'Collapse controller' : 'Expand controller'}
          aria-label={isControlPanelOpen ? 'Collapse controller' : 'Expand controller'}
          className="hidden lg:flex absolute -right-4 top-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white p-1.5 rounded-full border-2 border-white dark:border-[#0B0D14] shadow-[0_2px_10px_rgba(0,0,0,0.35)] z-40 transition-transform transform hover:scale-110"
        >
          {isControlPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isControlPanelOpen && (
          <div className="relative z-10 flex flex-col h-full overflow-hidden">
            {/* Control Panel Header with Frosted Glass styling */}
            <div className={`p-4 border-b backdrop-blur-xl ${
              isDark ? 'border-white/10 bg-black/20' : 'border-slate-200/80 bg-white/40'
            }`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 font-extrabold uppercase text-xs tracking-wider ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <div className="p-1 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-400 shrink-0">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <span className="leading-tight">Plant Controller</span>
                </div>
                {/* Close Button for Mobile & Desktop */}
                <button
                  onClick={() => setIsControlPanelOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold backdrop-blur-md">
                  Auto-Scaling Active
                </span>
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30 font-bold backdrop-blur-md">
                  Takt: {requiredLineTakt}s
                </span>
              </div>
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                      onChange={e => { setGwhTarget(parseFloat(e.target.value)); clearTargetOverride(); }}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                      onChange={e => { setPackKwh(parseInt(e.target.value)); clearTargetOverride(); }}
                      className="w-full accent-purple-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className={`p-2.5 rounded-xl border backdrop-blur-xl ${
                      isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-white/32 border-slate-200/90'
                    }`}>
                      <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Shifts per Day</label>
                      <select
                        value={shiftsCount}
                        onChange={e => { setShiftsCount(parseInt(e.target.value)); clearTargetOverride(); }}
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
                      isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-white/32 border-slate-200/90'
                    }`}>
                      <label className="block text-[10px] text-gray-400 uppercase font-bold mb-1">Shift Duration</label>
                      <select
                        value={shiftHours}
                        onChange={e => { setShiftHours(parseInt(e.target.value)); clearTargetOverride(); }}
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

                  {/* Shift Target sliders — auto-tracks GWh/kWh/shifts/hours
                      above, but either slider can be dragged to set a direct
                      override (packs and capacity stay in lock-step via
                      packKwh). Editing any driver above resets the override. */}
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                        Shift Target (Packs){targetOverridePacks !== null ? <span className="text-amber-500 font-bold"> · Override</span> : null}
                      </span>
                      <span className="font-mono text-amber-500 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{shiftPacksReq.toLocaleString()} Packs</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="5000"
                      step="1"
                      value={shiftPacksReq}
                      onChange={e => setTargetOverridePacks(parseInt(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    {targetOverridePacks !== null && (
                      <button
                        onClick={clearTargetOverride}
                        className={`text-[10px] font-semibold underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Reset to auto ({autoShiftPacksReq.toLocaleString()} Packs from GWh target)
                      </button>
                    )}
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                        Shift Total Target Capacity{targetOverridePacks !== null ? <span className="text-amber-500 font-bold"> · Override</span> : null}
                      </span>
                      <span className="font-mono text-cyan-500 font-bold text-sm bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        {(shiftCapacityKwh / 1000).toFixed(1)} MWh
                      </span>
                    </div>
                    <input
                      type="range"
                      min={50 * Math.max(1, packKwh)}
                      max={5000 * Math.max(1, packKwh)}
                      step={Math.max(1, packKwh)}
                      value={shiftCapacityKwh}
                      onChange={e => setTargetOverridePacks(Math.round(parseInt(e.target.value) / Math.max(1, packKwh)))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      {shiftPacksReq.toLocaleString()} packs × {packKwh} kWh/pack — moves the pack slider above together with it.
                    </p>
                  </div>

                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Cell Stacker Cycle Time</span>
                      <span className="font-mono text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{stackerCycle}s / Stack</span>
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>Laser Busbar Weld Cycle Time</span>
                      <span className="font-mono text-blue-500 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{weldCycle}s / Stack</span>
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
                    isDark ? 'bg-[#141720]/32 border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.2)]' : 'bg-white/32 border-slate-200/90 shadow-xs'
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

              {/* TAB 4: TIME ENGINE & PRIMING */}
              {activeControlTab === 'engine' && (
                <div className="space-y-3.5 text-xs">
                  {/* Shift Clock & Execution Controls */}
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
                        isDark ? 'bg-[#141720]/32 border-white/10 text-gray-300 hover:bg-white/10' : 'bg-white/32 border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                      title="Reset Clock"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Priming Line Mode & Playable Controls */}
                  <div className={`p-3 rounded-xl border space-y-2.5 backdrop-blur-xl ${
                    isDark ? 'bg-[#141720]/45 border-white/10' : 'bg-slate-50/70 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-cyan-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        Line Priming Mode
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        isLinePrimedState
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse'
                      }`}>
                        {isLinePrimedState ? 'Primed (Steady-State)' : 'Cold Priming'}
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-tight">
                      Choose whether to start right away from an already-primed {requiredLineTakt}s cadence line, or simulate pipeline fill.
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleSetSteadyState}
                        className={`py-2 px-2.5 rounded-xl font-bold text-[11px] transition-all flex flex-col items-center justify-center gap-1 border ${
                          isLinePrimedState
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                            : isDark
                            ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-1">🚀 Steady-State</span>
                        <span className="text-[9px] font-normal font-mono opacity-85">{requiredLineTakt}s Cadence</span>
                      </button>

                      <button
                        onClick={handleStartColdPriming}
                        className={`py-2 px-2.5 rounded-xl font-bold text-[11px] transition-all flex flex-col items-center justify-center gap-1 border ${
                          !isLinePrimedState
                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                            : isDark
                            ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="flex items-center gap-1">⏱️ Cold Priming</span>
                        <span className="text-[9px] font-normal font-mono opacity-85">~{(dynamicPrimingTimeSec / 60).toFixed(0)}m Lead Time</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-1 font-mono text-[10px] text-gray-400">
                      <div className="flex justify-between">
                        <span>Dynamic Priming Lead:</span>
                        <span className="text-cyan-400 font-bold">{(dynamicPrimingTimeSec / 60).toFixed(0)} min ({dynamicPrimingTimeSec}s)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Outbound W04 Dispatch:</span>
                        <span className={`font-bold ${isLinePrimedState ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {isLinePrimedState ? 'Gated & Flowing' : 'Strictly Gated'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Warp Speed */}
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
                              : isDark ? 'bg-[#141720]/32 text-gray-400 hover:text-white border border-white/5' : 'bg-white/32 text-slate-700 hover:bg-white border border-slate-200'
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
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Plant Campus Background — sits behind the transparent canvas so the
            diagram's negative space shows the real facility instead of a flat
            fill. Only the HUD/legend/inspector panels get the glass treatment;
            everything else here is the photo itself. */}
        <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
          <img
            src={plantFloorBackgroundImg}
            alt="Radi Energy Solutions Plant Campus"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-20 dark:opacity-12 blur-[3px] scale-105"
          />
          {/* Near-opaque frosted pane — just a hint of the plant photo, not a
              competing visual against the diagram. */}
          <div className={`absolute inset-0 backdrop-blur-[3px] ${isDark ? 'bg-[#0B0C0E]/90' : 'bg-[#F8FAFC]/86'}`} />
        </div>

        {/* Top Floating HUD Bar - Frosted Glassmorphism with Shadow Glow */}
        {/* left offset tracks the controller drawer — `left-14` only cleared the
            collapsed rail, so the open drawer sat on top of the HUD. */}
        <div className={`absolute top-4 right-4 z-20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl border text-xs backdrop-blur-2xl transition-all duration-300 ${
          isControlPanelOpen ? 'left-[25rem]' : 'left-4 sm:left-14'
        } ${
          isDark
            ? 'bg-[#0B0D14]/75 text-white border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
            : 'bg-white/80 text-slate-900 border-slate-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.06)]'
        }`}>
          <div className="flex items-center justify-between gap-3">
            {/* Core Target Metrics (Always visible or expanded) */}
            <div className="flex items-center gap-3 sm:gap-4 font-mono flex-wrap">
              <div>
                <span className="text-[9px] sm:text-[10px] text-gray-400 uppercase block font-semibold">Shift Target</span>
                <span className="font-bold text-amber-500 drop-shadow-xs text-xs sm:text-sm">{shiftPacksReq.toLocaleString()} Pk</span>
              </div>
              <div className="w-[1px] h-5 bg-gray-300 dark:bg-white/10" />
              <div>
                <span className="text-[9px] sm:text-[10px] text-gray-400 uppercase block font-semibold">Req. Takt</span>
                <span className="font-bold text-emerald-500 drop-shadow-xs text-xs sm:text-sm">{requiredLineTakt}s</span>
              </div>
              <div className="w-[1px] h-5 bg-gray-300 dark:bg-white/10 hidden sm:block" />
              <div className="hidden sm:block">
                <span className="text-[9px] sm:text-[10px] text-gray-400 uppercase block font-semibold">Active Threads</span>
                <span className="font-bold text-blue-500 text-xs sm:text-sm">
                  {tStack} Stack • {tWeld} Weld • {tCycler} Cycle
                </span>
              </div>
            </div>

            {/* Mobile Toggle Button */}
            <button
              onClick={() => setIsHudExpanded(!isHudExpanded)}
              className="md:hidden p-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-400 hover:text-white"
              title={isHudExpanded ? 'Collapse Legend & Controls' : 'Expand Controls & Legend'}
            >
              {isHudExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Color Particles Legend & Layout Lock Status (Responsive / Collapsible on Mobile) */}
          {(isHudExpanded || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
            <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap pt-1.5 md:pt-0 border-t md:border-t-0 border-black/5 dark:border-white/5">
              {/* Lock / Unlock Station Rearrangement Toggle Button */}
              <button
                onClick={toggleLayoutLock}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all select-none backdrop-blur-xl ${
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
                    <span className="hidden sm:inline">Layout Locked</span>
                    <span className="sm:hidden">Locked</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Edit Layout Active</span>
                    <span className="sm:hidden">Editing</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
                <span>Raw Cells</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500" />
                <span>Cell Stacks</span>
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
          )}
        </div>

        {/* Floating Mobile Open Controller Button */}
        {!isControlPanelOpen && (
          <button
            onClick={() => setIsControlPanelOpen(true)}
            className="lg:hidden absolute left-3 top-3 z-30 p-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl border border-white/20 active:scale-95 transition-transform"
            title="Open Plant Controller"
            aria-label="Open Plant Controller"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* Live Line Pipeline & First-Pack Build Progression Tracker (Collapsible HUD) */}
        {!isLinePrimedState && (
          <div className={`absolute top-20 z-20 transition-all duration-300 select-none ${
            isControlPanelOpen ? 'left-[25rem]' : 'left-3 sm:left-14'
          } ${
            isDark
              ? 'bg-[#0B0D14]/90 text-white border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
              : 'bg-white/95 text-slate-900 border-slate-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.1)]'
          } rounded-2xl border backdrop-blur-2xl ${
            isPipelineHudExpanded ? 'w-[92vw] sm:w-96 max-w-md p-3.5' : 'w-auto px-3 py-2'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                </span>
                <span className="font-bold text-[11px] uppercase tracking-wider text-cyan-400 truncate">
                  {isPipelineHudExpanded ? 'Priming Pipeline (Cold-Start)' : 'Priming: Pipeline Fill'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 text-[10px]">
                  {Math.min(100, Math.round((simState.shiftTimeSeconds / Math.max(1, dynamicPrimingTimeSec)) * 100))}%
                </span>
                <button
                  onClick={() => setIsPipelineHudExpanded(!isPipelineHudExpanded)}
                  className={`p-1 rounded-md text-[10px] transition-all ${
                    isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-slate-200 text-slate-600'
                  }`}
                  title={isPipelineHudExpanded ? 'Collapse HUD' : 'Expand Details'}
                >
                  {isPipelineHudExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {isPipelineHudExpanded && (
              <div className="space-y-2.5 mt-2 pt-2 border-t border-white/5 dark:border-white/10">
                {/* Progress bar */}
                <div className="w-full bg-gray-700/30 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                    style={{ width: `${Math.min(100, Math.max(4, (simState.shiftTimeSeconds / Math.max(1, dynamicPrimingTimeSec)) * 100))}%` }}
                  />
                </div>

                {/* Current Active Pipeline Stage */}
                <div className={`p-2 rounded-xl text-[11px] font-mono flex items-center justify-between ${
                  isDark ? 'bg-white/5 border border-white/5' : 'bg-slate-50 border border-slate-200'
                }`}>
                  <span className="text-gray-400">Active Process:</span>
                  <span className="font-semibold text-emerald-400 text-right truncate max-w-[220px]">
                    {simState.shiftTimeSeconds < dynamicPrimingTimeSec * 0.15
                      ? 'Inbound AGVs & OCV/IR Sort'
                      : simState.shiftTimeSeconds < dynamicPrimingTimeSec * 0.35
                      ? 'Prismatic Stacking & 2K Adhesive'
                      : simState.shiftTimeSeconds < dynamicPrimingTimeSec * 0.55
                      ? '3kW Fiber Laser Welding & CCD'
                      : simState.shiftTimeSeconds < dynamicPrimingTimeSec * 0.75
                      ? 'Marriage with Enclosure, TIM & BMS'
                      : simState.shiftTimeSeconds < dynamicPrimingTimeSec * 0.90
                      ? 'Cover Torque Sealing & Hipot Test'
                      : 'EOL Cycler Aging & Quality Release'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono pt-0.5">
                  <span>Elapsed: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{formatShiftTime(simState.shiftTimeSeconds)}</strong></span>
                  <span>Lead Time: <strong className="text-cyan-400">~{(dynamicPrimingTimeSec / 60).toFixed(0)} min</strong></span>
                </div>

                {/* Quick Playable Action to Jump to Steady-State */}
                <button
                  onClick={handleSetSteadyState}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span>⚡ Instant Prime & Run at {requiredLineTakt}s Cadence</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Canvas Element */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className={`relative z-10 w-full h-full block touch-none ${
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
          <div className={`backdrop-blur-md p-1.5 rounded-xl border flex flex-col gap-1.5 shadow-lg ${
            isDark ? 'bg-[#111318]/90 border-[#2D3139] text-gray-300' : 'bg-white/90 border-slate-200 text-slate-700 shadow-md'
          }`}>
            <button
              onClick={toggleLayoutLock}
              className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                isLayoutLocked
                  ? 'text-emerald-500 hover:bg-emerald-500/15'
                  : 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30 animate-pulse'
              }`}
              title={isLayoutLocked ? 'Layout is Locked: Click to Unlock Drag & Drop' : 'Layout is in Edit Mode: Click to Lock'}
              aria-label="Toggle Layout Lock"
            >
              {isLayoutLocked ? <Lock className="w-4 h-4 text-emerald-500" /> : <Unlock className="w-4 h-4 text-amber-500" />}
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, scale: Math.min(2.5, prev.scale * 1.25) }))}
              className="p-2 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-all flex items-center justify-center"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCamera(prev => ({ ...prev, scale: Math.max(0.2, prev.scale / 1.25) }))}
              className="p-2 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-all flex items-center justify-center"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetCamera}
              className="p-2 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-all flex items-center justify-center"
              title="Fit Plant Floor View"
              aria-label="Fit Plant Floor View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetLayout}
              className="p-2 hover:bg-white/10 dark:hover:bg-white/10 rounded-lg text-amber-500 hover:text-amber-400 transition-all flex items-center justify-center"
              title="Reset Floor Layout to Default Blueprint"
              aria-label="Reset Floor Layout to Default Blueprint"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className={`backdrop-blur-2xl p-2.5 rounded-2xl border flex flex-col gap-1.5 text-[10px] shadow-lg transition-all ${
            isDark ? 'bg-[#0B0D14]/75 border-white/10 text-gray-300' : 'bg-white/80 border-slate-200/90 text-slate-700 shadow-sm'
          }`}>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={e => setShowGrid(e.target.checked)}
                className="rounded border-white/20 text-blue-600 focus:ring-0"
              />
              <span>Grid</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showParticles}
                onChange={e => setShowParticles(e.target.checked)}
                className="rounded border-white/20 text-blue-600 focus:ring-0"
              />
              <span>Particles</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
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

        {/* Selected Node Inspector Drawer - Responsive Glassmorphism Card */}
        {selectedNode && (
          <div className={`fixed lg:absolute bottom-3 left-3 right-3 lg:right-auto lg:left-14 lg:w-84 max-h-[55vh] overflow-y-auto z-30 p-4 rounded-2xl border space-y-3 text-xs backdrop-blur-2xl transition-all shadow-2xl ${
            isDark
              ? 'bg-[#0B0D14]/90 border-white/10 text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
              : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-2xl'
          }`}>
            <div className={`flex justify-between items-center border-b pb-2 ${
              isDark ? 'border-white/10' : 'border-[#E7E3DC]'
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
              isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-slate-50/55 border-slate-200'
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
                  onClick={toggleLayoutLock}
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
                isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-slate-50/55 border-slate-200'
              }`}>
                <span className="text-[9px] text-gray-400 uppercase block font-semibold">Occupancy</span>
                <span className="font-bold">
                  {selectedNode.inventory} / {selectedNode.cap} {selectedNode.unit}
                </span>
              </div>

              <div className={`p-2.5 rounded-xl border backdrop-blur-xl ${
                isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-slate-50/55 border-slate-200'
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

            {selectedNode.type === 'M' && (
              <div className={`p-2.5 rounded-xl border space-y-1.5 font-mono text-[11px] backdrop-blur-xl ${
                isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-slate-50/55 border-slate-200'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-gray-400 uppercase font-semibold">Production Cycle Counter</span>
                  <span className="font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {(selectedNode.cycleCount || 0).toLocaleString()} cycles
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                  <span>Sequence Tracking:</span>
                  <span className="text-emerald-500 font-semibold">Active & Sequential</span>
                </div>
              </div>
            )}

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

            {selectedNode.id === 'Q_Bay' && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[10px] text-rose-400 leading-tight backdrop-blur-xl">
                <strong>Defect Cell Reject Bay (Q-Bay):</strong> Screened reject bay receiving defect cells from OCV Sort Gateway (C_Sort) under normative yield/defect screening. Isolated for teardown analysis.
              </div>
            )}

            {selectedNode.id === 'Q_Bead_Reject' && (
              <div className="p-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-[10px] text-orange-400 leading-tight backdrop-blur-xl">
                <strong>Weld Bead Reject Quarantine:</strong> Screened reject station receiving laser busbar weld defect cell stacks from CCD Vision Gateway (CCD_Sort).
              </div>
            )}

            {selectedNode.processingTime > 0 && (
              <div className={`p-2.5 rounded-xl border space-y-1 text-[11px] backdrop-blur-xl ${
                isDark ? 'bg-[#141720]/32 border-white/10' : 'bg-slate-50/55 border-slate-200'
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
