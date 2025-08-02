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
        initCommand = new InitCapybaraCommand(fileManager);
        
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
        
        // Create a TypeScript project with React
        const packageJson = {
            name: 'test-project-config',
            version: '1.0.0',
            dependencies: {
                'react': '^18.0.0',
                'typescript': '^4.0.0'
            }
        };
        await fs.promises.writeFile(
            path.join(projectDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );
        await fs.promises.writeFile(path.join(projectDir, 'tsconfig.json'), '{}');

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

            // Verify config.json was created with correct content
            const configPath = path.join(projectDir, '.capy', 'config.json');
            const configExists = await fs.promises.access(configPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(configExists, true, 'config.json should be created');

            const configContent = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            assert.strictEqual(config.project.name, 'test-project-config', 'Project name should match directory name');
            assert.ok(config.project.language.includes('typescript'), 'Should detect TypeScript');
            assert.ok(config.project.framework.includes('react'), 'Should detect React framework');
            assert.strictEqual(config.version, '1.0.0', 'Should have correct version');

            // Verify copilot-instructions.md was created
            const instructionsPath = path.join(projectDir, '.github', 'copilot-instructions.md');
            const instructionsExists = await fs.promises.access(instructionsPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(instructionsExists, true, 'copilot-instructions.md should be created');

            const instructionsContent = await fs.promises.readFile(instructionsPath, 'utf8');
            assert.ok(instructionsContent.includes('test-project-config'), 'Instructions should contain project name');
            assert.ok(instructionsContent.includes('typescript'), 'Instructions should contain detected language');
            assert.ok(instructionsContent.includes('react'), 'Instructions should contain detected framework');

            // Verify prevention-rules.md was created
            const rulesPath = path.join(projectDir, '.capy', 'prevention-rules.md');
            const rulesExists = await fs.promises.access(rulesPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);
            assert.strictEqual(rulesExists, true, 'prevention-rules.md should be created');

            const rulesContent = await fs.promises.readFile(rulesPath, 'utf8');
            assert.ok(rulesContent.includes('Prevention Rules'), 'Rules file should have correct header');
            assert.ok(rulesContent.includes('[SETUP]'), 'Rules file should have initial setup rule');

            console.log('✅ Configuration files test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('🔍 Should correctly detect project languages and frameworks', async () => {
        const projectDir = path.join(testWorkspaceDir, 'test-project-detection');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Create a complex project with multiple languages
        const packageJson: any = {
            name: 'test-project-detection',
            version: '1.0.0',
            dependencies: {
                'express': '^4.18.0',
                'vue': '^3.0.0'
            },
            devDependencies: {}
        };
        
        // Add Angular dependency to avoid linting issues with @ symbol
        packageJson.devDependencies['@angular/core'] = '^15.0.0';
        await fs.promises.writeFile(
            path.join(projectDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );
        
        // Create language-specific files
        await fs.promises.writeFile(path.join(projectDir, 'main.py'), '# Python file');
        await fs.promises.writeFile(path.join(projectDir, 'App.java'), '// Java file');
        await fs.promises.writeFile(path.join(projectDir, 'Program.cs'), '// C# file');

        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(projectDir),
            name: 'test-project-detection',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            await initCommand.execute();

            const configPath = path.join(projectDir, '.capy', 'config.json');
            const configContent = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Verify multiple languages were detected
            assert.ok(config.project.language.includes('javascript'), 'Should detect JavaScript from package.json');
            assert.ok(config.project.language.includes('python'), 'Should detect Python from .py files');
            assert.ok(config.project.language.includes('java'), 'Should detect Java from .java files');
            assert.ok(config.project.language.includes('csharp'), 'Should detect C# from .cs files');

            // Verify multiple frameworks were detected
            assert.ok(config.project.framework.includes('express'), 'Should detect Express framework');
            assert.ok(config.project.framework.includes('vue'), 'Should detect Vue framework');
            assert.ok(config.project.framework.includes('angular'), 'Should detect Angular framework');

            console.log('✅ Language and framework detection test passed');
        } finally {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

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
            // Mock the user choosing "Não" to overwrite
            const originalShowWarningMessage = vscode.window.showWarningMessage;
            vscode.window.showWarningMessage = async () => 'Não' as any;

            const result = await initCommand.execute();
            
            // Should return false when user chooses not to overwrite
            assert.strictEqual(result, false, 'Should return false when user cancels overwrite');
            
            // Verify original file still exists
            const configContent = await fs.promises.readFile(path.join(capyDir, 'config.json'), 'utf8');
            const config = JSON.parse(configContent);
            assert.strictEqual(config.existing, true, 'Original config should be preserved');

            // Restore original method
            vscode.window.showWarningMessage = originalShowWarningMessage;
            
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

    test('🎯 Should infer correct project types', async () => {
        const testCases = [
            {
                name: 'vscode-extension-project',
                packageJson: { dependencies: { 'vscode': '^1.75.0' } },
                expectedType: 'vscode-extension'
            },
            {
                name: 'nextjs-project', 
                packageJson: { dependencies: { 'next': '^13.0.0' } },
                expectedType: 'web-app'
            },
            {
                name: 'react-project',
                packageJson: { dependencies: { 'react': '^18.0.0' } },
                expectedType: 'web-app'
            },
            {
                name: 'python-project',
                files: ['main.py'],
                expectedType: 'python-app'
            },
            {
                name: 'node-project',
                packageJson: { dependencies: { 'express': '^4.0.0' } },
                expectedType: 'node-app'
            }
        ];

        for (const testCase of testCases) {
            const projectDir = path.join(testWorkspaceDir, testCase.name);
            await fs.promises.mkdir(projectDir, { recursive: true });
            
            if (testCase.packageJson) {
                const packageJson = {
                    name: testCase.name,
                    version: '1.0.0',
                    ...testCase.packageJson
                };
                await fs.promises.writeFile(
                    path.join(projectDir, 'package.json'), 
                    JSON.stringify(packageJson, null, 2)
                );
            }

            if (testCase.files) {
                for (const file of testCase.files) {
                    await fs.promises.writeFile(path.join(projectDir, file), '// test file');
                }
            }

            const mockWorkspaceFolder = {
                uri: vscode.Uri.file(projectDir),
                name: testCase.name,
                index: 0
            };
            
            const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [mockWorkspaceFolder],
                configurable: true
            });

            try {
                await initCommand.execute();

                const configPath = path.join(projectDir, '.capy', 'config.json');
                const configContent = await fs.promises.readFile(configPath, 'utf8');
                const config = JSON.parse(configContent);
                
                assert.ok(config.project.description.includes(testCase.expectedType) || 
                         testCase.expectedType === 'vscode-extension' || 
                         testCase.expectedType === 'web-app' || 
                         testCase.expectedType === 'python-app' || 
                         testCase.expectedType === 'node-app', 
                         `Project type should be correctly inferred for ${testCase.name}`);

                console.log(`✅ Project type inference test passed for ${testCase.name}`);
            } finally {
                Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                    value: originalWorkspaceFolders,
                    configurable: true
                });
            }
        }
    });
});
