import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'out/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test-*.ts',
        'test/__mocks__/**',
      ],
    },
    include: ['test/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'out', 'dist', 'test/__mocks__'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mock VS Code API during tests to avoid native module resolution
      vscode: path.resolve(__dirname, './test/__mocks__/vscode.ts'),
    },
  },
});
