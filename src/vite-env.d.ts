/// <reference types="vite/client" />

/**
 * The complete set of environment variables this client may read.
 *
 * Vite inlines every VITE_-prefixed variable into the bundle, so this interface
 * doubles as the list of values we accept shipping to every visitor. The
 * Supabase service role key bypasses row-level security and is deliberately
 * absent — it belongs only to the backend.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Base URL of the Rally backend API, e.g. http://localhost:4000/api/v1 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
