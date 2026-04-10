/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Porta do cli-mock em dev; definida em `vite.config.ts` a partir de `CAPPY_CLI_MOCK_PORT`. */
  readonly VITE_CAPPY_CLI_MOCK_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
