import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * False when the deployment is missing its Supabase environment variables.
 *
 * Consumers check this and surface a specific message instead of firing
 * requests that cannot succeed.
 */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

export const SUPABASE_CONFIG_ERROR =
  'Supabase is not configured for this deployment. Set VITE_SUPABASE_URL and ' +
  'VITE_SUPABASE_ANON_KEY in the hosting environment (Vercel → Settings → ' +
  'Environment Variables) or in .env.local for local development, then redeploy. See SETUP.md.';

if (!isSupabaseConfigured) {
  console.error('[supabase] ' + SUPABASE_CONFIG_ERROR);
}

/**
 * `createClient` throws "supabaseUrl is required" when handed an empty string.
 * Because this module is imported at the top of the tree, that throw happened
 * during module evaluation — before React could render anything — so a
 * deployment missing its environment variables served a completely blank page
 * with the failure visible only in the browser console.
 *
 * Falling back to a syntactically valid placeholder keeps the import cheap and
 * side-effect-free. Requests against it fail, but they fail *inside* the app,
 * where `isSupabaseConfigured` turns them into the data banner's plain-English
 * explanation of what is missing and where to set it.
 */
const PLACEHOLDER_URL = 'https://unconfigured.supabase.co';
const PLACEHOLDER_KEY = 'unconfigured';

export const supabase = createClient(
  url || PLACEHOLDER_URL,
  anonKey || PLACEHOLDER_KEY,
  isSupabaseConfigured
    ? undefined
    : {
        // Nothing can succeed without credentials; don't leave a websocket
        // retrying forever behind a screen that has already said why.
        realtime: { params: { eventsPerSecond: 1 } },
      }
);
