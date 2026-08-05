import { createClient } from '@supabase/supabase-js';

/**
 * The browser Supabase client.
 *
 * Supabase owns credentials entirely: it is the only party that ever sees a raw
 * password, and it issues the access token every request to our own backend
 * carries. Our backend verifies that token and never mints one of its own.
 *
 * Only the project URL and the anon key are read here. The anon key is designed
 * to be public — it grants exactly what row-level security and Auth allow an
 * anonymous caller. The service role key bypasses row-level security entirely
 * and must never be read by this file or any other in this repository, because
 * Vite inlines every VITE_ variable into the shipped bundle.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Failing at module load is louder than a stream of confusing 401s: without
  // these two values there is no session to be had, so there is no degraded
  // mode worth limping along in.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill both in.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Supabase handles rotation and expiry; we never implement refresh logic.
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** The current access token, or `null` when there is no session. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
