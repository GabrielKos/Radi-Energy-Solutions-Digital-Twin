import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Loud, specific failure beats a silent blank screen — see SETUP.md.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Set them in .env.local for dev and in your Vercel project env vars for production. See SETUP.md.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '');
