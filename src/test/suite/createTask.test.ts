import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NewTaskCreator } from '../../commands/createNewTask';
import { TaskWorkflowManager } from '../../utils/taskWorkflowManager';
import { FileManager } from '../../utils/fileManager';
import { InitCapybaraCommand } from '../../commands/initCapybara';

suite('📝 Create Task Test Suite', () => {
    let testWorkspaceDir: string;
    let fileManager: FileManager;
    let taskWorkflowManager: TaskWorkflowManager;
    let newTaskCreator: NewTaskCreator;
    let initCommand: InitCapybaraCommand;

    suiteSetup(async () => {
        console.log('🧪 Setting up Create Task test suite...');
        
        // Create a temporary workspace directory for testing
        testWorkspaceDir = path.join(os.tmpdir(), 'capybara-task-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        // Create a minimal package.json to simulate a project
        const packageJson = {
            name: 'test-task-project',
            version: '1.0.0',
            dependencies: {
                'typescript': '^4.0.0'
            }
        };
        await fs.promises.writeFile(
            path.join(testWorkspaceDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );

        // Initialize dependencies
        fileManager = new FileManager();
        taskWorkflowManager = new TaskWorkflowManager();
        newTaskCreator = new NewTaskCreator();
        initCommand = new InitCapybaraCommand(fileManager);
        
        console.log(`✅ Test workspace created at: ${testWorkspaceDir}`);
    });

    suiteTeardown(async () => {
        console.log('🧹 Cleaning up Create Task test suite...');
        
        // Clean up test workspace
        try {
            await fs.promises.rm(testWorkspaceDir, { recursive: true, force: true });
            console.log('✅ Test workspace cleaned up');
        } catch (error) {
            console.warn(`⚠️ Could not clean up test workspace: ${error}`);
        }
    });

    test('🏗️ Should create task folder structure in .capy directory', async () => {
        // Mock workspace folders
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-task-project',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // First, initialize Capybara in the test workspace
            console.log('🔨 Initializing Capybara...');
            const initResult = await initCommand.execute();
            assert.strictEqual(initResult, true, 'Capybara initialization should succeed');

            // Verify .capy directory exists
            const capyDir = path.join(testWorkspaceDir, '.capy');
            const capyDirExists = await fs.promises.access(capyDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(capyDirExists, true, '.capy directory should exist after init');

            // Mock user inputs for task creation
            const originalShowInputBox = vscode.window.showInputBox;
            const originalShowQuickPick = vscode.window.showQuickPick;
            let inputCallCount = 0;

            vscode.window.showInputBox = async (options?: vscode.InputBoxOptions) => {
                inputCallCount++;
                if (inputCallCount === 1) {
                    // Task name
                    return 'Test Task Implementation';
                } else if (inputCallCount === 2) {
                    // Task description
                    return 'This is a test task to verify the task creation functionality is working correctly.';
                } else if (inputCallCount === 3) {
                    // Estimated hours
                    return '2';
                }
                return undefined;
            };

            (vscode.window.showQuickPick as any) = async () => {
                // Priority selection - choose medium priority
                return '🟡 Média Prioridade';
            };

            // Create a task
            console.log('📝 Creating a test task...');
            const taskResult = await newTaskCreator.show();
            assert.strictEqual(taskResult, true, 'Task creation should succeed');

            // Verify task folder was created
            const taskFolders = await fs.promises.readdir(capyDir);
            const taskFolderPattern = /^task_\d{4}$/;
            const taskFolder = taskFolders.find(folder => taskFolderPattern.test(folder));
            
            assert.ok(taskFolder, 'Task folder should be created with pattern task_XXXX');
            console.log(`✅ Task folder created: ${taskFolder}`);

            // Verify task folder structure
            const taskPath = path.join(capyDir, taskFolder);
            const taskContents = await fs.promises.readdir(taskPath);
            
            assert.ok(taskContents.includes('task-metadata.json'), 'task-metadata.json should exist');
            assert.ok(taskContents.includes('DESCRIPTION.md'), 'DESCRIPTION.md should exist');
            assert.ok(taskContents.includes('artifacts'), 'artifacts folder should exist');

            // Verify task metadata content
            const metadataPath = path.join(taskPath, 'task-metadata.json');
            const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            assert.strictEqual(metadata.name, 'Test Task Implementation', 'Task name should match input');
            assert.strictEqual(metadata.status, 'active', 'Task should be active');
            assert.strictEqual(metadata.estimatedHours, 2, 'Estimated hours should match input');
            assert.ok(metadata.id.startsWith('task_'), 'Task ID should have correct format');

            // Verify artifacts folder exists and is empty
            const artifactsPath = path.join(taskPath, 'artifacts');
            const artifactsDirExists = await fs.promises.access(artifactsPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(artifactsDirExists, true, 'artifacts directory should exist');

            // Verify task is set as current task in config
            const configPath = path.join(capyDir, 'config.json');
            const configContent = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            assert.strictEqual(config.tasks.currentTask, metadata.id, 'Task should be set as current task in config');

            // Restore original methods
            vscode.window.showInputBox = originalShowInputBox;
            vscode.window.showQuickPick = originalShowQuickPick;

            console.log('✅ Task creation test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('📂 Should handle multiple task creation correctly', async () => {
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-task-project',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Mock user inputs for second task creation
            const originalShowInputBox = vscode.window.showInputBox;
            const originalShowQuickPick = vscode.window.showQuickPick;
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            let inputCallCount = 0;

            vscode.window.showWarningMessage = async () => {
                // When asked about active task, choose to pause and create new
                return 'Pause Current & Create New';
            };

            vscode.window.showInputBox = async (options?: vscode.InputBoxOptions) => {
                inputCallCount++;
                if (inputCallCount === 1) {
                    return 'Second Test Task';
                } else if (inputCallCount === 2) {
                    return 'This is the second test task to verify multiple task handling.';
                } else if (inputCallCount === 3) {
                    return '1.5';
                }
                return undefined;
            };

            (vscode.window.showQuickPick as any) = async () => {
                return '🔴 Alta Prioridade';
            };

            // Create second task
            console.log('📝 Creating a second test task...');
            const taskResult = await newTaskCreator.show();
            assert.strictEqual(taskResult, true, 'Second task creation should succeed');

            // Verify both tasks exist
            const capyDir = path.join(testWorkspaceDir, '.capy');
            const taskFolders = await fs.promises.readdir(capyDir);
            const taskFolderPattern = /^task_\d{4}$/;
            const taskFolderList = taskFolders.filter(folder => taskFolderPattern.test(folder));
            
            assert.strictEqual(taskFolderList.length, 2, 'Should have two task folders');
            assert.ok(taskFolderList.includes('task_0001'), 'First task folder should exist');
            assert.ok(taskFolderList.includes('task_0002'), 'Second task folder should exist');

            // Verify second task is now the current task
            const configPath = path.join(capyDir, 'config.json');
            const configContent = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            assert.strictEqual(config.tasks.currentTask, 'task_0002', 'Second task should be current task');

            // Verify task counter was incremented correctly
            assert.strictEqual(config.tasks.nextTaskNumber, 3, 'Next task number should be 3');

            // Restore original methods
            vscode.window.showInputBox = originalShowInputBox;
            vscode.window.showQuickPick = originalShowQuickPick;
            vscode.window.showWarningMessage = originalShowWarningMessage;

            console.log('✅ Multiple task creation test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('🚫 Should handle task creation without workspace gracefully', async () => {
        // Mock no workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true
        });

        try {
            // Mock user choosing not to open folder
            const originalShowInformationMessage = vscode.window.showInformationMessage;
            vscode.window.showInformationMessage = async () => 'Cancelar';

            const result = await newTaskCreator.show();
            
            // Should return false when no workspace is available
            assert.strictEqual(result, false, 'Should return false when no workspace folder is open');
            
            // Restore original method
            vscode.window.showInformationMessage = originalShowInformationMessage;
            
            console.log('✅ No workspace handling test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('✂️ Should validate task input correctly', async () => {
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-task-project',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Mock user canceling task creation by not providing name
            const originalShowInputBox = vscode.window.showInputBox;
            vscode.window.showInputBox = async (options?: vscode.InputBoxOptions) => {
                // Return undefined to simulate user cancellation
                return undefined;
            };

            const result = await newTaskCreator.show();
            assert.strictEqual(result, false, 'Should return false when user cancels input');

            // Restore original method
            vscode.window.showInputBox = originalShowInputBox;

            console.log('✅ Input validation test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });
});
