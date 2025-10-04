import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { changeTaskStatus } from '../../commands/changeTaskStatus';

suite('Change Task Status Tests', () => {
    const testWorkspaceUri = vscode.Uri.file(path.join(__dirname, '../../../test-workspace'));
    const tasksDir = vscode.Uri.joinPath(testWorkspaceUri, '.cappy', 'tasks');

    setup(async () => {
        // Ensure test workspace and tasks directory exist
        try {
            await vscode.workspace.fs.createDirectory(testWorkspaceUri);
            await vscode.workspace.fs.createDirectory(tasksDir);
        } catch (error) {
            // Directory might already exist
        }
    });

    teardown(async () => {
        // Clean up test files
        try {
            const entries = await vscode.workspace.fs.readDirectory(tasksDir);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File && (name.includes('TEST_') || name.includes('test_'))) {
                    await vscode.workspace.fs.delete(vscode.Uri.joinPath(tasksDir, name));
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    test('should change task status from active to paused', async () => {
        // Create a test active task file
        const testTaskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="TEST_20250814_exemplo.ACTIVE" status="em-andamento">
    <meta>
        <created>2025-08-14T10:00:00.000Z</created>
        <updated>2025-08-14T10:00:00.000Z</updated>
        <file>TEST_20250814_exemplo.ACTIVE.xml</file>
        <priority>media</priority>
        <labels></labels>
        <estimate>30min</estimate>
    </meta>
    <title>Test Task</title>
    <description>Test task description</description>
    <area>desenvolvimento</area>
    <steps>
        <step id="1" status="pendente" required="true">
            <title>Test Step</title>
            <description>Test step description</description>
            <criteria>Test criteria</criteria>
        </step>
    </steps>
    <validation>
        <criteria>Test validation criteria</criteria>
        <evidence type="code">Test evidence</evidence>
    </validation>
    <progress>
        <completed-steps>0</completed-steps>
        <total-steps>1</total-steps>
        <percentage>0</percentage>
        <current-step>1</current-step>
    </progress>
</task>`;

        const testFileName = 'TEST_20250814_exemplo.ACTIVE.xml';
        const testFilePath = vscode.Uri.joinPath(tasksDir, testFileName);
        
        // Write test file
        await vscode.workspace.fs.writeFile(testFilePath, Buffer.from(testTaskContent, 'utf8'));

        // Change status to paused
        const result = await changeTaskStatus(testFileName, 'paused');

        // Verify result
        assert.ok(!result.startsWith('❌'), `Expected success but got: ${result}`);
        assert.ok(result.includes('TEST_20250814_exemplo.PAUSED.xml'), 'Result should contain new filename');

        // Verify old file is deleted
        try {
            await vscode.workspace.fs.stat(testFilePath);
            assert.fail('Old file should be deleted');
        } catch {
            // Expected - file should not exist
        }

        // Verify new file exists and has correct content
        const newFilePath = vscode.Uri.joinPath(tasksDir, 'TEST_20250814_exemplo.PAUSED.xml');
        const newFileContent = await vscode.workspace.fs.readFile(newFilePath);
        const newXmlContent = Buffer.from(newFileContent).toString('utf8');

        assert.ok(newXmlContent.includes('id="TEST_20250814_exemplo.PAUSED"'), 'ID should be updated');
        assert.ok(newXmlContent.includes('status="pausada"'), 'Status should be updated');
    });

    test('should change task status from paused to active', async () => {
        // Create a test paused task file
        const testTaskContent = `<?xml version="1.0" encoding="UTF-8"?>
<task id="TEST_20250814_paused.PAUSED" status="pausada">
    <meta>
        <created>2025-08-14T10:00:00.000Z</created>
        <updated>2025-08-14T10:00:00.000Z</updated>
        <file>TEST_20250814_paused.PAUSED.xml</file>
        <priority>media</priority>
        <labels></labels>
        <estimate>30min</estimate>
    </meta>
    <title>Test Paused Task</title>
    <description>Test paused task description</description>
    <area>desenvolvimento</area>
    <steps>
        <step id="1" status="pendente" required="true">
            <title>Test Step</title>
            <description>Test step description</description>
            <criteria>Test criteria</criteria>
        </step>
    </steps>
    <validation>
        <criteria>Test validation criteria</criteria>
        <evidence type="code">Test evidence</evidence>
    </validation>
    <progress>
        <completed-steps>0</completed-steps>
        <total-steps>1</total-steps>
        <percentage>0</percentage>
        <current-step>1</current-step>
    </progress>
</task>`;

        const testFileName = 'TEST_20250814_paused.PAUSED.xml';
        const testFilePath = vscode.Uri.joinPath(tasksDir, testFileName);
        
        // Write test file
        await vscode.workspace.fs.writeFile(testFilePath, Buffer.from(testTaskContent, 'utf8'));

        // Change status to active
        const result = await changeTaskStatus(testFileName, 'active');

        // Verify result
        assert.ok(!result.startsWith('❌'), `Expected success but got: ${result}`);
        assert.ok(result.includes('TEST_20250814_paused.ACTIVE.xml'), 'Result should contain new filename');

        // Verify old file is deleted
        try {
            await vscode.workspace.fs.stat(testFilePath);
            assert.fail('Old file should be deleted');
        } catch {
            // Expected - file should not exist
        }

        // Verify new file exists and has correct content
        const newFilePath = vscode.Uri.joinPath(tasksDir, 'TEST_20250814_paused.ACTIVE.xml');
        const newFileContent = await vscode.workspace.fs.readFile(newFilePath);
        const newXmlContent = Buffer.from(newFileContent).toString('utf8');

        assert.ok(newXmlContent.includes('id="TEST_20250814_paused.ACTIVE"'), 'ID should be updated');
        assert.ok(newXmlContent.includes('status="em-andamento"'), 'Status should be updated to em-andamento');
    });

    test('should handle non-existent file gracefully', async () => {
        const result = await changeTaskStatus('NON_EXISTENT_TASK.ACTIVE.xml', 'paused');
        assert.ok(result.startsWith('❌'), 'Should return error message');
        assert.ok(result.includes('não encontrado'), 'Error message should indicate file not found');
    });

    test('should handle invalid status gracefully', async () => {
        const result = await changeTaskStatus('TEST_task.ACTIVE.xml', 'invalid' as any);
        assert.ok(result.startsWith('❌'), 'Should return error message');
        assert.ok(result.includes("'active' ou 'paused'"), 'Error message should indicate valid status options');
    });
});
