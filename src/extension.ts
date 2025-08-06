import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('🦫 Capybara Memory: Starting activation...');
    
    try {
        // Show immediate activation message
        vscode.window.showInformationMessage('🦫 Capybara Memory: Activating...');

        // Register test command first (known working)
        const testCommand = vscode.commands.registerCommand('capybara.test', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: Test command working! 🎉');
        });

        // Register init command (full implementation)
        const initCommand = vscode.commands.registerCommand('capybara.init', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Init command called!');
                
                // Load the full init implementation
                try {
                    const initModule = await import('./commands/initCapybara');
                    
                    const initCommand = new initModule.InitCapybaraCommand(context);
                    
                    const success = await initCommand.execute();
                    if (success) {
                        vscode.window.showInformationMessage('🦫 Capybara Memory: Initialization completed successfully!');
                    } else {
                        vscode.window.showWarningMessage('🦫 Capybara Memory: Initialization was cancelled or failed.');
                    }
                } catch (importError) {
                    console.error('Error loading InitCapybaraCommand:', importError);
                    vscode.window.showErrorMessage(`Capybara Memory: Init feature failed to load: ${importError}`);
                }
            } catch (error) {
                console.error('Capybara Memory Init error:', error);
                vscode.window.showErrorMessage(`Capybara Memory Init failed: ${error}`);
            }
        });

        // Register all commands
        context.subscriptions.push(
            testCommand, 
            initCommand
        );
        
        console.log('🦫 Capybara Memory: All commands registered successfully');
        vscode.window.showInformationMessage('🦫 Capybara Memory: Ready! Use "Capybara: Initialize" to set up your project.');
        
    } catch (error) {
        console.error('🦫 Capybara Memory: Activation failed:', error);
        vscode.window.showErrorMessage(`🦫 Capybara Memory activation failed: ${error}`);
    }
}

export function deactivate() {
    console.log('🦫 Capybara Memory: Deactivation');
}
