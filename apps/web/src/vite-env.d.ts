interface ImportMetaEnv {
  readonly VITE_LIST_URL?: string
  readonly VITE_TURNSTILE_SITE_KEY?: string
  readonly VITE_CALLER_ORIGINS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
