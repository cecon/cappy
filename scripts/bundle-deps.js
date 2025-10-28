/**
 * Bundle only required dependencies for the extension
 * This avoids including platform-specific binaries that cause npm list errors
 */

const fs = require('fs');
const path = require('path');

// List of required dependencies
const requiredDeps = [
  'sql.js',
  '@xenova/transformers',
  '@lancedb/lancedb',
  '@langchain/core',
  '@langchain/langgraph',
  'yaml',
  'gray-matter',
  'ignore',
  'mammoth',
  'pdf-parse',
  // Add transitive dependencies as needed
];

const nodeModulesSource = path.join(__dirname, '..', 'node_modules');
const bundleTarget = path.join(__dirname, '..', 'bundle', 'node_modules');

console.log('📦 Bundling required dependencies...');

// Create bundle directory
fs.mkdirSync(bundleTarget, { recursive: true });

// Copy each required dependency
for (const dep of requiredDeps) {
  const sourcePath = path.join(nodeModulesSource, dep);
  const targetPath = path.join(bundleTarget, dep);
  
  if (fs.existsSync(sourcePath)) {
    console.log(`  Copying ${dep}...`);
    copyDirectory(sourcePath, targetPath);
  } else {
    console.warn(`  ⚠️ ${dep} not found in node_modules`);
  }
}

console.log('✅ Dependencies bundled successfully');

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  
  const files = fs.readdirSync(source);
  
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}
