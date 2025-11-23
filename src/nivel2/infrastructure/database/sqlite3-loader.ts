/**
 * Smart SQLite3 loader with robust fallback mechanism
 * 
 * This module tries to load the most appropriate sqlite3 implementation:
 * 1. @vscode/sqlite3 - VS Code's bundled version (most reliable)
 * 2. sqlite3 - Standard npm package (fallback)
 * 3. Runtime architecture detection and error recovery
 * 
 * This ensures the extension works across different platforms and build scenarios.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import type * as SQLite3 from 'sqlite3';
import * as os from 'os';

let cachedModule: typeof SQLite3 | null = null;

function detectPlatformInfo() {
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

function logPlatformInfo() {
  const info = detectPlatformInfo();
  console.log(`📊 Platform Info: ${info.platformArch}, Node: ${info.nodeVersion}${info.electronVersion ? `, Electron: ${info.electronVersion}` : ''}`);
}

function loadSQLite3(): typeof SQLite3 {
  // Return cached module if available
  if (cachedModule) {
    return cachedModule;
  }

  logPlatformInfo();

  // Try @vscode/sqlite3 first (VS Code's bundled version)
  try {
    const module = require('@vscode/sqlite3') as typeof SQLite3;
    console.log('✅ Using @vscode/sqlite3 (VS Code bundled version)');
    cachedModule = module;
    return module;
  } catch (error) {
    console.log('⚠️  @vscode/sqlite3 not available:', error instanceof Error ? error.message : String(error));
  }

  // Try standard sqlite3 with better error handling
  try {
    const module = require('sqlite3') as typeof SQLite3;
    console.log('✅ Using sqlite3 (standard npm package)');
    cachedModule = module;
    return module;
  } catch (error) {
    const info = detectPlatformInfo();
    console.error('❌ Failed to load sqlite3:', error);
    
    // More specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes('not a valid Win32 application')) {
        throw new Error(
          `SQLite3 architecture mismatch detected!\n` +
          `Platform: ${info.platformArch}\n` +
          `This usually happens when sqlite3 was compiled for a different architecture.\n\n` +
          `To fix this:\n` +
          `1. Delete node_modules and package-lock.json\n` +
          `2. Run: npm install --rebuild\n` +
          `3. Or run: npm run rebuild:sqlite3\n\n` +
          `For development: npm install sqlite3 @vscode/sqlite3 --save-optional`
        );
      } else if (error.message.includes('Cannot find module')) {
        throw new Error(
          `SQLite3 module not found!\n` +
          `Platform: ${info.platformArch}\n\n` +
          `To install:\n` +
          `npm install sqlite3 @vscode/sqlite3\n\n` +
          `For VS Code extension development:\n` +
          `npm install @vscode/sqlite3 --save-optional`
        );
      }
    }
    
    throw new Error(
      `Failed to load sqlite3 on ${info.platformArch}.\n` +
      `Original error: ${error instanceof Error ? error.message : String(error)}\n\n` +
      `Try:\n` +
      `1. npm install sqlite3 @vscode/sqlite3\n` +
      `2. npm run rebuild:sqlite3\n` +
      `3. Delete node_modules and reinstall dependencies`
    );
  }
}

// Export the loaded module with error handling
let moduleInstance: typeof SQLite3;

try {
  moduleInstance = loadSQLite3();
} catch (error) {
  console.error('🚨 SQLite3 loading failed during module initialization:', error);
  // Export a dummy module that will throw when used
  moduleInstance = new Proxy({} as typeof SQLite3, {
    get() {
      throw error;
    }
  });
}

export default moduleInstance;
