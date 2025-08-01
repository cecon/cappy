import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('🔨 FORGE Framework: Full activation started');
    
    // Show immediate activation message
    vscode.window.showInformationMessage('🔨 FORGE Framework: All commands activated!');

    // Register test command (known working)
    const testCommand = vscode.commands.registerCommand('forge.test', async () => {
        vscode.window.showInformationMessage('🔨 FORGE Framework: Test command still working! 🎉');
        console.log('🔨 FORGE Framework: Test command executed at', new Date().toISOString());
    });

    // Register init command (safe version)
    const initCommand = vscode.commands.registerCommand('forge.init', async () => {
        try {
            vscode.window.showInformationMessage('🔨 FORGE Init: Starting initialization...');
            
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('FORGE: No workspace folder is open. Please open a folder first.');
                return;
            }
            
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            console.log('🔨 FORGE Init: Workspace root:', workspaceRoot);
            
            // TODO: Add actual initialization logic here
            vscode.window.showInformationMessage('🔨 FORGE: Basic initialization completed! (Full implementation coming soon)');
        } catch (error) {
            console.error('FORGE Init error:', error);
            vscode.window.showErrorMessage(`FORGE Init failed: ${error}`);
        }
    });

    // Register createTask command (placeholder)
    const createTaskCommand = vscode.commands.registerCommand('forge.createTask', async () => {
        try {
            vscode.window.showInformationMessage('🔨 FORGE: Create Task command called!');
            
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('FORGE: No workspace folder is open. Please open a folder first.');
                return;
            }
            
            // TODO: Add actual task creation logic here
            vscode.window.showInformationMessage('🔨 FORGE: Task creation placeholder executed! (Full implementation coming soon)');
        } catch (error) {
            console.error('FORGE CreateTask error:', error);
            vscode.window.showErrorMessage(`FORGE CreateTask failed: ${error}`);
        }
    });

    // Register createSmartTask command (placeholder)
    const createSmartTaskCommand = vscode.commands.registerCommand('forge.createSmartTask', async () => {
        try {
            vscode.window.showInformationMessage('🔨 FORGE: Create Smart Task command called!');
            
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('FORGE: No workspace folder is open. Please open a folder first.');
                return;
            }
            
            // TODO: Add actual smart task creation logic here
            vscode.window.showInformationMessage('🔨 FORGE: Smart task creation placeholder executed! (Full implementation coming soon)');
        } catch (error) {
            console.error('FORGE CreateSmartTask error:', error);
            vscode.window.showErrorMessage(`FORGE CreateSmartTask failed: ${error}`);
        }
    });

    // Register addPreventionRule command (placeholder)
    const addPreventionRuleCommand = vscode.commands.registerCommand('forge.addPreventionRule', async () => {
        try {
            vscode.window.showInformationMessage('🔨 FORGE: Add Prevention Rule command called!');
            
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('FORGE: No workspace folder is open. Please open a folder first.');
                return;
            }
            
            // TODO: Add actual prevention rule logic here
            vscode.window.showInformationMessage('🔨 FORGE: Prevention rule placeholder executed! (Full implementation coming soon)');
        } catch (error) {
            console.error('FORGE AddPreventionRule error:', error);
            vscode.window.showErrorMessage(`FORGE AddPreventionRule failed: ${error}`);
        }
    });

    // Register completeTask command (placeholder)
    const completeTaskCommand = vscode.commands.registerCommand('forge.completeTask', async () => {
        try {
            vscode.window.showInformationMessage('🔨 FORGE: Complete Task command called!');
            
            if (!vscode.workspace.workspaceFolders) {
                vscode.window.showErrorMessage('FORGE: No workspace folder is open. Please open a folder first.');
                return;
            }
            
            // TODO: Add actual task completion logic here
            vscode.window.showInformationMessage('🔨 FORGE: Task completion placeholder executed! (Full implementation coming soon)');
        } catch (error) {
            console.error('FORGE CompleteTask error:', error);
            vscode.window.showErrorMessage(`FORGE CompleteTask failed: ${error}`);
        }
    });

    // Register all commands
    context.subscriptions.push(
        testCommand, 
        initCommand, 
        createTaskCommand, 
        createSmartTaskCommand, 
        addPreventionRuleCommand, 
        completeTaskCommand
    );
    
    console.log('🔨 FORGE Framework: All commands registered successfully');
    vscode.window.showInformationMessage('🔨 FORGE Framework: Ready! All 6 commands available.');
}

export function deactivate() {
    console.log('🔨 FORGE Framework: Full deactivation');
}
