import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InitCapybaraCommand } from '../../commands/initCapybara';
import { FileManager } from '../../utils/fileManager';

suite('🔨 InitCapybara Command Test Suite', () => {
    let testWorkspaceDir: string;
    let fileManager: FileManager;
    let initCommand: InitCapybaraCommand;

    suiteSetup(async () => {
        console.log('🧪 Setting up InitCapybara test suite...');
        
        // Create a temporary workspace directory for testing
        testWorkspaceDir = path.join(os.tmpdir(), 'capybara-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        // Initialize dependencies
        fileManager = new FileManager();
        initCommand = new InitCapybaraCommand();
        
        console.log(`✅ Test workspace created at: ${testWorkspaceDir}`);
    });

    suiteTeardown(async () => {
        console.log('🧹 Cleaning up InitCapybara test suite...');
        
        // Clean up test workspace
        try {
            await fs.promises.rm(testWorkspaceDir, { recursive: true, force: true });
            console.log('✅ Test workspace cleaned up');
        } catch (error) {
            console.warn(`⚠️ Could not clean up test workspace: ${error}`);
        }
    });

    test('🏗️ Should create basic Capybara directory structure', async () => {
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
            assert.strictEqual(result, true, 'InitCapybara command should return true on success');

            // Verify .capy directory was created
            const capyDir = path.join(projectDir, '.capy');
            const capyDirExists = await fs.promises.access(capyDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(capyDirExists, true, '.capy directory should be created');

            // Verify .github directory was created
            const githubDir = path.join(projectDir, '.github');
            const githubDirExists = await fs.promises.access(githubDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(githubDirExists, true, '.github directory should be created');

            // Verify history subdirectory was created
            const historyDir = path.join(capyDir, 'history');
            const historyDirExists = await fs.promises.access(historyDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(historyDirExists, true, '.capy/history directory should be created');

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
            const configPath = path.join(projectDir, '.capy', 'config.yaml');
            const configExists = await fs.promises.access(configPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(configExists, true, 'config.yaml should be created');

            const configContent = await fs.promises.readFile(configPath, 'utf8');
            assert.ok(/version:\s*"?\d+\.\d+\.\d+"?/m.test(configContent), 'config.yaml should contain version');

            // Verify copilot-instructions.md was created
            const instructionsPath = path.join(projectDir, '.github', 'copilot-instructions.md');
            const instructionsExists = await fs.promises.access(instructionsPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(instructionsExists, true, 'copilot-instructions.md should be created');

            const instructionsContent = await fs.promises.readFile(instructionsPath, 'utf8');
            assert.ok(/<!--\s*CAPY:CONFIG:BEGIN\s*-->[\s\S]*?<!--\s*CAPY:CONFIG:END\s*-->/m.test(instructionsContent), 'Should contain CAPY:CONFIG block');
            assert.ok(/validated:\s*false/m.test(instructionsContent), 'CAPY:CONFIG should set validated to false');
            // last-validated-at should be empty (no value)
            assert.ok(/last-validated-at:\s*$/m.test(instructionsContent) || /last-validated-at:\s*\n/m.test(instructionsContent), 'CAPY:CONFIG should have empty last-validated-at');

            // .gitignore should be created/updated
            const giPath = path.join(projectDir, '.gitignore');
            const giExists = await fs.promises.access(giPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(giExists, true, '.gitignore should exist');
            const giContent = await fs.promises.readFile(giPath, 'utf8');
            assert.ok(giContent.includes('# Capybara - Private AI Instructions'), 'gitignore should include header');
            assert.ok(giContent.includes('.github/copilot-instructions.md'), 'gitignore should ignore copilot instructions');

            console.log('✅ Configuration files test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    // Removed detection test: init no longer infers languages/frameworks

    test('🚫 Should handle workspace without folder gracefully', async () => {
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

    test('⚠️ Should handle existing Capybara installation', async () => {
        const projectDir = path.join(testWorkspaceDir, 'test-project-existing');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Create existing .capy directory
        const capyDir = path.join(projectDir, '.capy');
        await fs.promises.mkdir(capyDir, { recursive: true });
        await fs.promises.writeFile(path.join(capyDir, 'config.json'), '{"existing": true}');

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
            const yamlExists = await fs.promises.access(path.join(capyDir, 'config.yaml'), fs.constants.F_OK)
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
            assert.ok(gitignoreContent.includes('.github/copilot-instructions.md'), 'Should add Capybara entries');
            assert.ok(gitignoreContent.includes('# Capybara - Private AI Instructions'), 'Should add Capybara comment');

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
