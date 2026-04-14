import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/bridge/MessageValidators.ts",
        "src/lib/mergeFileDiffs.ts",
        "src/lib/toolRegistry.ts",
        "src/domain/services/MessageService.ts",
        "src/domain/services/ActivityService.ts",
        "src/hooks/useChatReducer.ts",
        "src/domain/entities/ChatState.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
