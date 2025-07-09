/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TRANSLATION_API_URL: string
  readonly VITE_STT_API_URL: string
  readonly VITE_TTS_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}