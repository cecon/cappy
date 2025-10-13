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
        '**/__tests__/**',
      ],
    },
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'out', 'dist'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
