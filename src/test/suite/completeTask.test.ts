import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('CompleteTask Command Tests', () => {
    const testWorkspaceRoot = path.join(os.tmpdir(), `cappy-completetask-test-${Date.now()}`);
    
    setup(async () => {
        // Create test workspace structure
        fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        
        const cappyDir = path.join(testWorkspaceRoot, '.cappy');
        const tasksDir = path.join(cappyDir, 'tasks');
        const historyDir = path.join(cappyDir, 'history');
        
        fs.mkdirSync(cappyDir, { recursive: true });
        fs.mkdirSync(tasksDir, { recursive: true });
        fs.mkdirSync(historyDir, { recursive: true });
        
        // Create a sample active task file
        const activeTaskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task>
    <metadata>
        <id>TASK_20250814</id>
        <title>Test Task</title>
        <status>em-andamento</status>
        <created-at>2025-08-14T20:00:00.000Z</created-at>
        <file-name>TASK_20250814_.ACTIVE.xml</file-name>
    </metadata>
    <description>This is a test task</description>
    <steps>
        <step id="1" status="concluido">First step</step>
        <step id="2" status="concluido">Second step</step>
    </steps>
</task>`;
        
        fs.writeFileSync(
            path.join(tasksDir, 'TASK_20250814_.ACTIVE.xml'),
            activeTaskContent,
            'utf8'
        );
    });
    
    teardown(() => {
        // Clean up test workspace
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    test('Should move active task to history with correct naming', async () => {
        // Mock workspace
        const mockWorkspace = {
            workspaceFolders: [{
                uri: vscode.Uri.file(testWorkspaceRoot)
            }]
        };
        
        // Override vscode.workspace for this test
        const originalWorkspace = vscode.workspace;
        Object.defineProperty(vscode, 'workspace', {
            value: mockWorkspace,
            configurable: true
        });
        
        try {
            // Execute the completeTask command
            const result = await vscode.commands.executeCommand('cappy.completeTask');
            
            // Verify the task was moved to history
            const historyDir = path.join(testWorkspaceRoot, '.cappy', 'history');
            const historyFiles = fs.readdirSync(historyDir);
            
            assert.strictEqual(historyFiles.length, 1, 'Should have one file in history');
            assert.strictEqual(historyFiles[0], 'TASK_20250814_.DONE.xml', 'File should be renamed with .DONE.xml');
            
            // Verify the original file was removed from tasks
            const tasksDir = path.join(testWorkspaceRoot, '.cappy', 'tasks');
            const taskFiles = fs.readdirSync(tasksDir);
            
            assert.strictEqual(taskFiles.length, 0, 'Should have no files in tasks directory');
            
            // Verify the content was updated
            const historyFilePath = path.join(historyDir, 'TASK_20250814_.DONE.xml');
            const content = fs.readFileSync(historyFilePath, 'utf8');
            
            assert.ok(content.includes('<status>concluida</status>'), 'Status should be updated to "concluida"');
            assert.ok(content.includes('TASK_20250814_.DONE.xml'), 'Internal file reference should be updated');
            assert.ok(content.includes('<completed-at>'), 'Should have completion timestamp');
            
            // Verify output message format
            assert.ok(typeof result === 'string', 'Should return a string message');
            assert.ok(result.includes('✅'), 'Should indicate success');
            assert.ok(result.includes('TASK_20250814_.DONE.xml'), 'Should mention the new file name');
            assert.ok(result.includes('.cappy/history/'), 'Should mention the history path');
            
        } finally {
            // Restore original workspace
            Object.defineProperty(vscode, 'workspace', {
                value: originalWorkspace,
                configurable: true
            });
        }
    });

    test('Should handle case with no active tasks', async () => {
        // Remove the active task file
        const tasksDir = path.join(testWorkspaceRoot, '.cappy', 'tasks');
        fs.rmSync(tasksDir, { recursive: true });
        fs.mkdirSync(tasksDir, { recursive: true });
        
        // Mock workspace
        const mockWorkspace = {
            workspaceFolders: [{
                uri: vscode.Uri.file(testWorkspaceRoot)
            }]
        };
        
        const originalWorkspace = vscode.workspace;
        Object.defineProperty(vscode, 'workspace', {
            value: mockWorkspace,
            configurable: true
        });
        
        try {
            const result = await vscode.commands.executeCommand('cappy.completeTask');
            
            assert.ok(typeof result === 'string', 'Should return a string message');
            assert.ok(result.includes('❌'), 'Should indicate error');
            assert.ok(result.includes('Nenhuma tarefa ativa encontrada'), 'Should mention no active task found');
            
        } finally {
            Object.defineProperty(vscode, 'workspace', {
                value: originalWorkspace,
                configurable: true
            });
        }
    });

    test('Should handle case with no workspace', async () => {
        // Mock no workspace
        const mockWorkspace = {
            workspaceFolders: undefined
        };
        
        const originalWorkspace = vscode.workspace;
        Object.defineProperty(vscode, 'workspace', {
            value: mockWorkspace,
            configurable: true
        });
        
        try {
            const result = await vscode.commands.executeCommand('cappy.completeTask');
            
            assert.ok(typeof result === 'string', 'Should return a string message');
            assert.ok(result.includes('❌'), 'Should indicate error');
            assert.ok(result.includes('Nenhum workspace aberto'), 'Should mention no workspace');
            
        } finally {
            Object.defineProperty(vscode, 'workspace', {
                value: originalWorkspace,
                configurable: true
            });
        }
    });
});
