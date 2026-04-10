import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const cappyCliMockPort = process.env.CAPPY_CLI_MOCK_PORT ?? "3333";

/**
 * Vite config for the Cappy webview package.
 */
export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    /** Porta injetada em `vscode-bridge` (WebSocket para o cli-mock em dev). */
    "import.meta.env.VITE_CAPPY_CLI_MOCK_PORT": JSON.stringify(cappyCliMockPort),
  },
  build: {
    outDir: "../extension/out/webview",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
