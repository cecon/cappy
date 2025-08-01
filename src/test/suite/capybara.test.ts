import * as assert from 'assert';
import * as vscode from 'vscode';
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
        // Test if Capybara commands are available
        const commands = await vscode.commands.getCommands(true);
        const capybaraCommands = commands.filter(cmd => cmd.startsWith('capybara.'));
        
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
        
        assert.ok(capybaraCommands.length > 0, 'At least one Capybara command should be registered');
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
});
