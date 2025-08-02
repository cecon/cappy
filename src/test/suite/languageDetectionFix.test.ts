import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InitCapybaraCommand } from '../../commands/initCapybara';
import { FileManager } from '../../utils/fileManager';

suite('🔍 Language Detection Fix Test', () => {
    let testWorkspaceDir: string;
    let fileManager: FileManager;
    let initCommand: InitCapybaraCommand;

    suiteSetup(async () => {
        console.log('🧪 Setting up Language Detection Fix test...');
        
        testWorkspaceDir = path.join(os.tmpdir(), 'capybara-lang-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        fileManager = new FileManager();
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

    test('🔍 Should correctly detect project languages and frameworks', async () => {
        console.log('🧪 Testing language and framework detection...');
        
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
        
        // Add Angular dependency to avoid linting issues
        packageJson.devDependencies['@angular/core'] = '^15.0.0';
        
        await fs.promises.writeFile(
            path.join(testWorkspaceDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );
        
        // Create language-specific files
        await fs.promises.writeFile(path.join(testWorkspaceDir, 'main.py'), '# Python file');
        await fs.promises.writeFile(path.join(testWorkspaceDir, 'App.java'), '// Java file');
        await fs.promises.writeFile(path.join(testWorkspaceDir, 'Program.cs'), '// C# file');

        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testWorkspaceDir),
            name: 'test-project-detection',
            index: 0
        };
        
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            console.log('🔨 Executing init command...');
            const result = await initCommand.execute();
            assert.strictEqual(result, true, 'Init command should succeed');

            console.log('📝 Checking generated config...');
            const configPath = path.join(testWorkspaceDir, '.capy', 'config.json');
            const configContent = await fs.promises.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);
            
            // Log the actual values for debugging
            console.log('Detected languages:', config.project.language);
            console.log('Detected frameworks:', config.project.framework);
            
            // Verify config.project.language is an array
            assert.ok(Array.isArray(config.project.language), 'Language should be an array');
            assert.ok(config.project.language.length > 0, 'Should detect at least one language');
            
            // Verify multiple languages were detected
            assert.ok(config.project.language.includes('javascript'), 'Should detect JavaScript from package.json');
            assert.ok(config.project.language.includes('python'), 'Should detect Python from .py files');
            assert.ok(config.project.language.includes('java'), 'Should detect Java from .java files');
            assert.ok(config.project.language.includes('csharp'), 'Should detect C# from .cs files');

            // Verify frameworks are arrays and contain expected values
            assert.ok(Array.isArray(config.project.framework), 'Framework should be an array');
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
});
