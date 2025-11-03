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

function exec(command) {
  execSync(command, { cwd: rootDir, stdio: 'inherit' });
}

// Build once
console.log('🔨 Building extension...\n');
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
