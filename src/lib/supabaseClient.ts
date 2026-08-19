import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://placeholder.supabase.co';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

if (!isSupabaseConfigured) {
  // Helpful developer notification — fallback data model active
  console.info(
    '[supabase] Running with local digital twin state. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable remote multi-user sync.'
  );
}

export const supabase = createClient(url, anonKey);
