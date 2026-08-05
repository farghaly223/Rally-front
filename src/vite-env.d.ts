/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Rally backend API, e.g. http://localhost:4000/api/v1 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
