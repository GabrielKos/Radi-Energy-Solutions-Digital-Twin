# Round 2 — the open recommendations, carried out

Everything listed as "still open" in `UI-REVIEW.md`, plus the data-layer notes. Verified by
driving all eight tabs in a real browser in both themes, and by exercising the forms.

**One action needed from you: run `npm install`.** Two new devDependencies are in
`package.json` but not yet in your `node_modules`.

---

## TypeScript is actually checking now

Installed `@types/react` and `@types/react-dom`. `npm run lint` had been passing on every
React file by skipping them entirely. Turning it on surfaced four real defects, all fixed:

- **`AiOptimizerModal` never declared a `theme` prop** even though `App.tsx` has been passing
  one. The modal was hardcoded dark on a light page — the last dark-on-light surface in the
  app, and invisible until now because nothing typechecked it.
- **`setActiveTab` was typed `(tab: string) => void`** in `Header.tsx`, so the nav could ask
  for a screen that renders nothing. There's now a shared `TabId` union in `types/plant.ts`
  that both sides use.
- **`addMachine` demanded `totalCostUSD`**, a derived field that is never written to the
  database — the call site only compiled because the types were absent.
- **`FloatingText.id` was required but four of eight push sites omitted it.** Nothing reads
  it (these are drawn to canvas and removed by index), so it's now optional.

`npx tsc --noEmit` is clean and `vite build` succeeds.

## The MHE tab is reachable

`App.tsx` handled `mhe_personnel`, but `Header.tsx` had no nav entry, so
`MhePersonnelSimulator` — a live AGV/forklift pathing simulation with scenario sliders — was
unreachable. It's now a tab, and it turned out to be entirely hardcoded dark, which is why
nobody had spotted it; it follows the theme now.

Eight tabs no longer fit at laptop width, so each label is shortened with the full
description as a tooltip, rather than quietly scrolling off the right edge. The Workforce
tab is now "Workforce" (it was "Workforce & MHE Fleet", which described the wrong screen).

## One neutral palette

Card surfaces moved from pure white to `#FDFCFA`, borders to `#E7E3DC`, table headers to
`#F1EEE8`, row hovers to `#F6F5F2`. The cream header, the plant-photo background and the
cards now read as one surface family instead of three competing greys. Touched 11 files.

## Tables

Sticky headers on Machines, Workforce and CapEx — the census is 46 rows and you lost the
column names on the first scroll. Search added to Workforce (ref / department / basis) and
CapEx (WBS code / category), matching what Machines already had, each with a live
"showing N of M" count. CapEx search filters the ledger only; the charts and share
percentages stay on the full set so they remain meaningful.

## Forms validate before they hit the database

`CrudSlideOver` now checks values itself and shows the error inline on the offending field,
instead of round-tripping to Postgres and surfacing a raw constraint violation. Fields carry
`required`, `min`, `max` and `integer` rules mirroring the migration's own constraints, plus
a few custom ones:

- duplicate WBS code within a zone (Machines) or in the ledger (CapEx)
- a tariff period whose start and end hour match, which would cover no hours at all
- an annual payroll wildly out of step with monthly × 12 × crew — flagged, not blocked,
  because the seed data genuinely has rows where no single multiplier fits

Escape and backdrop-click now close the slide-over and the confirm dialog; both got proper
`role`/`aria-modal` attributes and the inputs got real `<label for>` associations.

## Warehouses

The Add control was a dashed tile inside a four-column grid — with exactly four warehouses
it was stranded alone on its own row. It's now a section action under a "Warehouse Estate"
header that also shows facility count and total floor area.

## Database

**`0001_init.sql` is re-runnable.** The realtime publication statement was the one line in
an otherwise idempotent file that failed on a second run; it's now guarded per table against
`pg_publication_tables`.

**`0002_lock_down_rls.sql` is new — do not run it yet.** RLS is currently wide open: anyone
who loads the site can delete your machine census. That's fine while the URL is private and
it's the right trade-off for sign-in-free collaboration, so I have not changed the live
behaviour. The migration is there for when you add Supabase Auth: reads stay public so the
twin is still viewable, writes require a session. I'd run it before sharing the Vercel URL
with anyone outside the project.

---

## Where you are now

```
npm install          # picks up @types/react and @types/react-dom
npx tsx scripts/seed-supabase.ts
npm run dev
```

Then add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel and redeploy.
