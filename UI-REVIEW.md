# Radi Digital Twin — UI review & bug report

Reviewed by merging your two folders into a working build, running it, and driving every
tab in a real browser in both themes. Everything below was reproduced, not inferred.

---

## The reason nothing was running

`radi-digital-twin-live-collab` only ever contained the files from my update zip. It was
missing every file the zip didn't touch, which lived in `Radi-Energy-Solutions-Digital-Twin-main`:

| Missing | Consequence |
|---|---|
| `server.ts` | `npm run dev` is `tsx server.ts` — fails instantly |
| `vite.config.ts`, `tsconfig.json` | no Tailwind, no React plugin, no typecheck |
| `src/main.tsx` | `index.html` points at it; blank page |
| `ThroughputDashboard`, `MhePersonnelSimulator`, `AiOptimizerModal`, `ShiftReportModal` | `App.tsx` imports all four |

The seed script was also still unpatched — the `dotenv` lines had never been added, so it
could not see `.env.local`. Both are fixed; your folder is now a complete, building project.

---

## Bugs that break the app

**1. Warehouses tab crashed the entire app when the table was empty.**
`activeWh = warehouses.find(...) || warehouses[0]` is `undefined` on an empty list, and
`activeWh.name` threw. There was no error boundary, so React unmounted everything and left
a white page — no nav, no way back. This fires on an unseeded database (i.e. exactly where
you are now), on a failed fetch, and after deleting the last warehouse. Now shows a proper
empty state with an Add button, and an `ErrorBoundary` wraps every tab so one bad render
costs you that tab instead of the session.

**2. The Plant Operations drawer covered the first two nav tabs.**
The drawer was `fixed top-16` — 64px — but the header with its nav row is ~110px tall, so
the drawer sat on top of "Plant Floor Twin" and "Throughput & Line Takt" and swallowed
their clicks. On the Floor Twin tab you could not reach the Throughput tab at all. It's now
`absolute` inside the content area. The floating HUD had the same problem in reverse
(`left-14` cleared only the *collapsed* rail), so its stats were hidden behind the open drawer.

**3. `npm run lint` was checking nothing.**
`@types/react` and `@types/react-dom` aren't installed, so `React.Component` resolves to
`any` and TypeScript silently skips every React file. There was also one genuine error in
`useSupabaseTable.ts` that the script would have caught. **Recommend installing both** —
worth doing before the next round of changes.

---

## Numbers on screen that contradicted the data underneath

This was the biggest category, and the most damaging, because the screens look authoritative.

**Workforce tab was wrong by 69 people.** "313 Headcount", "124 Direct + 189 Indirect", the
pie legend and the chart title were all hardcoded strings. The live data gives **124 direct
and 120 indirect — 244 total**. Meanwhile the payroll figures right beside them *were* live.
Someone would quote 313 headcount and $1.61M payroll off the same card. `totalHeadcount`
was already being computed correctly in the file and simply never used. Now wired up.

**Tariff tab disagreed with itself by ~2×.** "Annual Energy Consumption 10,140 MWh" was a
fixed string, while "Estimated Annual Power Bill $1,036,800" was computed from the hourly
load profile — which implies **19,080 MWh**. Both now derive from the same profile.

**Process equipment CapEx had three different values.** Machine Census said $31.93M
(hardcoded), the CapEx ledger's B.2 line says $30.09M, and the census rows actually sum to
$7.98M. The $7.98M is the ex-works line-item total; $31.93M was the loaded figure including
CIF/duty and the MES spine. The card now states plainly what it sums and points at WBS B.2
for the loaded number, so the two screens can't drift.

Also fixed: Machine Census machine counts (285u / 22u) and CapEx "285 Machines" were fixed
strings; the salary chart's Y axis was pinned to 0–2500 and would clip any salary you
entered above that; the salary chart silently showed only the first 10 of 18 roles.

---

## Chart rendering

**Both donut charts rendered as broken partial arcs.** The Workforce and CapEx donuts drew
roughly 250° of a 360° circle with a wedge missing, from `paddingAngle` interacting badly
with the sector maths. Fixed with explicit `startAngle`/`endAngle` and a stroke separator
instead of an angular gap.

**The cumulative shift curve dove back to zero mid-shift.** Future hours emitted `0`, which
an area chart plots as a real value — so the "cumulative" line collapsed to the axis and
read as a line stoppage. Future hours are now `null`, so the series just ends at *now*.

Smaller ones: hour labels rendered as `Hr 6 (011:00)` (hardcoded leading zero); neither
chart on the Tariff tab had a legend, so blue-vs-green was a guess; the CapEx bar chart
painted every bar the same green while the donut beside it used each line's own colour, so
the two charts encoded the same data differently. All addressed.

---

## The look — what I changed and what I'd still do

You picked light-first, so:

**Tariff, CapEx, the slide-over form and the delete dialog were hardcoded dark** — dark
cards on a cream page. They now follow the theme like the other tabs do.

**Your `plant.png` background was invisible.** It was at `opacity-10` under a `blur-xl` and
an 85%-opaque scrim, and then every tab painted an opaque `bg-slate-50` on top of it
anyway. Backgrounds are transparent now and the scrim is lighter — the plant reads as a
soft texture behind the cards. Same for `robotics.jpg` in the ops drawer.

**Every `dark:` class in the app was dead.** Tailwind's `dark:` variant follows the OS
colour scheme unless something puts `.dark` on the document — nothing did. So dark badges
were appearing on light screens for anyone whose laptop is in dark mode, independent of
your toggle. `App.tsx` now binds the class properly, and the theme persists across reloads
instead of resetting to light.

**Contrast.** Card eyebrow labels were `text-gray-400` on white (~2.8:1, fails AA) and the
row edit/delete icons were nearly invisible. Both darkened.

Still open, if you want them:

- **Three competing neutrals.** Header is cream `#F6F5F2`, page bodies were `slate-50`
  (a cool blue-grey), cards are pure white. I moved bodies to transparent so the cream
  shows through, but the white cards still read slightly cold against it. Warming cards to
  `#FDFCFA` would tie it together.
- **`mhe_personnel` is dead code.** `App.tsx` handles the tab but `Header.tsx` has no nav
  item for it, so `MhePersonnelSimulator` is unreachable. Either add the tab or drop it.
- **Long tables have no sticky header.** The machine census is 46 rows; you lose the column
  names immediately on scroll.
- **No search on the Workforce or CapEx tables**, only on Machines.
- **The `Add Warehouse` tile** sits orphaned on its own row under a 4-across grid.

---

## Data-layer notes

- **RLS is fully open.** Anyone who loads the site can read, write and delete every table.
  That was the deliberate call for "collaborate without signing in", but it's worth a
  conscious decision before this is on a public Vercel URL.
- **The migration isn't re-runnable.** `alter publication supabase_realtime add table ...`
  errors on a second run, unlike everything else in the file which is guarded.
- **Form validation happens in Postgres, not the form.** Entering hour `30` or a fractional
  machine count surfaces a raw constraint-violation string to the user. I bounded the hour
  fields; the rest still relies on the database.
- **Tariff USD and UGX were two independent fields** that could silently drift apart. Typing
  a USD rate now proposes the matching UGX rate at 3,750; typing UGX still overrides.

---

## Where you are now

Your folder builds and runs. `npm run dev`, then the two things still outstanding:

1. `npx tsx scripts/seed-supabase.ts` — the dotenv fix is in place, so this should work now.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel and redeploy.
