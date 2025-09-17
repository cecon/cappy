import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from '../../utils/fileManager';

suite('CopyXsdSchemas Test Suite', () => {
    let tempWorkspaceDir: string;
    let fileManager: FileManager;

    setup(async () => {
        // Create temporary workspace directory for testing
        tempWorkspaceDir = path.join(__dirname, '..', '..', '..', 'test-workspace-temp');
        
        // Ensure clean state
        if (fs.existsSync(tempWorkspaceDir)) {
            await fs.promises.rm(tempWorkspaceDir, { recursive: true, force: true });
        }
        
        // Create test workspace structure
        await fs.promises.mkdir(tempWorkspaceDir, { recursive: true });
        await fs.promises.mkdir(path.join(tempWorkspaceDir, '.cappy'), { recursive: true });
        
        fileManager = new FileManager();
    });

    teardown(async () => {
        // Clean up
        if (fs.existsSync(tempWorkspaceDir)) {
            try {
                await fs.promises.rm(tempWorkspaceDir, { recursive: true, force: true });
            } catch (error) {
                console.warn('Failed to clean up test workspace:', error);
            }
        }
    });

    test('should copy XSD schemas from extension resources to .cappy/schemas', async () => {
        // Mock workspace folder for this test
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(tempWorkspaceDir),
            name: 'test-workspace',
            index: 0
        };

        // Temporarily override workspace folders
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // Execute the function
            await fileManager.copyXsdSchemas();

            // Verify schemas directory was created
            const schemasDir = path.join(tempWorkspaceDir, '.cappy', 'schemas');
            assert.ok(fs.existsSync(schemasDir), 'Schemas directory should be created');

            // Verify XSD files were copied
            const schemaFiles = await fs.promises.readdir(schemasDir);
            const xsdFiles = schemaFiles.filter(file => file.endsWith('.xsd'));
            
            console.log(`Found ${xsdFiles.length} XSD files in schemas directory:`, xsdFiles);
            assert.ok(xsdFiles.length > 0, 'At least one XSD file should be copied');

            // Verify specific expected file exists
            const taskTemplateXsd = path.join(schemasDir, 'task-template.xsd');
            if (fs.existsSync(taskTemplateXsd)) {
                const content = await fs.promises.readFile(taskTemplateXsd, 'utf8');
                assert.ok(content.includes('<?xml'), 'XSD file should contain valid XML');
                assert.ok(content.includes('schema'), 'XSD file should contain schema definition');
                console.log('✅ task-template.xsd copied and validated');
            }

        } finally {
            // Restore original workspace folders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });

    test('should handle missing .cappy directory gracefully', async () => {
        // Create workspace without .cappy directory
        const testDir = path.join(__dirname, '..', '..', '..', 'test-workspace-no-cappy');
        
        if (fs.existsSync(testDir)) {
            await fs.promises.rm(testDir, { recursive: true, force: true });
        }
        
        await fs.promises.mkdir(testDir, { recursive: true });

        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(testDir),
            name: 'test-workspace-no-cappy',
            index: 0
        };

        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        try {
            // This should create .cappy/schemas directory and copy files
            await fileManager.copyXsdSchemas();

            // Verify .cappy/schemas was created
            const schemasDir = path.join(testDir, '.cappy', 'schemas');
            assert.ok(fs.existsSync(schemasDir), '.cappy/schemas directory should be created');

            console.log('✅ Successfully created .cappy/schemas and copied XSD files');

        } finally {
            // Cleanup
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
            
            if (fs.existsSync(testDir)) {
                await fs.promises.rm(testDir, { recursive: true, force: true });
            }
        }
    });

    test('should log extension path discovery process', async () => {
        // Mock workspace
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file(tempWorkspaceDir),
            name: 'test-workspace',
            index: 0
        };

        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [mockWorkspaceFolder],
            configurable: true
        });

        // Capture console output
        const originalConsoleLog = console.log;
        const logs: string[] = [];
        console.log = (...args: any[]) => {
            logs.push(args.join(' '));
            originalConsoleLog(...args);
        };

        try {
            await fileManager.copyXsdSchemas();

            // Check that extension path was discovered
            const extensionPathLogs = logs.filter(log => log.includes('[getExtensionPath]') || log.includes('[copyXsdSchemas]'));
            assert.ok(extensionPathLogs.length > 0, 'Should log extension path discovery process');

            console.log('📋 Extension path discovery logs:');
            extensionPathLogs.forEach(log => console.log(`  ${log}`));

        } finally {
            // Restore console.log
            console.log = originalConsoleLog;
            
            // Restore workspace folders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: originalWorkspaceFolders,
                configurable: true
            });
        }
    });
});