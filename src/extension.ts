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
                    const fileModule = await import('./utils/fileManager');
                    
                    const fileManager = new fileModule.FileManager();
                    const initCommand = new initModule.InitCapybaraCommand(fileManager);
                    
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

        // Register createTask command (simplified)
        const createTaskCommand = vscode.commands.registerCommand('capybara.createTask', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Create Task command called!');
                
                if (!vscode.workspace.workspaceFolders) {
                    vscode.window.showErrorMessage('Capybara Memory: No workspace folder is open. Please open a folder first.');
                    return;
                }
                
                // Try to load the task creator, but with error handling
                try {
                    const module = await import('./commands/createNewTask');
                    const taskCreator = new module.NewTaskCreator();
                    await taskCreator.show();
                } catch (importError) {
                    console.error('Error loading NewTaskCreator:', importError);
                    vscode.window.showErrorMessage('Capybara Memory: Create Task feature temporarily unavailable. Using fallback.');
                    
                    // Fallback simple implementation
                    const taskName = await vscode.window.showInputBox({
                        prompt: 'Nome da nova task',
                        placeHolder: 'ex: Implementar funcionalidade X'
                    });
                    
                    if (taskName) {
                        vscode.window.showInformationMessage(`🦫 Task "${taskName}" será implementada em breve!`);
                    }
                }
            } catch (error) {
                console.error('Capybara Memory CreateTask error:', error);
                vscode.window.showErrorMessage(`Capybara Memory CreateTask failed: ${error}`);
            }
        });

        // Register currentTask command (simplified)
        const currentTaskCommand = vscode.commands.registerCommand('capybara.currentTask', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Current Task command called!');
                
                // Try to load the task manager, but with error handling
                try {
                    const module = await import('./commands/taskManager');
                    const taskManager = new module.TaskManager();
                    await taskManager.showCurrentTask();
                } catch (importError) {
                    console.error('Error loading TaskManager:', importError);
                    vscode.window.showInformationMessage('🦫 Nenhuma task ativa no momento. Use "Create New Task" para começar!');
                }
            } catch (error) {
                console.error('Capybara Memory CurrentTask error:', error);
                vscode.window.showErrorMessage(`Capybara Memory CurrentTask failed: ${error}`);
            }
        });

        // Register other commands as simple placeholders for now
        const allTasksCommand = vscode.commands.registerCommand('capybara.allTasks', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: All Tasks command - Coming soon!');
        });

        const pauseTaskCommand = vscode.commands.registerCommand('capybara.pauseTask', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: Pause Task command - Coming soon!');
        });

        const completeTaskCommand = vscode.commands.registerCommand('capybara.completeTask', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: Complete Task command - Coming soon!');
        });

        const historyCommand = vscode.commands.registerCommand('capybara.history', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: History command - Coming soon!');
        });

        // Legacy commands
        const createSmartTaskCommand = vscode.commands.registerCommand('capybara.createSmartTask', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: createSmartTask is now integrated into createTask command!');
            await vscode.commands.executeCommand('capybara.createTask');
        });

        const addPreventionRuleCommand = vscode.commands.registerCommand('capybara.addPreventionRule', async () => {
            vscode.window.showInformationMessage('🦫 Capybara Memory: Prevention rules are now automatically inherited from completed tasks!');
        });

        // Register all commands
        context.subscriptions.push(
            testCommand, 
            initCommand, 
            createTaskCommand,
            currentTaskCommand,
            allTasksCommand,
            pauseTaskCommand,
            completeTaskCommand,
            historyCommand,
            createSmartTaskCommand, 
            addPreventionRuleCommand
        );
        
        console.log('🦫 Capybara Memory: All commands registered successfully');
        vscode.window.showInformationMessage('🦫 Capybara Memory: Ready! All commands available.');
        
    } catch (error) {
        console.error('🦫 Capybara Memory: Activation failed:', error);
        vscode.window.showErrorMessage(`🦫 Capybara Memory activation failed: ${error}`);
    }
}

export function deactivate() {
    console.log('🦫 Capybara Memory: Deactivation');
}
