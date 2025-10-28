/**
 * @fileoverview Tests for Vite configuration parser
 * @module adapters/secondary/parsers/__tests__/vite-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createViteParser } from '@/nivel2/infrastructure/parsers/vite-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ViteParser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-parser-test-'));
  });

  describe('parseFile', () => {
    it('should extract plugins configuration', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react()
  ]
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const pluginChunk = chunks.find(c => c.metadata.configKind === 'plugin');
      expect(pluginChunk).toBeDefined();
    });

    it('should extract server configuration', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
export default defineConfig({
  server: {
    port: 3000,
    host: 'localhost'
  }
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const serverChunk = chunks.find(c => c.metadata.configKind === 'server');
      expect(serverChunk).toBeDefined();
      expect(serverChunk?.content).toContain('Server configuration');
    });

    it('should extract resolve.alias configuration', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
export default defineConfig({
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components'
    }
  }
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const aliasChunk = chunks.find(c => c.metadata.configKind === 'alias');
      expect(aliasChunk).toBeDefined();
      expect(aliasChunk?.content).toContain('Path aliases');
    });

    it('should extract build configuration', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const buildChunk = chunks.find(c => c.metadata.configKind === 'build');
      expect(buildChunk).toBeDefined();
      expect(buildChunk?.content).toContain('Build configuration');
    });

    it('should extract define (environment variables)', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __APP_VERSION__: JSON.stringify('1.0.0')
  }
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const defineChunk = chunks.find(c => c.metadata.configKind === 'define');
      expect(defineChunk).toBeDefined();
      expect(defineChunk?.content).toContain('Environment definitions');
    });

    it('should extract JSDoc comments', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
/**
 * Vite configuration for production
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  mode: 'production'
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const jsdocChunk = chunks.find(c => c.metadata.configKind === 'jsdoc');
      expect(jsdocChunk).toBeDefined();
      expect(jsdocChunk?.content).toContain('Vite configuration for production');
    });

    it('should extract single-line comments', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
export default defineConfig({
  // Enable source maps for debugging
  build: {
    sourcemap: true
  }
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const commentChunk = chunks.find(c => 
        c.metadata.configKind === 'comment' && 
        c.content.includes('Enable source maps')
      );
      expect(commentChunk).toBeDefined();
    });

    it('should extract multi-line comments', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
/*
  Production build configuration
  Optimized for performance
*/
export default defineConfig({
  mode: 'production'
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      const commentChunk = chunks.find(c => 
        c.metadata.configKind === 'comment' && 
        c.content.includes('Production build configuration')
      );
      expect(commentChunk).toBeDefined();
    });

    it('should handle JSDoc with configuration', async () => {
      const parser = createViteParser();
      const testFile = path.join(tempDir, 'vite.config.ts');
      
      fs.writeFileSync(testFile, `
/**
 * React plugin configuration
 */
export default defineConfig({
  plugins: [
    react()
  ]
});
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      // Should have JSDoc chunk
      const jsdocChunk = chunks.find(c => c.metadata.configKind === 'jsdoc');
      expect(jsdocChunk).toBeDefined();
    });

    it('should return empty array for non-existent files', async () => {
      const parser = createViteParser();
      const nonExistentFile = path.join(tempDir, 'does-not-exist.config.ts');
      
      const chunks = await parser.parseFile(nonExistentFile);
      
      expect(chunks).toEqual([]);
    });
  });
});
