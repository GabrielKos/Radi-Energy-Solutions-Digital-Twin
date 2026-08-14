import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini API
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment variables.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// Plant Technical Summary Data for AI Context
const PLANT_CONTEXT = `
Plant Name: Kiira Battery Manufacturing Plant
Location: NEC T6 Industrial Park, Katuugo, Nakasongola, Uganda (60 Acres, $1.8M Equity Valuation)
Target Capacity: 10 GWh/year (Electric Vehicle Packs & BESS Storage Systems)
Daily Shift Target: 1,183 finished Battery Packs per 10-hour shift (240 days/year, 2,400 productive hours/year)
Takt Time: 26.57 seconds per pack (First Pass Yield = 0.97, OEE = 0.90, Pack Energy = 35.23 kWh)

Buildings & Facilities:
- Main Production Building: 60,000 m² (ISO 8 Cleanroom & Dry Rooms, ESD epoxy flooring)
- Warehousing (Hazardous Class 9): 30,000 m² combined (Inbound Cells, Outbound Finished Packs, BESS Storage, FM-200 gas fire suppression)
- Production Material Warehouse: Non-live components (housings, cooling plates, busbars, adhesives, BMS boards, hardware)
- Worker Residential Housing: 15,000 m² for 400 workers (4 G+3 blocks, dining hall, pool, sports ground)
- Administrative & R&D Block: 5,000 m² with 100m enclosed Sky Bridge over HGV loop road
- Utilities: 33kV Substation (6,300 kVA intake), 100 KLD Zero Liquid Discharge (ZLD) MBR/RO WWTP

Equipment & Process Zones (39 Lines, 285 Machines, $30.08M CapEx):
- Z1: Inbound Handling, Kitting & Sequencing (24 machines: 11 AGVs, 1 Robotic Manipulator, 4 MES Reg, 8 Kitting)
- Z2: Cell Conditioning, Grading & Sorting (31 machines: 10 Battery Cell Sorters [600 cells/hr, 10-grade], 7 OCV/IR Hi-Pot, 4 EIS, 10 Surface Plasma Cleaners)
- Z3: Stack Build & Fire Protection (22 machines: 4 Tape Manipulators, 4 Stacking Machines, 3 Hydraulic Presses 30kN, 2 Pressure Gauges, 9 Aerogel Applicators)
- Z4: Terminal Prep & Laser Welding (7 machines: 4 50W Laser Cleaners, 2 3kW Busbar Laser Welders, 1 Weld Vision Inspection)
- Z5: Pack Integration, TIM & Sealing (35 machines: Conveyor Spine, 2 Clean/Dispense, 2 Cooling Plate Install, 2 TIM Robots, 1 Laser Profilometer, 10 PU Foam Guns, 3 Curing Tunnels, 2 Nutrunners, 12 Cell-to-Pack Heavy Duty Robots)
- Z6: Electrical Integration & BMS (83 machines: 6 Busbar Workstations, 20 BMS Assembly, 43 HV Cable Routing [Largest manual attendance block], 7 BMS Testers, 6 Calibration, 1 Off-gas sensor)
- Z7: End-of-Line Validation & Ageing (78 machines: 12 Gross Leak, 12 IP67 Pressure Decay, 2 Hi-Pot, 46 Batch Ageing Cyclers [5 hr dwell, 6.76% sample], 6 Vibration Test Rigs [9 hr sequence, 0.42% sample])
- Z8: Labelling & Digital Passport (5 machines: 1 Labeller, 3 Passport Servers, 1 UPS 30kVA)
- Storage Cabinet & Enclosure Fabrication: 22 BESS cabinet stations, 11 enclosure machines (laser sheet, tube laser, 160t corrugation, 300kN press brake, CNC milling), 4 coating plant booths/tunnels.

Workforce (313 Engineered Headcount, 400 Capacity):
- Direct Labor: 124 positions across shifts
- Indirect Labor: 189 positions (20 Maintenance, 19 Quality, 26 Logistics/Warehouse, 31 Security, 16 Housekeeping, 17 Engineering, etc.)
- Payroll: $2.40M annually ($500/month loaded blended rate per employee)

CapEx Summary ($140.23M Total):
- Land & Site: $3.80M | Buildings: $67.24M | Process Equipment: $30.09M | Utilities: $6.92M | Material Handling: $5.48M | Safety/Services: $1.47M | Licensing/Permits: $2.83M | Pre-op/Start-up: $9.68M | Contingency (10%): $12.75M
OpEx Summary ($1.518 Billion/yr total including raw materials):
- Power: $557,700/yr (10,140 MWh @ ERA Extra-Large tariff $0.055/kWh hydro energy)
`;

// Gemini Optimization Analysis Endpoint
app.post('/api/gemini/optimize', async (req, res) => {
  try {
    const { prompt, simulationState } = req.body;
    const ai = getGeminiClient();

    const userPrompt = `
You are an expert Gigafactory Industrial & Logistics Optimization AI for the Katuugo Nakasongola Battery Plant Digital Twin in Uganda.

System Context:
${PLANT_CONTEXT}

Current Active Simulation State:
${JSON.stringify(simulationState || {}, null, 2)}

User Request / Optimization Goal:
${prompt || 'Provide a comprehensive material flow, layout, and staffing optimization strategy for reaching the 1,183 packs/shift output target with maximum efficiency.'}

Provide your response in structured Markdown with clear actionable sections:
1. Executive Assessment & Bottleneck Identification
2. Warehouse & Material Flow Strategy (Inbound Cells, Outbound Packs, BESS, Non-live Materials)
3. Equipment & Personnel Rebalancing Recommendations
4. Shift & Tariff Cost Optimization (Uganda Electricity ERA $0.055/kWh Peak vs Off-Peak Strategy)
5. Regulatory & Digital Battery Passport Access Compliance (EU CBAM & UN 38.3)
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
    });

    res.json({
      success: true,
      text: response.text,
    });
  } catch (error: any) {
    console.error('Gemini Optimization Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process AI optimization analysis.',
    });
  }
});

// Plant Static Data Endpoint
app.get('/api/plant/metadata', (req, res) => {
  res.json({
    plantName: 'Kiira Battery Manufacturing Plant Digital Twin',
    location: 'NEC T6 Industrial Park, Katuugo, Nakasongola, Uganda',
    landArea: '60 Acres (USD 1.8M Equity)',
    capacityTargetGWh: 10,
    dailyPackTarget: 1183,
    shiftHours: 10,
    taktTimeSeconds: 26.57,
    firstPassYieldTarget: 0.97,
    oeeTarget: 0.90,
    totalCapExUSD: 140232979,
    totalWorkforceEngineered: 313,
    residentialHousingCapacity: 400,
    annualPayrollUSD: 2400000,
    electricityTariffUSD: 0.055,
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Twin Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
