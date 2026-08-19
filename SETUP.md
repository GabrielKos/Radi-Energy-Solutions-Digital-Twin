# Setup — Live Collaborative Data (Supabase) on Vercel

This adds real, shared, real-time-synced storage for Machines, Warehouses,
Workforce, Tariff Periods, and CapEx. Everything else (the shift simulation
clock, Floor Twin, Throughput) is unchanged and stays local per browser.

## 1. Create a Supabase project
Free tier is enough. https://supabase.com -> New Project.

## 2. Run the schema migration
Supabase dashboard -> SQL Editor -> paste the contents of
`supabase/migrations/0001_init.sql` -> Run.

This creates the six tables, turns on realtime broadcasting for all of them,
and sets permissive row-level-security policies (public read/write — there's
no login system in this app yet, so anyone who loads the site can edit; see
the note at the bottom of the migration file if you want to lock that down
later).

## 3. Get your API keys
Supabase dashboard -> Project Settings -> API:
- `Project URL` -> `VITE_SUPABASE_URL`
- `anon` `public` key -> `VITE_SUPABASE_ANON_KEY`
- `service_role` key -> `SUPABASE_SERVICE_ROLE_KEY` (seed script only, never
  put this in Vercel's client env vars, never commit it)

## 4. Local dev
```
cp .env.example .env.local
# fill in the four values above (SUPABASE_URL is the same as VITE_SUPABASE_URL,
# just without the VITE_ prefix, needed for the seed script)
npm install
```

## 5. Seed the starting data (once)
Loads the plant's existing machine census / warehouses / workforce / tariff /
capex numbers into the new tables, so nothing is lost on cutover.
```
npx tsx scripts/seed-supabase.ts
```
Safe to re-run — it upserts by id.

## 6. Run it
```
npm run dev
```
Open two browser windows side by side, edit a machine in one, watch it
update in the other within about a second — that's the realtime
subscription working.

## 7. Deploy to Vercel
In your Vercel project settings -> Environment Variables, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

(Don't add the service role key to Vercel — it's not needed at runtime,
only for the one-off seed script you run from your own machine.)

Redeploy. The existing Gemini AI optimizer endpoint (`server.ts`,
`/api/gemini/optimize`) is untouched by any of this.

## What's persisted vs. what isn't
| Persisted (Supabase, shared, real-time) | Local only (per browser, unchanged) |
|---|---|
| Machines (Machine Census) | Shift simulation clock / production counters |
| Warehouses (specs — capacity, area, racking cost) | Floor Twin canvas state, camera position |
| Workforce / payroll | Throughput dashboard live simulation |
| Tariff time-of-use periods | AI Optimizer report output |
| CapEx line items | |

## Files involved
- `supabase/migrations/0001_init.sql` — schema, realtime, RLS
- `scripts/seed-supabase.ts` — one-time data load
- `src/lib/supabaseClient.ts`, `useSupabaseTable.ts`, `collections.ts`, `derived.ts`
- `.env.example` — copy to `.env.local`
