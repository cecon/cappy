import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// import { cappyDevServerPlugin } from './vite-plugin-cappy-dev'

// https://vitejs.dev/config/
export default defineConfig(() => ({
  plugins: [
    react(),
  ],
  
  // Build configuration for VS Code extension
  build: {
    outDir: 'out',
    rollupOptions: {
      input: {
        // Main React app entry point (Chat View)
        main: path.resolve(import.meta.dirname, 'index.html'),
        // Graph WebView entry point
        graph: path.resolve(import.meta.dirname, 'graph.html'),
        // Development dashboard
        dev: path.resolve(import.meta.dirname, 'dev.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    target: 'es2020',
    minify: 'esbuild' as const,
    // Important: use relative paths for VS Code webview
    assetsInlineLimit: 0,
    cssCodeSplit: true
  },
  
  // Use relative base for webview compatibility
  base: './',
  
  // Development server configuration
  server: {
    port: 6007,
    open: '/dev.html', // Open dashboard on dev server start
    cors: true,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
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
}))
