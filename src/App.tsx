import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PlantLayout2D } from './components/PlantLayout2D';
import { ThroughputDashboard } from './components/ThroughputDashboard';
import { MhePersonnelSimulator } from './components/MhePersonnelSimulator';
import { WarehouseInventorySystem } from './components/WarehouseInventorySystem';
import { MachineCensusList } from './components/MachineCensusList';
import { WorkforcePayroll } from './components/WorkforcePayroll';
import { TariffEnergyOptimization } from './components/TariffEnergyOptimization';
import { CapExCostingModel } from './components/CapExCostingModel';
import { GoogleDriveSync } from './components/GoogleDriveSync';
import { AiOptimizerModal } from './components/AiOptimizerModal';
import { ShiftReportModal } from './components/ShiftReportModal';
import roboticsLineImg from './assets/images/robotics_line_header_1786912826971.jpg';

import {
  PLANT_METADATA,
  PROCESS_ZONES,
  WAREHOUSES,
  MHE_FLEET,
  PERSONNEL_SUMMARY,
  TARIFF_SCHEDULE,
} from './data/plantData';
import { SimulationState, ProcessZone, WarehouseInfo, MheItem, PersonnelCategory, ThemeMode } from './types/plant';

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [activeTab, setActiveTab] = useState<
    'layout' | 'throughput' | 'mhe_personnel' | 'inventory' | 'machines' | 'workforce' | 'tariff' | 'capex' | 'drive_sync'
  >('layout');

  const [zones, setZones] = useState<ProcessZone[]>(PROCESS_ZONES);
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>(WAREHOUSES);
  const [mheFleet, setMheFleet] = useState<MheItem[]>(MHE_FLEET);
  const [personnelList, setPersonnelList] = useState<PersonnelCategory[]>(PERSONNEL_SUMMARY);

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
      isDark ? 'bg-[#0B0C0E] text-gray-200' : 'bg-slate-100 text-slate-800'
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

      {/* Main Content Area with Full Height and Smooth Scroll Control */}
      <main className="flex-1 relative min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'layout' ? (
          <div className="w-full h-full flex-1 min-h-0 overflow-hidden">
            <PlantLayout2D
              zones={zones}
              warehouses={warehouses}
              mheFleet={mheFleet}
              simState={simState}
              setSimState={setSimState}
              onSelectZone={() => {}}
              onSelectWarehouse={() => {}}
              theme={theme}
            />
          </div>
        ) : (
          <div className="w-full h-full flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative">
            {/* Subtle background image peering through negative space */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <img
                src={roboticsLineImg}
                alt=""
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center opacity-10 blur-xl scale-105"
              />
              <div className={`absolute inset-0 ${
                theme === 'dark' ? 'bg-[#0B0C0E]/80 backdrop-blur-xl' : 'bg-[#F8FAFC]/80 backdrop-blur-xl'
              }`} />
            </div>

            <div className="relative z-10 p-4">
              {activeTab === 'throughput' && (
                <ThroughputDashboard
                  simState={simState}
                  setSimState={setSimState}
                  zones={zones}
                  theme={theme}
                />
              )}

              {activeTab === 'mhe_personnel' && (
                <MhePersonnelSimulator
                  mheFleet={mheFleet}
                  personnelList={personnelList}
                  simState={simState}
                  setSimState={setSimState}
                  theme={theme}
                />
              )}

              {activeTab === 'inventory' && (
                <WarehouseInventorySystem
                  warehouses={warehouses}
                  simState={simState}
                  setSimState={setSimState}
                  theme={theme}
                />
              )}

              {activeTab === 'machines' && (
                <MachineCensusList zones={zones} theme={theme} />
              )}

              {activeTab === 'workforce' && (
                <WorkforcePayroll personnelList={personnelList} theme={theme} />
              )}

              {activeTab === 'tariff' && (
                <TariffEnergyOptimization theme={theme} />
              )}

              {activeTab === 'capex' && (
                <CapExCostingModel theme={theme} />
              )}

              {activeTab === 'drive_sync' && (
                <div className="max-w-5xl mx-auto py-2">
                  <GoogleDriveSync
                    folderId="1MkNiCIRYVzdyhKEeBJdsMKvw99m2Q_vz"
                    fileId="1lD2IyLWSK_EqZl7xeQUq5gsPsJmVdyM0"
                    onApplyModification={(modData) => {
                      if (modData.targetPacks) {
                        setSimState(prev => ({ ...prev, targetPacks: modData.targetPacks }));
                      }
                      if (modData.currentTaktSec) {
                        setSimState(prev => ({ ...prev, currentTaktSec: modData.currentTaktSec }));
                      }
                      if (modData.warehouses) {
                        setWarehouses(modData.warehouses);
                      }
                      if (modData.zones) {
                        setZones(modData.zones);
                      }
                    }}
                    theme={theme}
                  />
                </div>
              )}
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
        zones={zones}
        warehouses={warehouses}
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
    </div>
  );
}
