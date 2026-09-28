/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CALENDAR_API_URL?: string;
  readonly VITE_ADMIN_API_TOKEN?: string;
  readonly VITE_OWNER_EMAIL?: string;
  readonly VITE_OWNER_PASSWORD?: string;
  /** "1" popula o painel inteiro com o mundo de teste, sem tocar na API. */
  readonly VITE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}