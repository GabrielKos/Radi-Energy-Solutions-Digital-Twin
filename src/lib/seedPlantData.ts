import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { SEED_PLAN } from './seedRows';

export type SeedStatus = 'idle' | 'seeding' | 'done' | 'error';

/**
 * Loads the shipped plant reference data straight from the browser using the
 * public anon key.
 *
 * The terminal script (`npx tsx scripts/seed-supabase.ts`) does the same job
 * with the service-role key, but it needs a working shell, the right env file
 * and Node — three things that can each fail independently, and did. This path
 * needs none of them: if the tables are empty when the app loads, it fills
 * them, and every other open tab sees the rows arrive over the realtime
 * subscription.
 *
 * Upsert, not insert — re-running restores the shipped values in place and
 * leaves rows you have added yourself alone.
 */
/** Columns added by later migrations, which an older schema will reject. */
const OPTIONAL_COLUMNS = ['packs_per_cycle'];

function withoutColumn(rows: any[], column: string) {
  return rows.map(r => {
    const { [column]: _drop, ...rest } = r;
    return rest;
  });
}

export async function seedPlantData(): Promise<void> {
  if (!isSupabaseConfigured) {
    if (typeof window !== 'undefined') {
      for (const step of SEED_PLAN) {
        window.localStorage.removeItem(`radi_twin_mock_${step.table}`);
      }
    }
    try {
      await fetch('/api/db/reset', { method: 'POST' });
    } catch (err) {
      console.warn('[seed] Local reset notice:', err);
    }
    return;
  }

  try {
    for (const step of SEED_PLAN) {
      let rows = step.rows();
      if (!rows.length) continue;

      let { error } = await supabase.from(step.table).upsert(rows);

      for (const column of OPTIONAL_COLUMNS) {
        if (error && error.message.includes(column)) {
          rows = withoutColumn(rows, column);
          ({ error } = await supabase.from(step.table).upsert(rows));
        }
      }

      if (error) {
        console.warn(`[seed] Supabase seed notice for ${step.table}:`, error.message);
      }
    }
  } catch (err: any) {
    console.warn('[seed] Remote seed skipped, local & server data active:', err?.message);
  }
}

interface UseSeedOnEmptyArgs {
  /** True once every collection has finished its first fetch. */
  ready: boolean;
  /** True when every table came back with zero rows. */
  isEmpty: boolean;
  /** Re-read the tables once the seed lands. */
  refetch: () => void;
}

/**
 * Fires the seed exactly once per page load, and only when *every* table is
 * empty — that combination means an unseeded database, not someone having
 * deliberately deleted their last warehouse.
 */
export function useSeedOnEmpty({ ready, isEmpty, refetch }: UseSeedOnEmptyArgs) {
  const [status, setStatus] = useState<SeedStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  const run = useCallback(async () => {
    attempted.current = true;
    setStatus('seeding');
    setError(null);
    try {
      await seedPlantData();
      setStatus('done');
      refetch();
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'Could not load the starting data.');
    }
  }, [refetch]);

  useEffect(() => {
    if (!ready || !isEmpty || attempted.current) return;
    void run();
  }, [ready, isEmpty, run]);

  return { status, error, retry: run };
}
