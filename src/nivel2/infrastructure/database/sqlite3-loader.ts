/**
 * Smart SQLite3 loader with fallback mechanism
 * 
 * This module tries to load the most appropriate sqlite3 implementation:
 * 1. @vscode/sqlite3 - VS Code's bundled version (most reliable)
 * 2. sqlite3 - Standard npm package (fallback)
 * 
 * This ensures the extension works across different platforms and build scenarios.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import type * as SQLite3 from 'sqlite3';

function loadSQLite3(): typeof SQLite3 {
  // Try @vscode/sqlite3 first (VS Code's bundled version)
  try {
    const module = require('@vscode/sqlite3') as typeof SQLite3;
    console.log('✅ Using @vscode/sqlite3 (VS Code bundled version)');
    return module;
  } catch {
    console.log('⚠️  @vscode/sqlite3 not available, trying standard sqlite3...');
  }

  // Fallback to standard sqlite3
  try {
    const module = require('sqlite3') as typeof SQLite3;
    console.log('✅ Using sqlite3 (standard npm package)');
    return module;
  } catch (error) {
    console.error('❌ Failed to load sqlite3:', error);
    throw new Error(
      'Failed to load sqlite3. Please ensure sqlite3 or @vscode/sqlite3 is installed.\n' +
      'Run: npm install sqlite3 @vscode/sqlite3'
    );
  }
}

// Export the loaded module
export default loadSQLite3();
