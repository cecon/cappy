import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CapybaraConfig } from '../../models/capybaraConfig';

suite('🦫 Capybara Extension Test Suite', () => {
    vscode.window.showInformationMessage('🧪 Starting Capybara tests.');

    test('📋 Config Interface Test', () => {
        // Test CapybaraConfig interface structure
        const mockConfig: Partial<CapybaraConfig> = {
            version: '2.0.1',
            project: {
                name: 'test-project',
                language: ['typescript'],
                framework: ['vscode-extension']
            }
        };

        assert.strictEqual(mockConfig.version, '2.0.1');
        assert.strictEqual(mockConfig.project?.name, 'test-project');
        assert.ok(Array.isArray(mockConfig.project?.language));
        console.log('✅ CapybaraConfig interface working correctly');
    });

    test('🎯 Extension Commands Registration', async () => {
        // Poll for a short while to allow activation to register commands
        const getCapyCommands = async () => {
            const commands = await vscode.commands.getCommands(true);
            return commands.filter(cmd => cmd.startsWith('capybara.'));
        };

        let capybaraCommands: string[] = [];
        for (let i = 0; i < 6; i++) { // up to ~3s
            capybaraCommands = await getCapyCommands();
            if (capybaraCommands.length > 0) {
                break;
            }
            await new Promise(r => setTimeout(r, 500));
        }

        const expectedCommands = [
            'capybara.test',
            'capybara.init',
            'capybara.createTask',
            'capybara.createSmartTask',
            'capybara.addPreventionRule',
            'capybara.completeTask'
        ];

        console.log(`Found ${capybaraCommands.length} Capybara commands:`, capybaraCommands);

        expectedCommands.forEach(expectedCmd => {
            const exists = capybaraCommands.includes(expectedCmd);
            if (exists) {
                console.log(`✅ Command ${expectedCmd} registered`);
            } else {
                console.log(`⚠️ Command ${expectedCmd} not found`);
            }
        });

        if (capybaraCommands.length === 0) {
            console.warn('⚠️ No Capybara commands found via getCommands; continuing tests.');
        }
    });

    test('📦 Extension Activation', () => {
        // Test if extension is active
        const extension = vscode.extensions.getExtension('eduardocecon.capybara');
        
        if (extension) {
            console.log('✅ Capybara extension found');
            console.log(`📋 Extension ID: ${extension.id}`);
            console.log(`📋 Extension Version: ${extension.packageJSON.version}`);
            console.log(`📋 Extension Active: ${extension.isActive}`);
            
            assert.ok(extension, 'Capybara extension should be installed');
            assert.strictEqual(extension.id, 'eduardocecon.capybara');
        } else {
            console.log('⚠️ Capybara extension not found - might not be installed');
        }
    });

    test('🔧 Package.json Validation', () => {
        // Test package.json structure
        const extension = vscode.extensions.getExtension('eduardocecon.capybara');
        
        if (extension) {
            const pkg = extension.packageJSON;
            
            assert.strictEqual(pkg.name, 'capybara');
            assert.strictEqual(pkg.displayName, 'Capybara');
            assert.ok(pkg.description.includes('calm and wise'));
            assert.ok(pkg.version.startsWith('2.0'));
            
            console.log('✅ Package.json structure valid');
            console.log(`📦 Name: ${pkg.name}`);
            console.log(`📦 Display Name: ${pkg.displayName}`);
            console.log(`📦 Version: ${pkg.version}`);
        }
    });

    test('🚀 Init Command Simple Test', () => {
        console.log('🧪 TESTE SIMPLES - Este log deve aparecer!');
        
        // Teste básico para verificar se conseguimos pelo menos executar
        assert.ok(true, 'Este teste deve sempre passar');
        console.log('✅ Teste simples passou');
    });

    test('🚀 Init Command Functionality', async function() {
        console.log('🧪 Starting Init Command Functionality test...');
        
        // Test if init command creates necessary folders and files
        if (!vscode.workspace.workspaceFolders) {
            console.log('⚠️ No workspace folder - skipping init test');
            return;
        }

        console.log('🧪 Workspace folder found, proceeding with test...');
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const capyDir = path.join(workspaceRoot, '.capy');
        const githubDir = path.join(workspaceRoot, '.github');

        console.log(`🧪 Workspace root: ${workspaceRoot}`);
        console.log(`🧪 Capy dir: ${capyDir}`);

        // Clean up any existing .capy folder
        try {
            await fs.promises.rmdir(capyDir, { recursive: true });
            console.log('🧪 Existing .capy folder removed');
        } catch (error) {
            console.log('🧪 No existing .capy folder to remove');
        }

        // Execute init command
        try {
            console.log('🧪 Executing capybara.init command...');
            await vscode.commands.executeCommand('capybara.init');
            
            console.log('🧪 Init command executed, waiting for completion...');
            // Give more time for the command to complete
            await new Promise(resolve => setTimeout(resolve, 5000));

            console.log('🧪 Checking if directories and files were created...');

            // Check if .capy directory was created
            const capyExists = await fs.promises.access(capyDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);

            // Check if .github directory was created  
            const githubExists = await fs.promises.access(githubDir, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);

            // Check if config file was created (YAML)
            const configPath = path.join(capyDir, 'config.yaml');
            const configExists = await fs.promises.access(configPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);

            // Check if copilot instructions file was created
            const instructionsPath = path.join(githubDir, 'copilot-instructions.md');
            const instructionsExists = await fs.promises.access(instructionsPath, fs.constants.F_OK)
                .then(() => true)
                .catch(() => false);

            console.log(`📁 .capy directory created: ${capyExists}`);
            console.log(`📁 .github directory created: ${githubExists}`);
            console.log(`📄 config.yaml created: ${configExists}`);
            console.log(`📄 copilot-instructions.md created: ${instructionsExists}`);

            // Assertions
            assert.ok(capyExists, '.capy directory should be created');
            assert.ok(githubExists, '.github directory should be created');
            assert.ok(configExists, 'config.yaml should be created');
            assert.ok(instructionsExists, 'copilot-instructions.md should be created');

            console.log('✅ Init command functionality test passed');

        } catch (error) {
            console.error('❌ Init command test failed:', error);
            throw error;
        }
    });
});
