/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PATIENT_VAULT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
