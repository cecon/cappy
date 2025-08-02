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
            console.log('🦫 Capybara Memory: Create Task command triggered');
            
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Create Task command called!');
                console.log('🦫 Capybara Memory: Create Task command started');
                
                console.log('🦫 Capybara Memory: Checking workspace folders...');
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
                    console.log('🦫 Capybara Memory: Attempting to access config file...');
                    await fs.promises.access(capyConfigPath, fs.constants.F_OK);
                    console.log('🦫 Capybara Memory: Config file exists, proceeding with task creation');
                } catch (configError) {
                    console.log('🦫 Capybara Memory: Config file not found, asking user to initialize');
                    console.log('🦫 Capybara Memory: Config error details:', configError);
                    
                    try {
                        const initFirst = await vscode.window.showWarningMessage(
                            '⚠️ Capybara não foi inicializado neste workspace.\n\nDeseja inicializar agora?',
                            'Sim, inicializar', 'Cancelar'
                        );
                        
                        console.log('🦫 Capybara Memory: User choice:', initFirst);
                        
                        if (initFirst === 'Sim, inicializar') {
                            console.log('🦫 Capybara Memory: User chose to initialize first');
                            await vscode.commands.executeCommand('capybara.init');
                            // After init, try to run create task again
                            setTimeout(() => vscode.commands.executeCommand('capybara.createTask'), 1000);
                        } else {
                            console.log('🦫 Capybara Memory: User cancelled initialization');
                        }
                    } catch (dialogError) {
                        console.error('🦫 Capybara Memory: Error showing dialog:', dialogError);
                        vscode.window.showErrorMessage(`Error showing initialization dialog: ${dialogError}`);
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
                    // const taskModule = await import('./commands/taskManager');
                    // const taskManager = new taskModule.TaskManager();
                    // await taskManager.showCurrentTask();
                    
                    // For now, show current task using workflow manager
                    const workflowModule = await import('./utils/taskWorkflowManager');
                    const workflowManager = new workflowModule.TaskWorkflowManager();
                    const currentTask = await workflowManager.getCurrentTask();
                    
                    if (currentTask) {
                        vscode.window.showInformationMessage(
                            `🎯 Task Ativa: ${currentTask.title}\nProgresso: ${currentTask.progress.completed}/${currentTask.progress.total} steps`
                        );
                    } else {
                        vscode.window.showInformationMessage('📋 Nenhuma task ativa. Use "Capybara: Create New Task" para começar.');
                    }
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

        // Update Capybara Instructions command
        const updateInstructionsCommand = vscode.commands.registerCommand('capybara.updateInstructions', async () => {
            try {
                vscode.window.showInformationMessage('🦫 Capybara Memory: Updating instructions...');
                
                const fileModule = await import('./utils/fileManager');
                const fileManager = new fileModule.FileManager();
                
                // Check current version
                const currentVersion = await fileManager.getCurrentCapybaraVersion();
                const newVersion = "1.0.0"; // This should be configurable in the future
                
                if (currentVersion === newVersion) {
                    vscode.window.showInformationMessage(`🦫 Capybara Memory: Instructions are already at version ${newVersion}`);
                    return;
                }
                
                // For now, we'll regenerate with current config
                const config = await fileManager.readCapybaraConfig();
                if (!config) {
                    vscode.window.showErrorMessage('🦫 Capybara Memory: No Capybara config found. Run Initialize first.');
                    return;
                }
                
                // Create new instructions content
                const instructions = `=====================START CAPYBARA MEMORY v${newVersion}=====================
# 🔨 Capybara - GitHub Copilot Instructions

## 📋 **PROJECT CONTEXT**
- **Project**: ${config.project.name}
- **Main Language**: ${config.project.language.join(', ')}
- **Frameworks**: ${config.project.framework?.join(', ') || 'None detected'}

## 🎯 **CAPYBARA METHODOLOGY**
This project uses Capybara methodology (Focus, Organize, Record, Grow, Evolve) for solo development:

### **Principles:**
1. **Atomic Tasks**: Maximum 2-3 hours per STEP
2. **XML Structure**: Tasks defined in single XML file
3. **Continuous Learning**: Every error becomes a prevention rule
4. **Preserved Context**: AI always informed of current state
5. **Minimal Documentation**: Only what saves time

### **Active Prevention Rules:**
*Rules will be automatically loaded from .capy/prevention-rules.md file*

## 🛠️ **SPECIFIC INSTRUCTIONS**

### **For this project:**
- Always check prevention rules before suggesting code
- Work with tasks in XML format (task.xml)
- Focus on simple and direct solutions
- Document problems found to create new rules

### **⚠️ Current Extension State:**
- **Initialization**: Fully functional
- **Task Creation**: XML structured with steps, criteria and validation
- **Progress Management**: Tracking completion by step
- **Other commands**: Mostly placeholders (show "Coming soon!")
- **Focus**: Incremental development with Capybara methodology

### **🎯 Recommended Workflow:**
1. Use \`Capybara: Initialize\` to configure new project
2. Use \`Capybara: Create New Task\` to create structured XML tasks
3. Edit task.xml to define project-specific steps
4. Mark steps as complete by changing \`concluido="true"\`
5. For other features, wait for implementation or contribute!

### **📄 XML Task Structure:**

\`\`\`xml
<task id="task-id" versao="1.0">
    <metadados>
        <titulo>Task Title</titulo>
        <descricao>Detailed description</descricao>
        <status>em-andamento|pausada|concluida</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>example-library</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Step Name</titulo>
            <descricao>What to do in this step</descricao>
            <criterios>
                <criterio>Criteria 1</criterio>
                <criterio>Criteria 2</criterio>
            </criterios>
            <entrega>File.jsx</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>All mandatory steps completed</item>
        </checklist>
    </validacao>
</task>
\`\`\`

### **Available Capybara Commands:**

#### **✅ Functional Commands:**
- \`Capybara: Initialize\` - Initialize Capybara in workspace
- \`Capybara: Create New Task\` - Create new structured XML task
- \`Capybara: Current Task\` - View current task (with validation)
- \`Capybara: Test Capybara Extension\` - Test if extension is working

#### **🚧 Commands in Development:**
- \`Capybara: Manage All Tasks\` - Manage all tasks (coming soon)
- \`Capybara: Pause Current Task\` - Pause current task (coming soon)
- \`Capybara: Complete Task\` - Complete and move to history (coming soon)
- \`Capybara: Update Step Progress\` - Mark steps as completed (coming soon)
- \`Capybara: Complete Current Task\` - Complete current task (coming soon)
- \`Capybara: Task History\` - View task history (coming soon)

#### **🔄 Legacy Commands:**
- \`Capybara: Create Smart Task (Legacy)\` - Redirects to Create New Task
- \`Capybara: Add Prevention Rule (Legacy)\` - Functionality automatically integrated

### **📝 Current Development State:**
- ✅ Initialization and configuration: **Complete**
- ✅ Basic task creation: **Functional with validation**
- 🚧 Task management: **In development**
- 🚧 History and analytics: **Planned**

---
*This file is private and should not be committed. It contains your personalized instructions for GitHub Copilot.*
======================END CAPYBARA MEMORY v${newVersion}======================
`;
                
                await fileManager.updateCapybaraInstructions(instructions, newVersion);
                
                vscode.window.showInformationMessage(
                    `🦫 Capybara Memory: Instructions updated to version ${newVersion}${currentVersion ? ` (from ${currentVersion})` : ''}!`
                );
                
            } catch (error) {
                console.error('Error updating Capybara instructions:', error);
                vscode.window.showErrorMessage(`🦫 Capybara Memory: Failed to update instructions: ${error}`);
            }
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
            addPreventionRuleCommand,
            updateInstructionsCommand
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
