# RADI Digital Twin — Katuugo Battery Plant

Live, collaborative digital twin and operational simulator for the 10 GWh Kiira
battery manufacturing plant at Katuugo, Nakasongola, Uganda.

The app models a full production shift end to end: cell receiving, OCV sorting,
cell stacking, cleanroom busbar welding, pack marriage, end-of-line validation,
BESS container integration and outbound dispatch — with the machine census,
workforce, tariff schedule and CapEx ledger all editable and shared live between
everyone who has the app open.

---

## Screens

| Tab | What it does |
|---|---|
| **Floor Twin** | Interactive 2D plant canvas — discrete-event material flow, AGV/truck logistics, pan/zoom, per-station inspector, drag-to-rearrange stations |
| **Throughput** | Live shift performance: takt, yield, OEE, pack counts against target |
| **Machine Census** | The equipment register (WBS, cycle time, unit count, unit rate) — drives the line model |
| **Warehouses** | Warehouse estate: capacity, floor area, racking CapEx, buffer days |
| **MHE Fleet** | AGV / forklift / personnel movement simulation with scenario sliders |
| **Workforce** | Headcount by zone and classification, with payroll roll-up |
| **Tariff & Energy** | Time-of-use tariff periods and load-shifting recommendations |
| **CapEx** | Capital cost ledger by WBS code and category |
| **Change Log** | Append-only trail of every authorised change: who, what, when, before → after |

The census, workforce table and tariff schedule are not decorative — they feed
`deriveSimInputs`, so editing a machine's cycle time or a shift crew size moves
the simulation's takt, target and operator count immediately.

---

## Stack

- **React 19 + TypeScript**, built with **Vite 6**
- **Tailwind CSS 4** for styling, **lucide-react** for icons, **Recharts** for charts
- **Supabase** (Postgres + Realtime) for shared, persisted, live-synced data
- **Express** (`server.ts`) serving the app and the `/api/gemini/optimize`
  endpoint that backs the AI Strategy optimiser

---

## Running it

```bash
npm install
cp .env.example .env.local      # then fill in the values, see below
npx tsx scripts/seed-supabase.ts # one-off; safe to re-run (upserts by id)
npm run dev
```

Full database setup — creating the Supabase project, running the schema
migration, and deploying to Vercel — is in **[SETUP.md](SETUP.md)**.

| Script | Does |
|---|---|
| `npm run dev` | Express + Vite in middleware mode |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve a built bundle |
| `npm run lint` | `tsc --noEmit` — full typecheck, no emit |

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Supabase public anon key |
| `VITE_EDIT_PASSWORD` | client | Overrides the engineering edit password (default `RADI2030`) |
| `SUPABASE_URL` | seed script only | Same URL, no `VITE_` prefix |
| `SUPABASE_SERVICE_ROLE_KEY` | seed script only | **Never** expose to the client or add to Vercel |
| `GEMINI_API_KEY` | server only | Backs `/api/gemini/optimize` |

---

## Edit authorisation

Every change that is written back to the shared database — adding, editing or
deleting a machine, warehouse, workforce line, tariff period or CapEx item — and
unlocking the Floor Twin station layout raises a password challenge. The default
password is **`RADI2030`**; set `VITE_EDIT_PASSWORD` at build time to change it.

The challenge is raised on **every** write, not once per session, so an
unattended control-room screen cannot be quietly edited by whoever walks up to
it next. Reading is never gated: the twin, the simulation and every dashboard
are fully usable without authorising anything.

The dialog also asks **who** is making the change. That email is remembered per
browser — typed once, then shown as a confirmable line with a "Not you?" reset —
while the password is still required every time. Identity is a convenience;
authorisation is not.

Implementation lives in [`src/lib/editAuth.tsx`](src/lib/editAuth.tsx). The
collections are wrapped once in `App.tsx` via `guardCollection`, so a new CRUD
screen cannot ship without the guard, or without the trail, by forgetting to
opt in.

## Change log

Every authorised write records the actor's email, the action, the record and the
value on each side of the change into the `audit_log` table, and the **Change
Log** tab presents it filtered by person, area and action.

The table is append-only *by policy*: it has a read policy and an insert policy
and no update or delete policy at all. Postgres denies anything a policy does
not explicitly permit, so a trail entry cannot be rewritten or erased from any
browser — which is the whole point of keeping one.

The recorded email is self-declared, not verified. It tells a colleague reading
the trail who made a change; it does not prove it. Verified identity arrives
with Supabase Auth, alongside the RLS lock-down below.

## Shared floor layout

Dragging a station on the Floor Twin saves its position to `station_positions`
and pushes it live to every open browser, so the team works from one agreed
plant layout rather than each person's private arrangement. Unlocking the layout
raises the password challenge; re-locking never does, because making the floor
read-only again must always be available. "Reset Floor Layout" clears the saved
positions for everyone and is challenged and recorded accordingly.

Positions are keyed by canvas node id, which `buildFactoryModel` generates
deterministically. Saved rows for stations a later build no longer produces are
ignored rather than treated as an error — that is what keeps editing the machine
census safe, since the census determines which stations exist.

> **This is an operational guard, not a security boundary.** The app ships as a
> static bundle, so the expected password is readable by anyone who opens
> browser devtools, and a determined user could call Supabase directly with the
> public anon key. The only real write boundary is row-level security in the
> database. `supabase/migrations/0002_lock_down_rls.sql` keeps reads public and
> requires a genuine signed-in session for every write — run it, alongside
> Supabase Auth, before this deployment is reachable outside a trusted network.

---

## Truck logistics model

Three vehicle flows are simulated on the Floor Twin canvas:

| Flow | Dock | Approach | Trigger |
|---|---|---|---|
| Inbound raw cells | `W01` — WH-1 Inbound Cell Dock | from the west | Timed, `inboundTruckRatePerHour` |
| Material trays | `W05_Mat_In` — WH-4 Material Delivery Dock | from the east | Timed, material delivery rate |
| Outbound packs | `W04_Out` — WH-2 Outbound Dispatch Dock | from the west | When dock inventory reaches the dispatch batch size |

Each truck carries the id of the dock it was dispatched to. Arrival, dwell and
the stock transfer are all resolved against that node's live position, so a
truck berths at its own warehouse with its nose stopped short of the dock face —
it cannot run through the building, park short of it, or berth at a dock
belonging to another flow. One vehicle per bay at a time; a truck whose dock
disappears in a layout rebuild drives off rather than transferring stock to
nothing. See `dockRestX` in
[`src/components/PlantLayout2D.tsx`](src/components/PlantLayout2D.tsx).

---

## Equipment on the canvas

Stations are not rectangles. Each draws the shape of the machine that stands
there — an articulated arm at a stacking robot, a laser head with a beam cone at
a welder, a portal frame at the gantry crane, a banded stack of prismatic cells
at a cell-stack buffer, a cased pack with HV terminals at a pack buffer.

Every glyph is drawn in code in
[`src/lib/equipmentGlyphs.ts`](src/lib/equipmentGlyphs.ts) rather than loaded as
an image: it stays crisp at any zoom, follows the light/dark theme and the live
status colour, and adds nothing to the bundle. Moving parts are phased by each
station's own cycle time and only animate while the station is *working*, so
motion on the floor always means work.

`classifyStation` picks the glyph from the station id first, then from what a
buffer holds, and only then from wording in the label — a buffer is classified
by its contents, never by the process words in its name, so "Pre-Weld Cell Stack
Buffer" draws a rack of cell stacks rather than a laser welder.

**This is a cell-to-pack line.** Stacked prismatic cells are banded straight into
a pack; there is no intermediate module. The EV line therefore carries cells and
then cell stacks, never modules. The BESS line does group modules, and its
labels say so.

## Layout

```
src/
  App.tsx                    Shell, tab routing, global simulation clock, write guards
  components/
    PlantLayout2D.tsx        The Floor Twin canvas: nodes, links, particles, trucks, MHE
    Header.tsx               Nav, shift clock, sim speed controls
    ThroughputDashboard.tsx  Live shift KPIs
    MachineCensusList.tsx    Equipment register CRUD
    WarehouseInventorySystem.tsx
    MhePersonnelSimulator.tsx
    WorkforcePayroll.tsx
    TariffEnergyOptimization.tsx
    CapExCostingModel.tsx
    ChangeLog.tsx            Read-only audit trail
    AiOptimizerModal.tsx     Gemini-backed strategy report
    ShiftReportModal.tsx     End-of-shift QA handover report
    common/                  CrudSlideOver, ConfirmDialog, DataBanner, ErrorBoundary, RowActions
  lib/
    supabaseClient.ts        Client construction
    useSupabaseTable.ts      Generic table hook: load, realtime subscribe, insert/update/remove
    collections.ts           Per-collection adapters (row <-> domain type)
    derived.ts               Zone roll-ups
    simulationInputs.ts      Census/workforce/tariff -> takt, target, operators, tariff
    seedPlantData.ts         First-run seed when every table is empty
    editAuth.tsx             Password challenge, identity, write guards
    auditLog.ts              Change trail: write, read, field diffing
    stationPositions.ts      Shared Floor Twin station positions
    equipmentGlyphs.ts       Vector machine glyphs drawn on the canvas
  data/plantData.ts          Shipped plant constants and MHE fleet
  types/plant.ts             Shared domain types
supabase/migrations/         Schema, realtime, RLS, station positions, audit log
vercel.json                  Deployment config (Vite preset, SPA rewrites)
scripts/seed-supabase.ts     One-off data load
server.ts                    Express host + Gemini endpoint
```

---

## Further reading

- **[SETUP.md](SETUP.md)** — Supabase project, schema migration, seeding, Vercel deploy
- **[UI-REVIEW.md](UI-REVIEW.md)** — interface review notes
- **[RECOMMENDATIONS-APPLIED.md](RECOMMENDATIONS-APPLIED.md)** — changelog of applied review items

---

Kiira Motors Corporation — RADI Energy Solutions. Internal engineering tool.
