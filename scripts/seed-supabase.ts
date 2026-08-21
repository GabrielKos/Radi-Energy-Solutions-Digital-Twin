/**
 * Loads the plant's starting reference data into Supabase from the terminal.
 *
 * You usually will not need this: the app seeds itself from the browser when it
 * finds every table empty (see src/lib/seedPlantData.ts). This script is the
 * same job with the service-role key, useful for CI or for restoring the
 * shipped values over rows that have since been edited.
 *
 * Both paths share one row mapping — src/lib/seedRows.ts — so they cannot drift.
 *
 *   npx tsx scripts/seed-supabase.ts
 *
 * Reads credentials from .env.local. Never commit the service-role key, and
 * never put it in Vercel's client environment variables.
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { SEED_PLAN } from '../src/lib/seedRows';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before running this script.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  for (const step of SEED_PLAN) {
    const rows = step.rows();
    process.stdout.write(`Seeding ${step.table} (${rows.length} rows)... `);
    const { error } = await supabase.from(step.table).upsert(rows);
    if (error) throw error;
    console.log('ok');
  }
  console.log('\nDone. Safe to re-run — every row is upserted by id.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
