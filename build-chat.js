/**
 * Build script for Cappy Chat React component
 * Bundles React components for VS Code webview consumption
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, 'out', 'components', 'chat-new');

// Ensure output directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Build configuration
esbuild.build({
  entryPoints: [path.join(__dirname, 'src', 'components', 'chat-new', 'chatBundle.tsx')],
  bundle: true,
  outfile: path.join(outDir, 'chatBundle.js'),
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  minify: true,
  sourcemap: true,
  external: ['vscode'],
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'css'
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  // Resolve extensions to prefer .web.ts over .ts for browser builds
  resolveExtensions: ['.web.ts', '.web.tsx', '.tsx', '.ts', '.jsx', '.js', '.css', '.json'],
  // Mark all Node.js built-in modules as external
  plugins: [{
    name: 'node-externals',
    setup(build) {
      const nodeModules = ['child_process', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'http', 'https', 'net', 'tls', 'zlib'];
      nodeModules.forEach(mod => {
        build.onResolve({ filter: new RegExp(`^${mod}$`) }, () => {
          return { path: mod, external: true, namespace: 'node-external' };
        });
      });
      
      // Handle node-external imports by replacing with empty objects
      build.onLoad({ filter: /.*/, namespace: 'node-external' }, () => {
        return { contents: 'module.exports = {}', loader: 'js' };
      });
    }
  }]
}).then(() => {
  console.log('✅ Chat React component built successfully!');
  
  // Copy CSS file
  const cssSource = path.join(__dirname, 'src', 'components', 'chat-new', 'Chat.css');
  const cssDest = path.join(outDir, 'Chat.css');
  
  if (fs.existsSync(cssSource)) {
    fs.copyFileSync(cssSource, cssDest);
    console.log('✅ CSS copied successfully!');
  }
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
