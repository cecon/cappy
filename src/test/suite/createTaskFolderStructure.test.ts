import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NewTaskCreator } from '../../commands/createNewTask';
import { InitCapybaraCommand } from '../../commands/initCapybara';
import { FileManager } from '../../utils/fileManager';

suite('📁 Create Task Folder Structure Test', () => {
    let testWorkspaceDir: string;
    let fileManager: FileManager;
    let newTaskCreator: NewTaskCreator;
    let initCommand: InitCapybaraCommand;

    suiteSetup(async () => {
        console.log('🧪 Setting up Create Task Folder Structure test...');
        
        // Create a temporary workspace directory
        testWorkspaceDir = path.join(os.tmpdir(), 'capybara-folder-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        // Create a basic project structure
        const packageJson = {
            name: 'test-project-folder-structure',
            version: '1.0.0',
            description: 'Test project for folder structure validation'
        };
        await fs.promises.writeFile(
            path.join(testWorkspaceDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );

        // Initialize components
        fileManager = new FileManager();
        newTaskCreator = new NewTaskCreator();
        initCommand = new InitCapybaraCommand(fileManager);
        
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

    test('🏗️ Should create task and step folder structure when opening folder and calling create task', async () => {
        // Step 1: Mock opening a folder (workspace)
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-project-folder-structure',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Step 2: Initialize Capybara (como se tivesse acabado de abrir o projeto)
            console.log('🔨 Initializing Capybara after opening folder...');
            const initResult = await initCommand.execute();
            assert.strictEqual(initResult, true, 'Capybara should initialize successfully');

            // Step 3: Verify .capy directory was created
            const capyDir = path.join(testWorkspaceDir, '.capy');
            const capyExists = fs.existsSync(capyDir);
            assert.strictEqual(capyExists, true, '.capy directory should be created');

            // Step 4: Mock user inputs for task creation
            const originalShowInputBox = vscode.window.showInputBox;
            const originalShowQuickPick = vscode.window.showQuickPick;
            let inputCallCount = 0;

            vscode.window.showInputBox = async (options?: vscode.InputBoxOptions) => {
                inputCallCount++;
                switch (inputCallCount) {
                    case 1: return 'Implementar Login System'; // Task name
                    case 2: return 'Criar sistema de autenticação com JWT e validação de usuário'; // Task description
                    case 3: return '3'; // Estimated hours
                    default: return undefined;
                }
            };

            (vscode.window.showQuickPick as any) = async () => {
                return '🟡 Média Prioridade'; // Priority selection
            };

            // Step 5: Execute create task command
            console.log('📝 Executing create task command...');
            const taskResult = await newTaskCreator.show();
            assert.strictEqual(taskResult, true, 'Task creation should succeed');

            // Step 6: Verify task folder structure was created
            console.log('🔍 Verifying task folder structure...');
            
            // Check if task folder exists
            const taskFolders = fs.readdirSync(capyDir).filter(folder => 
                fs.statSync(path.join(capyDir, folder)).isDirectory() && 
                folder.startsWith('task_')
            );
            
            assert.strictEqual(taskFolders.length, 1, 'Should have exactly one task folder');
            assert.ok(taskFolders[0].match(/^task_\d{4}$/), 'Task folder should follow pattern task_XXXX');
            
            const taskFolderName = taskFolders[0];
            const taskFolderPath = path.join(capyDir, taskFolderName);
            
            console.log(`✅ Task folder created: ${taskFolderName}`);

            // Step 7: Verify task folder contents
            const taskContents = fs.readdirSync(taskFolderPath);
            
            // Verify required files exist
            assert.ok(taskContents.includes('task-metadata.json'), 'task-metadata.json should exist');
            assert.ok(taskContents.includes('DESCRIPTION.md'), 'DESCRIPTION.md should exist');
            assert.ok(taskContents.includes('artifacts'), 'artifacts folder should exist');
            
            console.log('✅ Task folder contains required files and folders');

            // Step 8: Verify artifacts folder is a directory
            const artifactsPath = path.join(taskFolderPath, 'artifacts');
            const artifactsStats = fs.statSync(artifactsPath);
            assert.ok(artifactsStats.isDirectory(), 'artifacts should be a directory');

            // Step 9: Verify task metadata content
            const metadataPath = path.join(taskFolderPath, 'task-metadata.json');
            const metadataContent = fs.readFileSync(metadataPath, 'utf8');
            const metadata = JSON.parse(metadataContent);
            
            assert.strictEqual(metadata.name, 'Implementar Login System', 'Task name should match input');
            assert.strictEqual(metadata.status, 'active', 'Task should be active');
            assert.strictEqual(metadata.estimatedHours, 3, 'Estimated hours should match input');
            assert.ok(metadata.id.startsWith('task_'), 'Task ID should have correct format');
            assert.ok(metadata.createdAt, 'Task should have creation timestamp');

            console.log('✅ Task metadata validated successfully');

            // Step 10: Verify DESCRIPTION.md content
            const descriptionPath = path.join(taskFolderPath, 'DESCRIPTION.md');
            const descriptionContent = fs.readFileSync(descriptionPath, 'utf8');
            
            assert.ok(descriptionContent.includes('Implementar Login System'), 'Description should contain task name');
            assert.ok(descriptionContent.includes('Criar sistema de autenticação'), 'Description should contain task description');
            
            console.log('✅ Task description file validated successfully');

            // Step 11: Verify task is set as current in config
            const configPath = path.join(capyDir, 'config.json');
            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            assert.strictEqual(config.tasks.currentTask, metadata.id, 'Task should be set as current task');
            assert.strictEqual(config.tasks.nextTaskNumber, 2, 'Next task number should be incremented');

            console.log('✅ Capybara config updated correctly');

            // Step 12: Verify overall folder structure matches expected pattern
            const expectedStructure = [
                '.capy',
                '.capy/config.json',
                '.capy/prevention-rules.md',
                `.capy/${taskFolderName}`,
                `.capy/${taskFolderName}/task-metadata.json`,
                `.capy/${taskFolderName}/DESCRIPTION.md`,
                `.capy/${taskFolderName}/artifacts`
            ];

            for (const expectedPath of expectedStructure) {
                const fullPath = path.join(testWorkspaceDir, expectedPath);
                const exists = fs.existsSync(fullPath);
                assert.ok(exists, `Expected path should exist: ${expectedPath}`);
            }

            console.log('✅ Complete folder structure verified successfully');

            // Restore original methods
            vscode.window.showInputBox = originalShowInputBox;
            vscode.window.showQuickPick = originalShowQuickPick;

        } finally {
            // Restore original workspace folders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('📂 Should handle step creation within task folder', async () => {
        // Mock workspace folder
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-project-folder-structure',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Verify task folder exists from previous test
            const capyDir = path.join(testWorkspaceDir, '.capy');
            const taskFolders = fs.readdirSync(capyDir).filter(folder => 
                fs.statSync(path.join(capyDir, folder)).isDirectory() && 
                folder.startsWith('task_')
            );
            
            assert.ok(taskFolders.length > 0, 'Should have at least one task folder from previous test');
            
            const taskFolderPath = path.join(capyDir, taskFolders[0]);
            const artifactsPath = path.join(taskFolderPath, 'artifacts');
            
            // Simulate creating step files in artifacts folder
            const stepFile1 = path.join(artifactsPath, 'step-01-setup-authentication.md');
            const stepFile2 = path.join(artifactsPath, 'step-02-implement-jwt.md');
            
            await fs.promises.writeFile(stepFile1, `# Step 1: Setup Authentication

## Objetivo
Configurar estrutura básica de autenticação

## Tarefas
- [ ] Criar middleware de autenticação
- [ ] Configurar rotas protegidas
- [ ] Implementar validação de token
`);

            await fs.promises.writeFile(stepFile2, `# Step 2: Implement JWT

## Objetivo
Implementar sistema de JWT para autenticação

## Tarefas
- [ ] Configurar biblioteca JWT
- [ ] Criar função de geração de token
- [ ] Implementar validação de token
`);

            // Verify step files were created
            const artifactsContents = fs.readdirSync(artifactsPath);
            assert.ok(artifactsContents.includes('step-01-setup-authentication.md'), 'Step 1 file should exist');
            assert.ok(artifactsContents.includes('step-02-implement-jwt.md'), 'Step 2 file should exist');

            // Verify step file contents
            const step1Content = fs.readFileSync(stepFile1, 'utf8');
            assert.ok(step1Content.includes('Setup Authentication'), 'Step 1 should contain correct title');
            assert.ok(step1Content.includes('middleware de autenticação'), 'Step 1 should contain Portuguese content');

            const step2Content = fs.readFileSync(stepFile2, 'utf8');
            assert.ok(step2Content.includes('Implement JWT'), 'Step 2 should contain correct title');
            assert.ok(step2Content.includes('biblioteca JWT'), 'Step 2 should contain Portuguese content');

            console.log('✅ Step files created and validated successfully');

        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('🚫 Should fail gracefully when no workspace is open', async () => {
        // Mock no workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true
        });

        try {
            // Mock user choosing to cancel
            const originalShowInformationMessage = vscode.window.showInformationMessage;
            vscode.window.showInformationMessage = async () => 'Cancelar';

            const result = await newTaskCreator.show();
            
            assert.strictEqual(result, false, 'Should return false when no workspace is open');
            
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
});
