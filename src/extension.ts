import * as vscode from 'vscode';
import { ForgeTaskProvider } from './providers/taskTreeProvider';
import { ForgePreventionRulesProvider } from './providers/preventionRulesProvider';
import { CopilotContextManager } from './utils/contextManager';
import { ForgeConfig } from './models/forgeConfig';
import { TaskCreator } from './commands/createTask';
import { TaskCompleter } from './commands/completeTask';
import { PreventionRuleAdder } from './commands/addPreventionRule';
import { ForgeDashboard } from './webview/dashboard';
import { ForgeInitializer } from './commands/initForge';

let copilotContextManager: CopilotContextManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('FORGE Framework extension is now active!');

    // Initialize providers
    const taskProvider = new ForgeTaskProvider();
    const preventionRulesProvider = new ForgePreventionRulesProvider();
    
    // Register tree data providers
    vscode.window.registerTreeDataProvider('forgeExplorer', taskProvider);
    vscode.window.registerTreeDataProvider('forgePreventionRules', preventionRulesProvider);

    // Initialize Copilot context manager
    copilotContextManager = new CopilotContextManager();

    // Register commands
    const commands = [
        vscode.commands.registerCommand('forge.init', async () => {
            const initializer = new ForgeInitializer();
            await initializer.initialize();
            taskProvider.refresh();
            preventionRulesProvider.refresh();
        }),

        vscode.commands.registerCommand('forge.createTask', async () => {
            const creator = new TaskCreator();
            const success = await creator.show();
            if (success) {
                taskProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.completeTask', async (taskItem?) => {
            const completer = new TaskCompleter();
            const success = await completer.show(taskItem);
            if (success) {
                taskProvider.refresh();
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.addPreventionRule', async () => {
            const adder = new PreventionRuleAdder();
            const success = await adder.show();
            if (success) {
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.openDashboard', () => {
            const dashboard = new ForgeDashboard(context);
            dashboard.show();
        }),

        vscode.commands.registerCommand('forge.updateCopilotContext', async () => {
            await copilotContextManager.updateContext();
            vscode.window.showInformationMessage('Copilot context updated successfully!');
        }),

        vscode.commands.registerCommand('forge.exportRules', async () => {
            // TODO: Implement export functionality
            vscode.window.showInformationMessage('Export functionality coming soon!');
        }),

        vscode.commands.registerCommand('forge.refreshTasks', () => {
            taskProvider.refresh();
            preventionRulesProvider.refresh();
        }),

        vscode.commands.registerCommand('forge.openTask', (taskItem) => {
            if (taskItem && taskItem.taskPath) {
                const descriptionPath = vscode.Uri.file(`${taskItem.taskPath}/description.md`);
                vscode.window.showTextDocument(descriptionPath);
            }
        })
    ];

    // Check if FORGE is already initialized
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const forgeConfigPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.forge', 'config.yml');
        vscode.workspace.fs.stat(forgeConfigPath).then(
            () => {
                // FORGE is initialized, start watching for changes
                copilotContextManager.startWatching();
                
                // Show welcome message
                if (vscode.workspace.getConfiguration('forge').get('showNotifications', true)) {
                    vscode.window.showInformationMessage(
                        'FORGE Framework is active! Use Ctrl+Shift+P → "FORGE: Create New Task" to get started.',
                        'Create Task',
                        'Open Dashboard'
                    ).then(choice => {
                        if (choice === 'Create Task') {
                            vscode.commands.executeCommand('forge.createTask');
                        } else if (choice === 'Open Dashboard') {
                            vscode.commands.executeCommand('forge.openDashboard');
                        }
                    });
                }
            },
            () => {
                // FORGE not initialized, show initialization prompt
                vscode.window.showInformationMessage(
                    'FORGE Framework detected! Initialize to start accumulating AI knowledge.',
                    'Initialize FORGE',
                    'Learn More'
                ).then(choice => {
                    if (choice === 'Initialize FORGE') {
                        vscode.commands.executeCommand('forge.init');
                    } else if (choice === 'Learn More') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/cecon/forge-framework'));
                    }
                });
            }
        );
    }

    // Register all disposables
    context.subscriptions.push(...commands, copilotContextManager);

    // Setup configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('forge.autoUpdateCopilotContext')) {
                const autoUpdate = vscode.workspace.getConfiguration('forge').get('autoUpdateCopilotContext', true);
                if (autoUpdate) {
                    copilotContextManager.startWatching();
                } else {
                    copilotContextManager.stopWatching();
                }
            }
        })
    );
}

export function deactivate() {
    if (copilotContextManager) {
        copilotContextManager.dispose();
    }
}
