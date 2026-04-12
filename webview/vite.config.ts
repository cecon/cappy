import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the Cappy webview package.
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../extension/out/webview",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
