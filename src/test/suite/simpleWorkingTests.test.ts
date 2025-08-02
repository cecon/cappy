import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NewTaskCreator } from '../../commands/createNewTask';
import { InitCapybaraCommand } from '../../commands/initCapybara';
import { FileManager } from '../../utils/fileManager';

suite('🎯 Simple Working Tests', () => {
    let testWorkspaceDir: string;
    let fileManager: FileManager;

    suiteSetup(async () => {
        console.log('🧪 Setting up simple working tests...');
        
        testWorkspaceDir = path.join(os.tmpdir(), 'capybara-simple-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        fileManager = new FileManager();
        
        console.log(`✅ Test workspace created at: ${testWorkspaceDir}`);
    });

    suiteTeardown(async () => {
        console.log('🧹 Cleaning up test workspace...');
        
        try {
            await fs.promises.rm(testWorkspaceDir, { recursive: true, force: true });
            console.log('✅ Test workspace cleaned up');
        } catch (error) {
            console.warn(`⚠️ Could not clean up test workspace: ${error}`);
        }
    });

    test('✅ Should initialize Capybara and create folder structure', async () => {
        console.log('🧪 Testing Capybara initialization...');
        
        // Create basic project files
        const packageJson = {
            name: 'test-simple-project',
            version: '1.0.0',
            dependencies: {
                'express': '^4.18.0'
            }
        };
        
        await fs.promises.writeFile(
            path.join(testWorkspaceDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );
        
        await fs.promises.writeFile(path.join(testWorkspaceDir, 'main.py'), '# Python file');

        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-simple-project',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            console.log('🔨 Executing init command...');
            const initCommand = new InitCapybaraCommand(fileManager);
            const result = await initCommand.execute();
            
            assert.strictEqual(result, true, 'Init command should succeed');

            console.log('📂 Checking folder structure...');
            
            // Check basic structure
            const capyDir = path.join(testWorkspaceDir, '.capy');
            assert.ok(fs.existsSync(capyDir), '.capy directory should exist');
            
            const configPath = path.join(capyDir, 'config.json');
            assert.ok(fs.existsSync(configPath), 'config.json should exist');
            
            console.log('📝 Checking config content...');
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Verify config structure (simplified checks)
            assert.ok(config.project, 'Config should have project section');
            assert.ok(config.project.name, 'Project should have a name');
            assert.ok(Array.isArray(config.project.language), 'Language should be an array');
            assert.ok(Array.isArray(config.project.framework), 'Framework should be an array');
            
            console.log('✅ Basic structure test passed');

        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('📝 Should create task with proper folder structure', async () => {
        console.log('🧪 Testing task creation...');
        
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-simple-project',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Mock user inputs
            const originalShowInputBox = vscode.window.showInputBox;
            const originalShowQuickPick = vscode.window.showQuickPick;
            const originalShowInformationMessage = vscode.window.showInformationMessage;
            let inputCallCount = 0;

            vscode.window.showInputBox = async (options?: vscode.InputBoxOptions) => {
                inputCallCount++;
                switch (inputCallCount) {
                    case 1: return 'Test Task Simple'; // Task name
                    case 2: return 'Teste simples de criação de tarefa'; // Task description
                    case 3: return '2'; // Estimated hours
                    default: return undefined;
                }
            };

            (vscode.window.showQuickPick as any) = async () => {
                return '🟡 Média Prioridade'; // Priority selection
            };

            vscode.window.showInformationMessage = async () => {
                return undefined; // No action on success message
            };

            console.log('📝 Creating task...');
            const newTaskCreator = new NewTaskCreator();
            const taskResult = await newTaskCreator.show();
            
            assert.strictEqual(taskResult, true, 'Task creation should succeed');

            console.log('🔍 Verifying task structure...');
            
            // Check task folder was created
            const capyDir = path.join(testWorkspaceDir, '.capy');
            const taskFolders = fs.readdirSync(capyDir).filter(folder => 
                fs.statSync(path.join(capyDir, folder)).isDirectory() && 
                folder.startsWith('task_')
            );
            
            assert.strictEqual(taskFolders.length, 1, 'Should have exactly one task folder');
            
            const taskFolderPath = path.join(capyDir, taskFolders[0]);
            
            // Check required files exist
            assert.ok(fs.existsSync(path.join(taskFolderPath, 'task-metadata.json')), 'task-metadata.json should exist');
            assert.ok(fs.existsSync(path.join(taskFolderPath, 'DESCRIPTION.md')), 'DESCRIPTION.md should exist');
            assert.ok(fs.existsSync(path.join(taskFolderPath, 'artifacts')), 'artifacts folder should exist');
            
            // Check artifacts is a directory
            const artifactsPath = path.join(taskFolderPath, 'artifacts');
            assert.ok(fs.statSync(artifactsPath).isDirectory(), 'artifacts should be a directory');

            console.log('✅ Task creation test passed');

            // Restore original methods
            vscode.window.showInputBox = originalShowInputBox;
            vscode.window.showQuickPick = originalShowQuickPick;
            vscode.window.showInformationMessage = originalShowInformationMessage;

        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('🚫 Should handle no workspace gracefully', async () => {
        console.log('🧪 Testing no workspace handling...');
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true
        });

        try {
            const originalShowInformationMessage = vscode.window.showInformationMessage;
            vscode.window.showInformationMessage = async () => 'Cancelar';

            const newTaskCreator = new NewTaskCreator();
            const result = await newTaskCreator.show();
            
            assert.strictEqual(result, false, 'Should return false when no workspace');
            
            vscode.window.showInformationMessage = originalShowInformationMessage;
            
            console.log('✅ No workspace test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });
});
