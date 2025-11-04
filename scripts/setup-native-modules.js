#!/usr/bin/env node
/**
 * Setup script for native modules (SQLite3, Sharp) 
 * Diagnoses and fixes common issues with native module compilation
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const os = require('node:os');

function log(message, level = 'info') {
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
    debug: '🔍'
  };
  console.log(`${prefix[level]} ${message}`);
}

function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      output: error.stdout || error.stderr || ''
    };
  }
}

function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();
  const nodeVersion = process.version;
  const electronVersion = process.versions.electron;
  
  return {
    platform,
    arch,
    nodeVersion,
    electronVersion,
    isElectron: !!electronVersion,
    platformArch: `${platform}-${arch}`
  };
}

function checkNodeGyp() {
  log('Checking node-gyp installation...');
  
  const result = exec('npm list -g node-gyp', { silent: true });
  if (!result.success) {
    log('node-gyp not found globally. Installing...', 'warning');
    const installResult = exec('npm install -g node-gyp');
    if (!installResult.success) {
      log('Failed to install node-gyp globally. You might need admin privileges.', 'error');
      return false;
    }
  }
  
  log('node-gyp is available', 'success');
  return true;
}

function checkBuildTools() {
  const info = detectPlatform();
  
  log('Checking build tools...');
  
  if (info.platform === 'win32') {
    log('On Windows, checking for Visual Studio Build Tools...');
    
    // Check for common VS installations
    const vsPaths = [
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools',
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Community',
      'C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\Professional',
      'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools',
      'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community',
      'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional'
    ];
    
    const hasVS = vsPaths.some(vsPath => fs.existsSync(vsPath));
    
    if (!hasVS) {
      log('Visual Studio Build Tools not detected. You may need to install them:', 'warning');
      log('  https://visualstudio.microsoft.com/visual-cpp-build-tools/');
      log('  Or run: npm install --global --production windows-build-tools');
    } else {
      log('Visual Studio Build Tools detected', 'success');
    }
  } else if (info.platform === 'darwin') {
    log('On macOS, checking for Xcode Command Line Tools...');
    const result = exec('xcode-select --print-path', { silent: true });
    if (!result.success) {
      log('Xcode Command Line Tools not found. Installing...', 'warning');
      log('Run: xcode-select --install');
    } else {
      log('Xcode Command Line Tools detected', 'success');
    }
  } else {
    log('On Linux, checking for build essentials...');
    const result = exec('which gcc', { silent: true });
    if (!result.success) {
      log('GCC not found. Install build essentials:', 'warning');
      log('  Ubuntu/Debian: sudo apt-get install build-essential');
      log('  CentOS/RHEL: sudo yum groupinstall "Development Tools"');
    } else {
      log('Build tools detected', 'success');
    }
  }
}

function cleanNativeModules() {
  log('Cleaning native modules...');
  
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  const modulesToClean = [
    'sqlite3/build',
    '@vscode/sqlite3/build', 
    'sharp/build',
    'sharp/vendor'
  ];
  
  for (const modulePath of modulesToClean) {
    const fullPath = path.join(nodeModulesPath, modulePath);
    if (fs.existsSync(fullPath)) {
      log(`  Removing ${modulePath}...`);
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }
  
  log('Native modules cleaned', 'success');
}

function testSQLiteLoad() {
  log('Testing SQLite3 loading...');
  
  try {
    // Try VS Code version first
    try {
      require('@vscode/sqlite3');
      log('@vscode/sqlite3 loaded successfully', 'success');
      return true;
    } catch {
      log('@vscode/sqlite3 not available, trying standard sqlite3...', 'debug');
    }
    
    // Try standard version
    try {
      require('sqlite3');
      log('sqlite3 loaded successfully', 'success');
      return true;
    } catch (error) {
      log(`Failed to load sqlite3: ${error.message}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Unexpected error testing SQLite3: ${error.message}`, 'error');
    return false;
  }
}

function rebuildNativeModules() {
  log('Rebuilding native modules...');
  
  const modules = ['sqlite3', '@vscode/sqlite3', 'sharp'];
  
  for (const module of modules) {
    log(`Rebuilding ${module}...`);
    const result = exec(`npm rebuild ${module}`, { silent: true });
    
    if (result.success) {
      log(`${module} rebuilt successfully`, 'success');
    } else {
      log(`${module} rebuild failed (this might be OK for optional dependencies)`, 'warning');
    }
  }
}

function main() {
  const info = detectPlatform();
  
  console.log('\n🔧 Cappy Native Modules Setup');
  console.log('================================');
  log(`Platform: ${info.platformArch}`);
  log(`Node.js: ${info.nodeVersion}`);
  if (info.electronVersion) {
    log(`Electron: ${info.electronVersion}`);
  }
  console.log('');
  
  // Check prerequisites
  checkBuildTools();
  checkNodeGyp();
  
  console.log('');
  
  // Clean and rebuild
  cleanNativeModules();
  rebuildNativeModules();
  
  console.log('');
  
  // Test loading
  const sqliteWorks = testSQLiteLoad();
  
  console.log('\n📊 Setup Summary');
  console.log('=================');
  log(`SQLite3: ${sqliteWorks ? 'Working' : 'Failed'}`, sqliteWorks ? 'success' : 'error');
  
  if (!sqliteWorks) {
    console.log('\n🚨 Setup Issues Detected');
    console.log('=========================');
    log('SQLite3 loading failed. Try these solutions:', 'error');
    log('1. Delete node_modules and package-lock.json, then run npm install');
    log('2. Install dependencies: npm install sqlite3 @vscode/sqlite3');
    log('3. Check build tools are installed (see messages above)');
    log('4. For VS Code extensions, @vscode/sqlite3 should work even if sqlite3 fails');
    
    process.exit(1);
  }
  
  console.log('\n🎉 Setup completed successfully!');
  log('All native modules are working correctly.');
}

if (require.main === module) {
  main();
}

module.exports = {
  detectPlatform,
  checkBuildTools,
  cleanNativeModules,
  rebuildNativeModules,
  testSQLiteLoad
};