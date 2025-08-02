import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

        // Register createTask command (with initialization check)
        const createTaskCommand = vscode.commands.registerCommand('capybara.createTask', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Create Task command called!');
                console.log('🦫 Capybara Memory: Create Task command started');
                
                if (!vscode.workspace.workspaceFolders) {
                    console.log('🦫 Capybara Memory: No workspace folders found');
                    vscode.window.showErrorMessage('Capybara Memory: No workspace folder is open. Please open a folder first.');
                    return;
                }

                console.log('🦫 Capybara Memory: Workspace folder found:', vscode.workspace.workspaceFolders[0].uri.fsPath);

                // Check if Capybara is initialized
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const capyConfigPath = path.join(workspaceRoot, '.capy', 'config.json');
                console.log('🦫 Capybara Memory: Checking config path:', capyConfigPath);
                
                try {
                    await fs.promises.access(capyConfigPath, fs.constants.F_OK);
                    console.log('🦫 Capybara Memory: Config file exists, proceeding with task creation');
                } catch (error) {
                    console.log('🦫 Capybara Memory: Config file not found, asking user to initialize');
                    const initFirst = await vscode.window.showWarningMessage(
                        '⚠️ Capybara não foi inicializado neste workspace.\n\nDeseja inicializar agora?',
                        'Sim, inicializar', 'Cancelar'
                    );
                    
                    if (initFirst === 'Sim, inicializar') {
                        console.log('🦫 Capybara Memory: User chose to initialize first');
                        await vscode.commands.executeCommand('capybara.init');
                        // After init, try to run create task again
                        setTimeout(() => vscode.commands.executeCommand('capybara.createTask'), 1000);
                    } else {
                        console.log('🦫 Capybara Memory: User cancelled initialization');
                    }
                    return;
                }
                
                // Try to load the task creator, but with error handling
                try {
                    console.log('🦫 Capybara Memory: Loading NewTaskCreator module');
                    const createModule = await import('./commands/createNewTask');
                    console.log('🦫 Capybara Memory: NewTaskCreator module loaded successfully');
                    const taskCreator = new createModule.NewTaskCreator();
                    console.log('🦫 Capybara Memory: Calling taskCreator.show()');
                    await taskCreator.show();
                    console.log('🦫 Capybara Memory: taskCreator.show() completed');
                } catch (importError) {
                    console.error('Error loading NewTaskCreator:', importError);
                    vscode.window.showErrorMessage(`Capybara Memory: Create Task feature failed: ${importError}`);
                    
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

        // Register currentTask command (with initialization check)
        const currentTaskCommand = vscode.commands.registerCommand('capybara.currentTask', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Current Task command called!');
                
                if (!vscode.workspace.workspaceFolders) {
                    vscode.window.showErrorMessage('Capybara Memory: No workspace folder is open. Please open a folder first.');
                    return;
                }

                // Check if Capybara is initialized
                const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                const capyConfigPath = path.join(workspaceRoot, '.capy', 'config.json');
                
                try {
                    await fs.promises.access(capyConfigPath, fs.constants.F_OK);
                } catch (error) {
                    const initFirst = await vscode.window.showWarningMessage(
                        '⚠️ Capybara não foi inicializado neste workspace.\n\nDeseja inicializar agora?',
                        'Sim, inicializar', 'Cancelar'
                    );
                    
                    if (initFirst === 'Sim, inicializar') {
                        await vscode.commands.executeCommand('capybara.init');
                    }
                    return;
                }
                
                // Try to load the task manager, but with error handling
                try {
                    const taskModule = await import('./commands/taskManager');
                    const taskManager = new taskModule.TaskManager();
                    await taskManager.showCurrentTask();
                } catch (importError) {
                    console.error('Error loading TaskManager:', importError);
                    vscode.window.showErrorMessage(`Capybara Memory: Current Task feature failed: ${importError}`);
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
