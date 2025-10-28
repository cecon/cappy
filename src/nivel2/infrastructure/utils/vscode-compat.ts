/**
 * @fileoverview VS Code compatibility layer
 * @module utils/vscode-compat
 * 
 * This module provides a compatibility layer for VS Code APIs,
 * allowing code to run both inside VS Code and in other environments
 * (like Vite dev server) without throwing import errors.
 */

/**
 * Conditionally loads vscode module if available
 * Returns null if not in VS Code environment
 */
export const vscode = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('vscode');
  } catch {
    return null;
  }
})();

/**
 * Check if running inside VS Code
 */
export const isVSCodeEnvironment = (): boolean => {
  return vscode !== null;
};

/**
 * Type guard to check if vscode is available
 */
export const hasVSCode = (): boolean => {
  return vscode !== null;
};
