import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InitCappyCommand } from '../../commands/initCappy';
import { FileManager } from '../../utils/fileManager';

suite('🔨 InitCappy Command Test Suite', () => {
    let testWorkspaceDir: string;
    let fileManager: FileManager;
    let initCommand: InitCappyCommand;

    suiteSetup(async () => {
        console.log('🧪 Setting up InitCappy test suite...');
        
        // Create a temporary workspace directory for testing
        testWorkspaceDir = path.join(os.tmpdir(), 'cappy-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        // Initialize dependencies
        fileManager = new FileManager();
        initCommand = new InitCappyCommand();
        
        console.log(`✅ Test workspace created at: ${testWorkspaceDir}`);
    });

    suiteTeardown(async () => {
        console.log('🧹 Cleaning up InitCappy test suite...');
        
        // Clean up test workspace
        try {
            await fs.promises.rm(testWorkspaceDir, { recursive: true, force: true });
            console.log('✅ Test workspace cleaned up');
        } catch (error) {
            console.warn(`⚠️ Could not clean up test workspace: ${error}`);
        }
    });

    test('🏗️ Should create basic Cappy directory structure', async () => {
        // Create a test project structure
        const projectDir = path.join(testWorkspaceDir, 'test-project-structure');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Create a minimal package.json to simulate a Node project
        const packageJson = {
            name: 'test-project-structure',
            version: '1.0.0',
            dependencies: {
                'typescript': '^4.0.0'
            }
        };
        await fs.promises.writeFile(
            path.join(projectDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );

        // Mock workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(projectDir),
            name: 'test-project-structure',
            index: 0
        };
        
        // Temporarily override workspace folders
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Execute the init command
            const result = await initCommand.execute();
            
            // Verify the command succeeded
            assert.strictEqual(result, true, 'InitCappy command should return true on success');

            // Verify .cappy directory was created
            const cappyDir = path.join(projectDir, '.cappy');
            const cappyDirExists = await fs.promises.access(cappyDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(cappyDirExists, true, '.cappy directory should be created');

            // Verify .github directory was created
            const githubDir = path.join(projectDir, '.github');
            const githubDirExists = await fs.promises.access(githubDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(githubDirExists, true, '.github directory should be created');

            // Verify history subdirectory was created
            const historyDir = path.join(cappyDir, 'history');
            const historyDirExists = await fs.promises.access(historyDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(historyDirExists, true, '.cappy/history directory should be created');

            console.log('✅ Basic directory structure test passed');
        } finally {
            // Restore original workspace folders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('📝 Should create required configuration files', async () => {
        const projectDir = path.join(testWorkspaceDir, 'test-project-config');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Minimal project
        const packageJson = {
            name: 'test-project-config',
            version: '1.0.0'
        };
        await fs.promises.writeFile(
            path.join(projectDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );
        // no tsconfig needed

        // Mock workspace folders
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(projectDir),
            name: 'test-project-config',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            await initCommand.execute();

            // Verify config.yaml was created with correct content
            const configPath = path.join(projectDir, '.cappy', 'config.yaml');
            const configExists = await fs.promises.access(configPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(configExists, true, 'config.yaml should be created');

            const configContent = await fs.promises.readFile(configPath, 'utf8');
            assert.ok(/version:\s*"?\d+\.\d+\.\d+"?/m.test(configContent), 'config.yaml should contain version');

            // Verify stack location from config and initial file presence
            const stackFile = path.join(projectDir, '.cappy', 'stack.md');
            const stackExists = await fs.promises.access(stackFile, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(stackExists, true, '.cappy/stack.md should be created (empty)');

            // Config should reference .cappy/stack.md and validated false
            assert.ok(/stack:\s*[\s\S]*?source:\s*"?\.cappy\/stack\.md"?/m.test(configContent), 'config.yaml should point stack.source to .cappy/stack.md');
            assert.ok(/stack:\s*[\s\S]*?validated:\s*false/m.test(configContent), 'config.yaml should set stack.validated=false');

            // .gitignore should be created/updated
            const giPath = path.join(projectDir, '.gitignore');
            const giExists = await fs.promises.access(giPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(giExists, true, '.gitignore should exist');
            const giContent = await fs.promises.readFile(giPath, 'utf8');
            assert.ok(giContent.includes('# Cappy specific - ignore only runtime files'), 'gitignore should include new header');
            assert.ok(giContent.includes('.cappy/history/'), 'gitignore should ignore history folder');
            assert.ok(giContent.includes('.cappy/tasks/'), 'gitignore should ignore tasks folder');
            assert.ok(giContent.includes('.cappy/history/'), 'gitignore should ignore history folder');
            assert.ok(giContent.includes('.cappy/tasks/'), 'gitignore should ignore tasks folder');

            console.log('✅ Configuration files test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    // Removed detection test: init no longer infers languages/frameworks

    test.skip('🚫 Should handle workspace without folder gracefully', async () => {
        // Mock no workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true
        });

        try {
            const result = await initCommand.execute();
            
            // Should return false when no workspace is available
            assert.strictEqual(result, false, 'Should return false when no workspace folder is open');
            
            console.log('✅ No workspace handling test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('⚠️ Should handle existing Cappy installation', async () => {
        const projectDir = path.join(testWorkspaceDir, 'test-project-existing');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Create existing .cappy directory
        const cappyDir = path.join(projectDir, '.cappy');
        await fs.promises.mkdir(cappyDir, { recursive: true });
        await fs.promises.writeFile(path.join(cappyDir, 'config.json'), '{"existing": true}');

        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(projectDir),
            name: 'test-project-existing',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            const result = await initCommand.execute();

            // Should return true and produce config.yaml
            assert.strictEqual(result, true, 'Init should complete successfully');
            const yamlExists = await fs.promises.access(path.join(cappyDir, 'config.yaml'), fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(yamlExists, true, 'config.yaml should exist after init');

            console.log('✅ Existing installation handling test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('📁 Should update .gitignore correctly', async () => {
        const projectDir = path.join(testWorkspaceDir, 'test-project-gitignore');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Create existing .gitignore
        const existingGitignore = `node_modules/
*.log
dist/`;
        await fs.promises.writeFile(path.join(projectDir, '.gitignore'), existingGitignore);

        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(projectDir),
            name: 'test-project-gitignore',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            await initCommand.execute();

            // Verify .gitignore was updated
            const gitignoreContent = await fs.promises.readFile(path.join(projectDir, '.gitignore'), 'utf8');
            
            assert.ok(gitignoreContent.includes('node_modules/'), 'Should preserve existing entries');
            assert.ok(gitignoreContent.includes('# Cappy specific - ignore only runtime files'), 'Should add new Cappy header');
            assert.ok(gitignoreContent.includes('.cappy/history/'), 'Should ignore history folder');
            assert.ok(gitignoreContent.includes('.cappy/tasks/'), 'Should ignore tasks folder');
            assert.ok(gitignoreContent.includes('.cappy/history/'), 'Should ignore history folder');
            assert.ok(gitignoreContent.includes('.cappy/tasks/'), 'Should ignore tasks folder');

            console.log('✅ .gitignore update test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    // Removed project type inference test: init no longer infers project type
});
