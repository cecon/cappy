/**
 * @fileoverview Cappy VS Code Extension - Main Entry Point
 * @module extension
 * @description
 * Main entry point for the Cappy extension. This file is kept minimal and
 * delegates initialization to the ExtensionBootstrap module, following
 * hexagonal architecture principles.
 * 
 * Architecture Overview:
 * - ExtensionBootstrap: Main orchestrator
 * - LanguageModelToolsBootstrap: GitHub Copilot integration
 * - ViewsBootstrap: Webviews and panels
 * - CommandsBootstrap: VS Code commands
 * - FileProcessingSystemBootstrap: File indexing and processing
 */

import * as vscode from 'vscode';
import { ExtensionBootstrap } from './nivel1/adapters/vscode/bootstrap';

// Global bootstrap instance
let bootstrap: ExtensionBootstrap;

/**
 * Activates the Cappy extension
 * 
 * This is the main entry point called by VS Code when the extension is activated.
 * Delegates all initialization logic to ExtensionBootstrap.
 * 
 * @param context - VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    bootstrap = new ExtensionBootstrap();
    await bootstrap.activate(context);
}

/**
 * Deactivates the Cappy extension
 * 
 * Called by VS Code when the extension is deactivated.
 * Cleans up resources and stops background processes.
 */
export async function deactivate(): Promise<void> {
    if (bootstrap) {
        await bootstrap.deactivate();
    }
}
