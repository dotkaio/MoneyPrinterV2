import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  root: resolve(import.meta.dirname, "src/interface/web"),
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_DEPLOY_TARGET": JSON.stringify(
      mode === "web" ? "web" : "desktop",
    ),
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src/interface/web"),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist/interface-web"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 4318,
    proxy: {
      "/api": "http://127.0.0.1:4317",
    },
  },
}));
