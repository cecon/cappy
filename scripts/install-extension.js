#!/usr/bin/env node
/**
 * Automatic platform detection and extension installation
 * Detects the current platform and installs the appropriate VSIX package
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
    error: '❌'
  };
  console.log(`${prefix[level]} ${message}`);
}

function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();
  
  // Map Node.js arch names to VS Code target names
  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'ia32',
    arm: 'arm'
  };
  
  const mappedArch = archMap[arch] || arch;
  
  return {
    platform,
    arch: mappedArch,
    target: `${platform}-${mappedArch}`
  };
}

function getPackageVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.version;
}

function findVsixFile(target, version) {
  const rootDir = path.join(__dirname, '..');
  const expectedName = `cappy-${version}-${target}.vsix`;
  const vsixPath = path.join(rootDir, expectedName);
  
  if (fs.existsSync(vsixPath)) {
    return vsixPath;
  }
  
  // Look for any VSIX files if exact match not found
  const files = fs.readdirSync(rootDir);
  const vsixFiles = files.filter(file => file.endsWith('.vsix') && file.startsWith('cappy-'));
  
  if (vsixFiles.length > 0) {
    log(`Exact match not found, available packages: ${vsixFiles.join(', ')}`, 'warning');
    return path.join(rootDir, vsixFiles[0]);
  }
  
  return null;
}

function buildPackage(target) {
  log(`Building package for ${target}...`);
  
  try {
    const command = target.startsWith('win32') ? 'npm run package:win32' :
                   target.startsWith('darwin') ? 'npm run package:darwin' :
                   target.startsWith('linux') ? 'npm run package:linux' :
                   'npm run package';
    
    execSync(command, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    return true;
  } catch (error) {
    log(`Failed to build package: ${error.message}`, 'error');
    return false;
  }
}

function installExtension(vsixPath) {
  log(`Installing extension: ${path.basename(vsixPath)}`);
  
  try {
    execSync(`code --install-extension "${vsixPath}" --force`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    return true;
  } catch (error) {
    log(`Failed to install extension: ${error.message}`, 'error');
    return false;
  }
}

function main() {
  console.log('\n🚀 Cappy Auto-Install');
  console.log('=====================');
  
  const platformInfo = detectPlatform();
  const version = getPackageVersion();
  
  log(`Detected platform: ${platformInfo.target}`);
  log(`Extension version: ${version}`);
  
  // Try to find existing VSIX
  let vsixPath = findVsixFile(platformInfo.target, version);
  
  if (!vsixPath) {
    log('Package not found, building...', 'warning');
    
    const buildSuccess = buildPackage(platformInfo.target);
    if (!buildSuccess) {
      log('Failed to build package. Please build manually:', 'error');
      log(`npm run package:${platformInfo.platform}`);
      process.exit(1);
    }
    
    // Try to find the VSIX again after building
    vsixPath = findVsixFile(platformInfo.target, version);
    
    if (!vsixPath) {
      log('Package still not found after building', 'error');
      process.exit(1);
    }
  }
  
  log(`Found package: ${path.basename(vsixPath)}`, 'success');
  
  // Install the extension
  const installSuccess = installExtension(vsixPath);
  
  if (installSuccess) {
    console.log('\n🎉 Installation completed successfully!');
    log('Extension installed and ready to use.');
    log('Restart VS Code to activate the extension.');
  } else {
    console.log('\n❌ Installation failed');
    log('Please install manually:', 'error');
    log(`code --install-extension "${vsixPath}" --force`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  detectPlatform,
  getPackageVersion,
  findVsixFile,
  buildPackage,
  installExtension
};