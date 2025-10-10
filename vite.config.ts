import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Build configuration for VS Code extension
  build: {
    outDir: 'out',
    rollupOptions: {
      input: {
        // Main React app entry point for webviews
        main: path.resolve(import.meta.dirname, 'index.html'),
        // Could add more entry points for different webviews
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    target: 'es2020',
    minify: 'esbuild'
  },
  
  // Development server configuration
  server: {
    port: 3000,
    open: false, // Don't auto-open browser
    cors: true
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src')
    }
  },
  
  // Define global constants
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})
