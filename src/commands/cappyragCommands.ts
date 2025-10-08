import * as vscode from 'vscode';
import { cleanOrphanedDataCommand } from './cappyrag/cleanOrphanedDataCommand';

/**
 * Register all CappyRAG commands with VS Code
 */
export function registerCappyRAGCommands(context: vscode.ExtensionContext): void {
    // Register cleanup command
    const cleanupCommand = vscode.commands.registerCommand(
        'cappy.CappyRAG.cleanOrphanedData',
        () => cleanOrphanedDataCommand(context)
    );
    
    context.subscriptions.push(cleanupCommand);
    
    console.log('CappyRAG commands registered (cleanup)');
}

// Placeholder functions
function registerContextMenuCommands(context: vscode.ExtensionContext): void {
    // Temporarily disabled
}

function registerKeybindings(context: vscode.ExtensionContext): void {
    // Temporarily disabled
}
