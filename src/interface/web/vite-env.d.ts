/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEPLOY_TARGET: "desktop" | "web";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
