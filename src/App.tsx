import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { PlantLayout2D } from './components/PlantLayout2D';
import { ThroughputDashboard } from './components/ThroughputDashboard';
import { MhePersonnelSimulator } from './components/MhePersonnelSimulator';
import { WarehouseInventorySystem } from './components/WarehouseInventorySystem';
import { MachineCensusList } from './components/MachineCensusList';
import { WorkforcePayroll } from './components/WorkforcePayroll';
import { TariffEnergyOptimization } from './components/TariffEnergyOptimization';
import { CapExCostingModel } from './components/CapExCostingModel';
import { ChangeLog } from './components/ChangeLog';
import { AiOptimizerModal } from './components/AiOptimizerModal';
import { ShiftReportModal } from './components/ShiftReportModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import plantBackgroundImg from './assets/images/plant.png';

import { PLANT_METADATA, MHE_FLEET } from './data/plantData';
import { useZonesWithMachines, useWarehouses, useWorkforce, useTariffPeriods, useCapexItems } from './lib/collections';
import { useSeedOnEmpty } from './lib/seedPlantData';
import { useSimulationInputs } from './lib/simulationInputs';
import { EditAuthGate, guardCollection } from './lib/editAuth';
import { DataBanner } from './components/common/DataBanner';
import { SimulationState, MheItem, ThemeMode, TabId } from './types/plant';

const THEME_KEY = 'radi-twin-theme';

export default function App() {
  // Was plain useState('light'), so the toggle reset on every reload.
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });
  const [activeTab, setActiveTab] = useState<TabId>('layout');

  // Live, shared, persisted data: every browser with this app open reads and
  // writes the same Supabase tables, and sees every other collaborator's
  // edits arrive automatically via realtime subscriptions (see src/lib).
  const zonesApi = useZonesWithMachines();
  const warehousesApi = useWarehouses();
  const workforceApi = useWorkforce();
  const tariffApi = useTariffPeriods();
  const capexApi = useCapexItems();
  const [mheFleet, setMheFleet] = useState<MheItem[]>(MHE_FLEET);

  // An empty database used to mean empty screens with no way forward but a
  // terminal command. If every table comes back with no rows, load the shipped
  // plant data straight from here using the public anon key.
  const collectionsReady =
    !zonesApi.loading && !warehousesApi.loading && !workforceApi.loading && !tariffApi.loading && !capexApi.loading;
  const collectionsEmpty =
    zonesApi.zones.length === 0 &&
    warehousesApi.rows.length === 0 &&
    workforceApi.rows.length === 0 &&
    tariffApi.rows.length === 0 &&
    capexApi.rows.length === 0;

  const refetchAll = useCallback(() => {
    zonesApi.refetch();
    warehousesApi.refetch();
    workforceApi.refetch();
    tariffApi.refetch();
    capexApi.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seed = useSeedOnEmpty({ ready: collectionsReady, isEmpty: collectionsEmpty, refetch: refetchAll });

  const loadError =
    zonesApi.error || warehousesApi.error || workforceApi.error || tariffApi.error || capexApi.error;

  // Every persisted write goes through the engineering password challenge and
  // lands in the change trail. Wrapping here — at the single point each
  // collection is handed to a screen — means a new CRUD surface cannot
  // accidentally ship without either, and no screen needs to know they exist.
  // Reads stay open, so the twin is fully viewable without authorising anything.
  //
  // `rows` is supplied so an update can be diffed against the record as it
  // stands, which is what lets the trail show "cycleTimeSec 90 → 74" rather
  // than just "someone edited this".
  const allMachines = useMemo(() => zonesApi.zones.flatMap(z => z.machines), [zonesApi.zones]);

  const warehouseWrites = guardCollection(
    { label: 'warehouse', entity: 'warehouses', rows: warehousesApi.rows, describe: w => w.name ?? '' },
    warehousesApi
  );
  const workforceWrites = guardCollection(
    {
      label: 'workforce line',
      entity: 'workforce',
      rows: workforceApi.rows,
      describe: w => [w.ref, w.zoneOrFunction].filter(Boolean).join(' · '),
    },
    workforceApi
  );
  const tariffWrites = guardCollection(
    { label: 'tariff period', entity: 'tariff_periods', rows: tariffApi.rows, describe: t => t.name ?? '' },
    tariffApi
  );
  const capexWrites = guardCollection(
    {
      label: 'CapEx item',
      entity: 'capex_items',
      rows: capexApi.rows,
      describe: c => [c.code, c.category].filter(Boolean).join(' · '),
    },
    capexApi
  );
  const machineWrites = guardCollection(
    {
      label: 'machine',
      entity: 'machines',
      rows: allMachines,
      describe: m => [m.wbsCode, m.name].filter(Boolean).join(' · '),
    },
    {
      insert: zonesApi.addMachine,
      update: zonesApi.updateMachine,
      remove: zonesApi.deleteMachine,
    }
  );

  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Global Simulation State aligned with Engineering Cost-Estimation Document
  const [simState, setSimState] = useState<SimulationState>({
    isRunning: true,
    simulationSpeed: 1, // 1x, 5x, 20x, 100x
    shiftTimeSeconds: 7200, // Start 2 hours into 10h shift
    shiftHoursRemaining: 8.0,
    processedPacks: 271,
    goodPacks: 263,
    reworkedPacks: 6,
    scrappedPacks: 2,
    targetPacks: 1183,
    currentTaktSec: 26.57,
    currentYieldPct: 0.97,
    currentOeePct: 0.90,
    inboundCellStockUnits: 285000,
    productionMaterialStockPct: 84,
    outboundPackStockUnits: 3781, // 4-day buffer level in 10,000 capacity warehouse
    bessCabinetStockUnits: 22,
    activeAgvs: 11,
    activeForklifts: 8,
    activeOperators: 124,
    activePowerDrawKw: 4875,
    currentTariffUSD: 0.055,

    // Capacity & BOM Model Parameters
    annualGwhTarget: 10,
    packKwhCapacity: 35.23,
    bessKwhCapacity: 215,
    packsPerBessContainer: 24,
    operatingShiftsPerDay: 1,
    shiftLengthHours: 10,
    cellsPerPackBom: 108,

    // Logistics & Cycle Times
    inboundTruckRatePerHour: 2.0,
    cellsPerInboundTruck: 25000,
    outboundDispatchBatchSize: 200, // Daily consolidated HGV convoy
    stackerCycleTimeSec: 90,
    weldCycleTimeSec: 38,
    eolCyclerTimeSec: 1217,
    defectRejectRatePct: 2.5,

    // Shift Completion & Reporting
    shiftCompleted: false,
    isShiftReportOpen: false,
    bessContainersBuilt: 1,

    // 4-Day Finished Pack Buffer Log
    day1PacksProduced: 1180,
    day2PacksProduced: 1185,
    day3PacksProduced: 1178,
    day4PacksProduced: 263,
    daysBufferLevel: 4.2,
    nextDispatchHoursRemaining: 16.5,
  });

  // The census, registry and tariff table now drive the line model. Every value
  // is clamped inside `deriveSimInputs`, so an edit can move the simulation but
  // cannot break it.
  const derived = useSimulationInputs({
    zones: zonesApi.zones,
    workforce: workforceApi.rows,
    tariffPeriods: tariffApi.rows,
    shiftLengthHours: simState.shiftLengthHours,
    yieldPct: simState.currentYieldPct,
    oeePct: simState.currentOeePct,
    // The shift starts at 06:00; this is the wall-clock hour it has reached.
    currentHour: 6 + Math.floor(simState.shiftTimeSeconds / 3600),
  });

  useEffect(() => {
    setSimState(prev => {
      if (
        prev.currentTaktSec === derived.taktSec &&
        prev.targetPacks === derived.targetPacks &&
        prev.activeOperators === derived.activeOperators &&
        prev.currentTariffUSD === derived.tariffUSD
      ) {
        return prev; // nothing moved — do not re-render the clock
      }
      return {
        ...prev,
        currentTaktSec: derived.taktSec,
        targetPacks: derived.targetPacks,
        activeOperators: derived.activeOperators,
        currentTariffUSD: derived.tariffUSD,
      };
    });
  }, [derived.taktSec, derived.targetPacks, derived.activeOperators, derived.tariffUSD]);

  // Tailwind's `dark:` variant follows the OS colour scheme unless something
  // puts `.dark` on the document. Every `dark:` class in this app was therefore
  // reacting to the user's system setting rather than the in-app toggle — which
  // is how a light-themed screen ended up with dark badges. This binds them.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // private mode / storage disabled — the toggle still works for this session
    }
  }, [theme]);

  // Background Simulation Clock Effect
  useEffect(() => {
    if (!simState.isRunning) return;

    const intervalMs = Math.max(20, 1000 / simState.simulationSpeed);

    const timer = setInterval(() => {
      setSimState(prev => {
        const totalShiftSec = prev.shiftLengthHours * 3600;
        const nextTimeSec = prev.shiftTimeSeconds + 1;

        // When shift reaches end of duration (e.g. 10 hours = 36000s)
        if (nextTimeSec >= totalShiftSec) {
          const finalPacksProduced = Math.floor(totalShiftSec / Math.max(1, prev.currentTaktSec));
          const finalGood = Math.floor(finalPacksProduced * prev.currentYieldPct);
          const finalScrap = Math.floor(finalPacksProduced * (1 - prev.currentYieldPct) * 0.3);
          const finalRework = finalPacksProduced - finalGood - finalScrap;
          const bessTarget = 12;
          const bessCabinets = Math.min(bessTarget, Math.floor((finalGood / Math.max(1, prev.targetPacks)) * bessTarget));

          return {
            ...prev,
            isRunning: false, // Stop line at shift completion!
            shiftCompleted: true,
            isShiftReportOpen: true, // Automatically pop up shift completion audit report
            shiftTimeSeconds: totalShiftSec,
            shiftHoursRemaining: 0,
            processedPacks: finalPacksProduced,
            goodPacks: finalGood,
            reworkedPacks: finalRework,
            scrappedPacks: finalScrap,
            day4PacksProduced: finalGood,
            bessContainersBuilt: bessCabinets,
          };
        }

        // Calculate pack production rate based on takt time
        const packsProduced = Math.floor(nextTimeSec / Math.max(1, prev.currentTaktSec));
        const goodPacks = Math.floor(packsProduced * prev.currentYieldPct);
        const scrappedPacks = Math.floor(packsProduced * (1 - prev.currentYieldPct) * 0.3);
        const reworkedPacks = packsProduced - goodPacks - scrappedPacks;

        // Stock consumption (cells per pack)
        const cellStock = Math.max(0, 350000 - goodPacks * prev.cellsPerPackBom);
        const outboundStock = Math.min(10000, 3500 + goodPacks);
        const bessTarget = 12;
        const bessCabinets = Math.min(bessTarget, Math.floor((goodPacks / Math.max(1, prev.targetPacks)) * bessTarget));

        return {
          ...prev,
          shiftTimeSeconds: nextTimeSec,
          shiftHoursRemaining: parseFloat(((totalShiftSec - nextTimeSec) / 3600).toFixed(1)),
          processedPacks: packsProduced,
          goodPacks,
          reworkedPacks,
          scrappedPacks,
          day4PacksProduced: goodPacks,
          bessContainersBuilt: bessCabinets,
          inboundCellStockUnits: cellStock,
          outboundPackStockUnits: outboundStock,
          daysBufferLevel: parseFloat((outboundStock / Math.max(1, prev.targetPacks)).toFixed(2)),
        };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [simState.isRunning, simState.simulationSpeed, simState.currentTaktSec, simState.currentYieldPct, simState.shiftLengthHours, simState.cellsPerPackBom, simState.packsPerBessContainer]);

  // Handler to smoothly start next shift
  const handleStartNextShift = () => {
    setSimState(prev => {
      const newBuffer = Math.min(10000, prev.outboundPackStockUnits + prev.goodPacks);
      return {
        ...prev,
        isRunning: true,
        shiftCompleted: false,
        isShiftReportOpen: false,
        shiftTimeSeconds: 0,
        shiftHoursRemaining: prev.shiftLengthHours || 10,
        processedPacks: 0,
        goodPacks: 0,
        reworkedPacks: 0,
        scrappedPacks: 0,
        day4PacksProduced: 0,
        outboundPackStockUnits: newBuffer,
        daysBufferLevel: parseFloat((newBuffer / Math.max(1, prev.targetPacks)).toFixed(2)),
      };
    });
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${
      isDark ? 'bg-[#0B0C0E] text-gray-200' : 'bg-[#F6F5F2] text-slate-800'
    }`}>
      {/* Top Application Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        simState={simState}
        setSimState={setSimState}
        onOpenAiOptimizer={() => setIsAiModalOpen(true)}
        onOpenShiftReport={() => setSimState(prev => ({ ...prev, isShiftReportOpen: true }))}
        theme={theme}
        setTheme={setTheme}
      />

      <DataBanner
        theme={theme}
        seedStatus={seed.status}
        seedError={seed.error}
        loadError={loadError}
        isEmpty={collectionsReady && collectionsEmpty}
        onRetry={seed.retry}
        warnings={derived.warnings}
      />

      {/* Main Content Area with Full Height and Smooth Scroll Control */}
      <main className="flex-1 relative min-h-0 overflow-hidden flex flex-col">
        {/* Blurred plant photo as the backdrop for every non-Floor-Twin tab.
            This lives on `main` (which never scrolls) rather than inside the
            `overflow-y-auto` pane below — an `absolute inset-0` child of a
            scrolling container only ever sizes to that container's own
            viewport box, not its full scrollable content height, so on a
            tab taller than one screen the photo used to stop partway down
            and leave a flat fill for the rest of the scroll. Anchored here
            it always fills the entire visible pane instead. */}
        {activeTab !== 'layout' && (
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <img
              src={plantBackgroundImg}
              alt=""
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center opacity-100 blur-[3px] scale-105"
            />
            <div className={`absolute inset-0 ${
              isDark
                ? 'bg-[#0B0C0E]/75 backdrop-blur-md'
                : 'bg-gradient-to-b from-[#F6F5F2]/78 via-[#F6F5F2]/70 to-[#F6F5F2]/78 backdrop-blur-md'
            }`} />
          </div>
        )}

        {activeTab === 'layout' ? (
          <div className="w-full h-full flex-1 min-h-0 overflow-hidden">
            <ErrorBoundary label="Plant Floor Twin">
            <PlantLayout2D
              zones={zonesApi.zones}
              warehouses={warehousesApi.rows}
              mheFleet={mheFleet}
              simState={simState}
              setSimState={setSimState}
              onSelectZone={() => {}}
              onSelectWarehouse={() => {}}
              theme={theme}
            />
            </ErrorBoundary>
          </div>
        ) : (
          <div className="relative z-10 w-full h-full flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="relative z-10 p-4">
              <ErrorBoundary label={activeTab}>
              {activeTab === 'throughput' && (
                <ThroughputDashboard
                  simState={simState}
                  setSimState={setSimState}
                  zones={zonesApi.zones}
                  theme={theme}
                />
              )}

              {activeTab === 'mhe_personnel' && (
                <MhePersonnelSimulator
                  mheFleet={mheFleet}
                  personnelList={workforceApi.rows}
                  simState={simState}
                  setSimState={setSimState}
                  theme={theme}
                />
              )}

              {activeTab === 'inventory' && (
                <WarehouseInventorySystem
                  warehouses={warehousesApi.rows}
                  simState={simState}
                  setSimState={setSimState}
                  theme={theme}
                  onAddWarehouse={warehouseWrites.insert}
                  onUpdateWarehouse={warehouseWrites.update}
                  onDeleteWarehouse={warehouseWrites.remove}
                />
              )}

              {activeTab === 'machines' && (
                <MachineCensusList
                  zones={zonesApi.zones}
                  theme={theme}
                  derived={derived}
                  onAddMachine={machineWrites.insert}
                  onUpdateMachine={machineWrites.update}
                  onDeleteMachine={machineWrites.remove}
                />
              )}

              {activeTab === 'workforce' && (
                <WorkforcePayroll
                  personnelList={workforceApi.rows}
                  theme={theme}
                  onAddWorkforce={workforceWrites.insert}
                  onUpdateWorkforce={workforceWrites.update}
                  onDeleteWorkforce={workforceWrites.remove}
                />
              )}

              {activeTab === 'tariff' && (
                <TariffEnergyOptimization
                  periods={tariffApi.rows}
                  theme={theme}
                  onAddPeriod={tariffWrites.insert}
                  onUpdatePeriod={tariffWrites.update}
                  onDeletePeriod={tariffWrites.remove}
                />
              )}

              {activeTab === 'capex' && (
                <CapExCostingModel
                  items={capexApi.rows}
                  theme={theme}
                  onAddItem={capexWrites.insert}
                  onUpdateItem={capexWrites.update}
                  onDeleteItem={capexWrites.remove}
                />
              )}

              {activeTab === 'changelog' && <ChangeLog theme={theme} />}
              </ErrorBoundary>
            </div>
          </div>
        )}
      </main>

      {/* Gemini AI Optimization Modal */}
      <AiOptimizerModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        simState={simState}
        setSimState={setSimState}
        zones={zonesApi.zones}
        warehouses={warehousesApi.rows}
        theme={theme}
      />

      {/* Official Shift Performance & QA Handover Report */}
      <ShiftReportModal
        isOpen={simState.isShiftReportOpen}
        onClose={() => setSimState(prev => ({ ...prev, isShiftReportOpen: false }))}
        simState={simState}
        setSimState={setSimState}
        theme={theme}
        onStartNextShift={handleStartNextShift}
      />

      {/* Engineering password challenge. Mounted last and at the highest
          z-index so it sits above the slide-overs and modals that raise it. */}
      <EditAuthGate theme={theme} />
    </div>
  );
}
