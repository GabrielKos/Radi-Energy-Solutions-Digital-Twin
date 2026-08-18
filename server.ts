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

// Lazy initializer for Gemini API with user-agent header
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Plant Technical Summary Data for AI Context
const PLANT_CONTEXT = `
Plant Name: Kiira Battery Manufacturing Plant Digital Twin
Location: NEC T6 Industrial Park, Katuugo, Nakasongola, Uganda (60 Acres, $1.8M Equity Valuation)
Target Annual Capacity: 10 GWh/year (Electric Vehicle Packs & Utility-Scale BESS Storage Systems)
Daily Shift Output Target: 1,183 finished Battery Packs per 10-hour single shift (240 operating days/year, 2,400 productive hours/year)
Standard Line Takt Time: 26.57 seconds per pack (First Pass Yield Target = 0.97, OEE Target = 0.90, Pack Energy = 35.23 kWh, BESS Container = 215 kWh)

Key Buildings & Warehouse Infrastructure:
- WH-1 Inbound Cell Warehouse: Class 9 hazardous storage, 150,000 cell buffer, automatic depalletization.
- WH-2 Outbound Pack Racking Store & Dispatch: 4-day finished pack buffer (10,000 pack racking capacity, currently ~3,781 units).
- WH-3 BESS Container Yard: 50 container staging slots with 30T overhead gantry crane integration.
- WH-4 Non-Live Material Warehouse: 15,000 tray storage for housings, cooling plates, busbars, adhesives, BMS boards, hardware.
- Cleanroom & Dry Rooms: ISO Class 8 cleanrooms with <1% relative humidity for cell sorting & laser welding.

Process Zones & Machine Lines (39 Lines, 285 Machines, $30.08M Equipment CapEx):
- Z1: Inbound Handling, Kitting & Sequencing (Depalletizer, 11 AGVs, MES scanners)
- Z2: Cell Grading, Sorting & Module Stacking (10 cell sorters [600 cells/hr], OCV/IR Hi-Pot, Plasma surface cleaners, 4 stackers, hydraulic compression)
- Z3: Cleanroom Laser Welding (4 50W laser cleaners, 2 3kW busbar laser welders, CCD weld seam vision inspection)
- Z4: Pack Integration, TIM & Sealing (WH-4 tray feeder, TIM dispensing robots, Cell-to-Pack marriage robot, nutrunners, seal stations)
- Z5: End-of-Line Validation & Testing (12 gross leak testers, 12 IP67 pressure decay, 46 batch ageing cyclers [5-hr dwell], 6 vibration rigs)
- Z6: Electrical Integration & BMS (BMS assembly, 43 HV cable routing stations, calibration)
- Z7/Z8: Digital Battery Passport, Labelling & QR tracking (EU CBAM & UN 38.3 compliance)
- Z_BESS: Utility Container Integration (Module stacking, cold plate cooling, 1500V DC busbar welding, HV string BMS, megawatt cycler, 30T gantry)

Workforce & Energy Tariffs:
- Engineered Headcount: 313 (124 Direct labor, 189 Indirect/Technical), $2.40M annual payroll ($500/mo blended rate)
- Uganda ERA Electricity Tariff: $0.055/kWh blended extra-large industrial rate (Peak 18:00-22:00 @ $0.092/kWh vs Off-Peak 22:00-06:00 @ $0.038/kWh)
`;

// AI Digital Twin Assistant & Chatbot Endpoint
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, history = [], simState, activeTab, selectedNode } = req.body;
    const ai = getGeminiClient();

    const systemPrompt = `You are the chief Digital Twin AI Engineer & Operations Optimization Specialist for the 10 GWh Kiira Battery Manufacturing Plant in Katuugo, Nakasongola, Uganda.

Your role is to explain:
1. What all the simulation numbers, charts, and metrics mean (e.g. 1,183 target packs/shift, 26.57s takt time, OEE 90%, First Pass Yield 97%, 4-day buffer, etc.).
2. Why bottlenecks occur at specific stations (e.g. Laser Welding in Z3, Cell Stacking in Z2, Aging Cyclers in Z5, Pack Marriage in Z4) and how machine thread scaling balances cycle time against takt time.
3. How supply chain logistics, truck docking (WH-1 Cell Inbound, WH-4 Material Delivery, WH-2 Pack Dispatch), AGVs, MHE, and warehouses interact.
4. Actionable strategies for throughput enhancement, workforce rebalancing, ERA power tariff peak-avoidance scheduling, and EU Battery Passport / EAC export compliance.

Keep your explanations intuitive, professional, data-backed, and practical. Use Markdown formatting with bolding and bullet points for scannability.

Plant Context:
${PLANT_CONTEXT}

Current Active Simulation & Floor State:
- Active Tab: ${activeTab || 'Plant Layout'}
- Selected Station/Node: ${selectedNode ? JSON.stringify(selectedNode) : 'None'}
- Simulation Clock / Yield: ${JSON.stringify(simState || {}, null, 2)}
`;

    // Construct contents with system instruction context
    const contents: any[] = [];
    
    // Add history if present
    if (Array.isArray(history) && history.length > 0) {
      for (const h of history) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message || 'Explain the current plant throughput and bottleneck situation.' }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    res.json({
      success: true,
      text: response.text,
    });
  } catch (error: any) {
    console.error('Gemini Chat Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate AI response.',
    });
  }
});

// Legacy/Direct Optimization Endpoint
app.post('/api/gemini/optimize', async (req, res) => {
  try {
    const { prompt, focusArea, simState } = req.body;
    const ai = getGeminiClient();

    const userPrompt = `
You are the Lead Digital Twin Optimization Engineer for the Katuugo Nakasongola Battery Plant in Uganda.

System Context:
${PLANT_CONTEXT}

Active Simulation State:
${JSON.stringify(simState || {}, null, 2)}

Focus Area: ${focusArea || 'Overall Plant Optimization'}
User Request:
${prompt || 'Provide an in-depth operational optimization report addressing station bottlenecks, logistics flow, and tariff savings.'}

Generate a clear, structured Markdown report with:
1. Executive Assessment & Bottleneck Analysis
2. Supply Chain & Warehouse 4-Day Buffer Strategy
3. Machine Cycle Balancing (Takt vs Station Processing Times)
4. ERA Tariff Peak-Avoidance Energy Schedule
5. Immediate Action Plan
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: userPrompt,
    });

    res.json({
      success: true,
      report: response.text,
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
