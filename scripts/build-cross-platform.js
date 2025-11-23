#!/usr/bin/env node
/**
 * Cross-platform build script for Cappy extension
 * 
 * This script builds VSIX packages for multiple platforms from any host OS.
 * It handles native dependencies (sqlite3, sharp) correctly for each target platform.
 * 
 * Usage:
 *   node scripts/build-cross-platform.js                    # Build for current platform only
 *   node scripts/build-cross-platform.js --all              # Build for all platforms
 *   node scripts/build-cross-platform.js win32-x64 darwin-arm64  # Build specific targets
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// All supported targets
const ALL_TARGETS = [
  'win32-x64',
  'darwin-x64',
  'darwin-arm64', 
  'linux-x64',
  'linux-arm64'
];

const args = process.argv.slice(2);
let targets = [];

if (args.includes('--all')) {
  targets = ALL_TARGETS;
} else if (args.length > 0 && !args[0].startsWith('--')) {
  targets = args.filter(arg => ALL_TARGETS.includes(arg));
} else {
  const currentTarget = process.platform + '-' + process.arch;
  targets = ALL_TARGETS.includes(currentTarget) ? [currentTarget] : ALL_TARGETS;
}

console.log('\n🚀 Cappy Cross-Platform Build');
console.log('================================');
console.log('📋 Targets:', targets.join(', '), '\n');

const rootDir = path.join(__dirname, '..');

function exec(command, options = {}) {
  try {
    execSync(command, { cwd: rootDir, stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    throw error;
  }
}

function backupAndRestoreNativeModules(callback) {
  const nodeModulesPath = path.join(rootDir, 'node_modules');
  const backupPath = path.join(rootDir, 'node_modules_backup');
  
  // List of native modules to backup/restore
  const nativeModules = [
    'sqlite3',
    '@vscode/sqlite3', 
    'sharp',
    '@img'  // Sharp platform packages
  ];
  
  console.log('💾 Backing up native modules...');
  
  // Create backup directory
  if (fs.existsSync(backupPath)) {
    fs.rmSync(backupPath, { recursive: true, force: true });
  }
  fs.mkdirSync(backupPath, { recursive: true });
  
  // Backup each native module
  for (const module of nativeModules) {
    const sourcePath = path.join(nodeModulesPath, module);
    const targetPath = path.join(backupPath, module);
    
    if (fs.existsSync(sourcePath)) {
      console.log(`  📦 Backing up ${module}...`);
      fs.cpSync(sourcePath, targetPath, { recursive: true });
    }
  }
  
  try {
    // Execute the callback
    callback();
  } finally {
    console.log('🔄 Restoring native modules...');
    
    // Restore each native module
    for (const module of nativeModules) {
      const sourcePath = path.join(backupPath, module);
      const targetPath = path.join(nodeModulesPath, module);
      
      if (fs.existsSync(sourcePath)) {
        console.log(`  📦 Restoring ${module}...`);
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.cpSync(sourcePath, targetPath, { recursive: true });
      }
    }
    
    // Clean up backup
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }
  }
}

// Build once
console.log('🔨 Building extension...\n');

backupAndRestoreNativeModules(() => {
  // Main build
  exec('npm run build');
  exec('npm run compile-extension');
  
  // Build packages for each target
  let successCount = 0;
  let errorCount = 0;
  
  for (const target of targets) {
    console.log(`\n📦 Building for ${target}...`);
    console.log('='.repeat(50));
    
    try {
      // Clean native modules for fresh rebuild
      exec('npm run clean:native');
      
      // Rebuild native modules for target platform
      console.log(`🔧 Rebuilding native modules for ${target}...`);
      exec('npm run rebuild:native');
      
      // Package for specific target
      exec(`node scripts/package-platform.js ${target}`);
      
      successCount++;
      console.log(`✅ ${target} build completed successfully`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ ${target} build failed:`, error.message);
      
      // Continue with other targets
      continue;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Build Summary');
  console.log('='.repeat(50));
  console.log(`✅ Successful builds: ${successCount}`);
  console.log(`❌ Failed builds: ${errorCount}`);
  console.log(`📋 Total targets: ${targets.length}`);
  
  if (successCount > 0) {
    console.log('\n📁 Generated packages:');
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const version = packageJson.version;
    
    for (const target of targets) {
      const vsixName = `cappy-${version}-${target}.vsix`;
      const vsixPath = path.join(rootDir, vsixName);
      
      if (fs.existsSync(vsixPath)) {
        console.log(`  📦 ${vsixName}`);
      }
    }
    
    console.log('\n🚀 To install any package:');
    console.log('  code --install-extension <package-name>.vsix --force');
  }
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some builds failed. Check the logs above for details.');
    process.exit(1);
  } else {
    console.log('\n🎉 All builds completed successfully!');
  }
});
exec('npm run build');
exec('npm run compile-extension');

// Package for each target
const packages = [];
for (const target of targets) {
  console.log('\n📦 Packaging for', target, '...');
  try {
    exec('node scripts/package-platform.js ' + target);
    const version = require('../package.json').version;
    packages.push('cappy-' + version + '-' + target + '.vsix');
  } catch (error) {
    console.error('❌ Failed for', target);
  }
}

console.log('\n✅ Build Complete!');
console.log('📦 Packages:', packages.join(', '), '\n');
