/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGNES_API_KEY: string
  /** API 根路径，见 .env.development / .env.production */
  readonly VITE_AGNES_API_BASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
