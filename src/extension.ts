import * as vscode from 'vscode';
import { ForgeTaskProvider } from './providers/taskTreeProvider';
import { ForgePreventionRulesProvider } from './providers/preventionRulesProvider';
import { CopilotContextManager } from './utils/contextManager';
import { ForgeConfig } from './models/forgeConfig';
import { StartActivityCommand } from './commands/startActivity';
import { CompleteActivityCommand } from './commands/completeActivity';
import { ViewHistoryCommand } from './commands/viewHistory';
import { PreventionRuleAdder } from './commands/addPreventionRule';
import { ForgeDashboard } from './webview/markdownDashboard';
import { InitForgeCommand } from './commands/initForge';
import { TaskCreator } from './commands/createTask';
import { TaskCompleter } from './commands/completeTask';
import { FileManager } from './utils/fileManager';

let copilotContextManager: CopilotContextManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('🔨 FORGE Framework: Extension activation started');
    
    // Show immediate activation message
    vscode.window.showInformationMessage('🔨 FORGE Framework: Extension is activating...');

    // Initialize providers
    const taskProvider = new ForgeTaskProvider();
    const preventionRulesProvider = new ForgePreventionRulesProvider();
    
    // Register tree data providers
    vscode.window.registerTreeDataProvider('forgeExplorer', taskProvider);
    vscode.window.registerTreeDataProvider('forgePreventionRules', preventionRulesProvider);

    // Initialize Copilot context manager
    copilotContextManager = new CopilotContextManager();

    console.log('🔨 FORGE Framework: Providers and context manager initialized');
    
    // Show commands registration message
    vscode.window.showInformationMessage('🔨 FORGE Framework: Registering commands...');

    // Register commands
    const commands = [
        vscode.commands.registerCommand('forge.init', async () => {
            const fileManager = new FileManager();
            const initForge = new InitForgeCommand(fileManager);
            const success = await initForge.execute();
            if (success) {
                taskProvider.refresh();
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.startActivity', async () => {
            const startActivity = new StartActivityCommand();
            const success = await startActivity.execute();
            if (success) {
                taskProvider.refresh();
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.completeActivity', async () => {
            const completeActivity = new CompleteActivityCommand();
            const success = await completeActivity.execute();
            if (success) {
                taskProvider.refresh();
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.viewHistory', async () => {
            const viewHistory = new ViewHistoryCommand();
            await viewHistory.execute();
        }),

        vscode.commands.registerCommand('forge.addPreventionRule', async () => {
            const adder = new PreventionRuleAdder();
            const success = await adder.show();
            if (success) {
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.openDashboard', async () => {
            console.log('🔨 FORGE Framework: Opening dashboard...');
            const dashboard = new ForgeDashboard(context);
            await dashboard.show();
            console.log('🔨 FORGE Framework: Dashboard opened successfully');
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
        }),

        vscode.commands.registerCommand('forge.createTask', async () => {
            const taskCreator = new TaskCreator();
            const success = await taskCreator.show();
            if (success) {
                taskProvider.refresh();
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        }),

        vscode.commands.registerCommand('forge.completeTask', async (taskItem) => {
            const taskCompleter = new TaskCompleter();
            const success = await taskCompleter.show(taskItem);
            if (success) {
                taskProvider.refresh();
                preventionRulesProvider.refresh();
                await copilotContextManager.updateContext();
            }
        })
    ];

    // Register all disposables
    context.subscriptions.push(...commands, copilotContextManager);
    
    // Show final activation message
    vscode.window.showInformationMessage('🔨 FORGE Framework: Extension activated successfully! Commands are ready.');

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

    // Check if FORGE is initialized in workspace and start watching if needed
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const forgeConfigPath = vscode.Uri.joinPath(workspaceFolders[0].uri, '.forge', 'config.yml');
        vscode.workspace.fs.stat(forgeConfigPath).then(
            () => {
                // FORGE is initialized, start watching for changes
                copilotContextManager.startWatching();
                console.log('🔨 FORGE Framework: Started watching for changes in initialized workspace');
            },
            () => {
                // FORGE not initialized - extension is ready but not watching
                console.log('🔨 FORGE Framework: Ready (workspace not yet initialized)');
            }
        );
    }
}

export function deactivate() {
    if (copilotContextManager) {
        copilotContextManager.dispose();
    }
}
