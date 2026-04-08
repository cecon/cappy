import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the Cappy webview package.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
