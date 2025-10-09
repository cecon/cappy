import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  base: './',
  define: {
    ['process.env.NODE_ENV']: JSON.stringify('production')
  },
  build: {
    outDir: path.resolve(__dirname, '../chat-dist'),
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      formats: ['es'],
      fileName: () => 'chat.js'
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'chat.js',
        chunkFileNames: 'chat-[name].js',
        assetFileNames: (assetInfo: { name?: string }) => {
          if (assetInfo.name === 'style.css') {
            return 'chat.css';
          }
          if (assetInfo.name) {
            return assetInfo.name;
          }
          return 'asset-[hash][extname]';
        }
      }
    }
  }
});
