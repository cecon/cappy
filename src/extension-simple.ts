import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // Show immediate message to confirm activation
    vscode.window.showInformationMessage('🔨 FORGE Framework: Extension activated successfully!');
    
    console.log('🔨 FORGE Framework: Extension activation started');
    
    // Register a simple test command
    const testCommand = vscode.commands.registerCommand('forge.test', () => {
        vscode.window.showInformationMessage('🔨 FORGE Test Command Works!');
    });
    
    // Register the dashboard command
    const dashboardCommand = vscode.commands.registerCommand('forge.openDashboard', () => {
        vscode.window.showInformationMessage('🔨 FORGE Dashboard: Command executed!');
        
        // Create a simple text document as dashboard
        vscode.workspace.openTextDocument({
            content: `# 🔨 FORGE Framework Dashboard

## ✅ Extension Status: ACTIVE

The FORGE extension is working correctly!

### Available Commands:
- FORGE: Test Command
- FORGE: Open Dashboard

### Next Steps:
1. Test other commands
2. Check the Explorer for FORGE panels
3. Create your first task

---
*Dashboard generated on ${new Date().toLocaleString()}*`,
            language: 'markdown'
        }).then(doc => {
            vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.One,
                preview: true
            });
        });
    });
    
    // Add disposables
    context.subscriptions.push(testCommand, dashboardCommand);
    
    console.log('🔨 FORGE Framework: Commands registered successfully');
}

export function deactivate() {
    console.log('🔨 FORGE Framework: Extension deactivated');
}
