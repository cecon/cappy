/**
 * Debug command to test if commands are registered
 */
import * as vscode from 'vscode';

export function registerDebugCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('cappy.debug', async () => {
    console.log('🐛 Debug command executed');
    
    // Test if processSingleFileInternal is registered
    try {
      const commands = await vscode.commands.getCommands(true);
      const cappyCommands = commands.filter(cmd => cmd.startsWith('cappy.'));
      
      console.log('📋 All Cappy commands registered:', cappyCommands);
      
      vscode.window.showInformationMessage(
        `Found ${cappyCommands.length} Cappy commands:\n${cappyCommands.join('\n')}`,
        { modal: true }
      );
    } catch (error) {
      console.error('❌ Error getting commands:', error);
      vscode.window.showErrorMessage(`Error: ${error}`);
    }
  });
  
  context.subscriptions.push(command);
  console.log('✅ Debug command registered: cappy.debug');
}
