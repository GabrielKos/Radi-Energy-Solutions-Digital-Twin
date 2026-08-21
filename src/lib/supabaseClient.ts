import { createClient } from '@supabase/supabase-js';

/**
 * Environment values arrive from three places — a local `.env.local`, a hosting
 * provider's environment-variable form, and a CI secret — and every one of them
 * can hand back a value with a stray newline in it. A long anon key pasted into
 * a web form is the usual culprit: it wraps, and the wrap comes along for the
 * ride.
 *
 * That newline is not cosmetic. `supabase-js` puts the key straight into an
 * HTTP header, and the Fetch `Headers` API rejects any value containing a line
 * break with `Failed to execute 'set' on 'Headers': Invalid value` — an error
 * that names nothing useful and looks like a network fault, when the key is
 * simply mis-pasted.
 *
 * Neither a Supabase URL nor a JWT can legitimately contain whitespace, so
 * stripping it is always safe and always what the person meant. We strip, then
 * say in the console that we had to.
 */
const clean = (value: string | undefined): string =>
  (value ?? '')
    .replace(/\s+/g, '')
    // A value pasted from a .env file or a shell sometimes brings its quotes.
    .replace(/^["']+|["']+$/g, '');

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const url = clean(rawUrl);
const anonKey = clean(rawKey);

const urlWasCleaned = Boolean(rawUrl) && rawUrl !== url;
const keyWasCleaned = Boolean(rawKey) && rawKey !== anonKey;

/** A Supabase project URL: https://<ref>.supabase.co */
const looksLikeUrl = /^https?:\/\/[^/]+\.[^/]+/.test(url);

/**
 * Supabase has issued keys in more than one shape: the long `eyJ…` JWT, and the
 * newer `sb_publishable_…` / `sb_secret_…` format. This recognises both — but it
 * is used only to *warn*, never to block.
 *
 * Refusing to start on an unrecognised key shape would mean a future key format
 * bricks the app for a reason that is entirely our own invention. Only the
 * server can truly say whether a key is valid, so anything non-empty is passed
 * through and the server's own answer is reported if it rejects it.
 */
const looksLikeKnownKey =
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey) || /^sb_[a-z]+_[A-Za-z0-9_-]+$/.test(anonKey);

/**
 * False only when this deployment *cannot* talk to Supabase — a missing value,
 * or a URL that is not a URL. An unfamiliar key shape is not disqualifying.
 */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey) && looksLikeUrl;

/**
 * A safe fingerprint of a value, for diagnosing a mis-paste without ever
 * printing a credential: enough to spot truncation, a wrapping quote, or the
 * wrong value entirely, and nothing more.
 */
const fingerprint = (value: string): string =>
  value.length === 0
    ? '(empty)'
    : `${value.length} chars, starts "${value.slice(0, 6)}", ends "${value.slice(-4)}"`;

const WHERE_TO_SET =
  'Set them in .env.local for local development, or in your hosting provider ' +
  '(Vercel → Settings → Environment Variables) followed by a redeploy — Vite reads ' +
  'VITE_ variables at build time, so an existing build will not pick them up. See SETUP.md.';

function describeProblem(): string {
  if (!url && !anonKey) {
    return `VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are both missing. ${WHERE_TO_SET}`;
  }
  if (!url) return `VITE_SUPABASE_URL is missing. ${WHERE_TO_SET}`;
  if (!anonKey) return `VITE_SUPABASE_ANON_KEY is missing. ${WHERE_TO_SET}`;
  if (!looksLikeUrl) {
    return (
      'VITE_SUPABASE_URL does not look like a Supabase project URL. It should be ' +
      'https://<your-project-ref>.supabase.co with no quotes and no trailing slash. ' +
      `Received: ${fingerprint(url)}.`
    );
  }
  return '';
}

export const SUPABASE_CONFIG_ERROR = isSupabaseConfigured
  ? ''
  : `Supabase is not configured for this deployment. ${describeProblem()}`;

if (urlWasCleaned || keyWasCleaned) {
  const which = [urlWasCleaned && 'VITE_SUPABASE_URL', keyWasCleaned && 'VITE_SUPABASE_ANON_KEY']
    .filter(Boolean)
    .join(' and ');
  console.warn(
    `[supabase] Removed stray whitespace, line breaks or quotes from ${which}. The app will work, ` +
      'but tidy the value where it is set — a wrapped paste is the usual cause.'
  );
}

if (isSupabaseConfigured && !looksLikeKnownKey) {
  // Not fatal — the server decides — but almost always a mis-paste, so say so
  // where a developer will see it, with enough detail to spot the problem.
  console.warn(
    '[supabase] VITE_SUPABASE_ANON_KEY is not in a shape this app recognises ' +
      '(neither an "eyJ…" JWT nor an "sb_publishable_…" key). Proceeding anyway — if requests ' +
      `fail, check the value. Received: ${fingerprint(anonKey)}.`
  );
}

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
 * Falling back to a syntactically valid placeholder keeps the import
 * side-effect-free. Requests against it fail, but they fail *inside* the app,
 * where `isSupabaseConfigured` turns them into the data banner's plain-English
 * explanation of exactly which value is wrong and where to correct it.
 */
const PLACEHOLDER_URL = 'https://unconfigured.supabase.co';
const PLACEHOLDER_KEY = 'unconfigured';

export const supabase = createClient(
  isSupabaseConfigured ? url : PLACEHOLDER_URL,
  isSupabaseConfigured ? anonKey : PLACEHOLDER_KEY,
  isSupabaseConfigured
    ? undefined
    : {
        // Nothing can succeed without valid credentials; don't leave a websocket
        // retrying forever behind a screen that has already said why.
        realtime: { params: { eventsPerSecond: 1 } },
      }
);
