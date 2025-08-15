import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import createTaskFile from '../../commands/createTaskFile';

suite('CreateTaskFile Tests', () => {
    
    test('Should create task file with default values', async () => {
        // Arrange
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            assert.fail('No workspace folder found');
        }

        // Act
        const result = await createTaskFile();

        // Assert
        assert.ok(result.includes('✅ Arquivo de tarefa criado com sucesso'));
        assert.ok(result.includes('TASK_'));
        assert.ok(result.includes('<?xml version="1.0" encoding="UTF-8"?>'));
        assert.ok(result.includes('<task id="TASK_'));
        assert.ok(result.includes('status="em-andamento"'));
    });

    test('Should create task file with custom arguments', async () => {
        // Arrange
        const args = {
            title: 'Teste de Tarefa Customizada',
            description: 'Descrição personalizada',
            area: 'testes',
            priority: 'alta',
            estimate: '60min'
        };

        // Act
        const result = await createTaskFile(undefined, args);

        // Assert
        assert.ok(result.includes('Teste de Tarefa Customizada'));
        assert.ok(result.includes('Descrição personalizada'));
        assert.ok(result.includes('<area>testes</area>'));
        assert.ok(result.includes('<priority>alta</priority>'));
        assert.ok(result.includes('<estimate>60min</estimate>'));
    });

    test('Should create .cappy/tasks directory if not exists', async () => {
        // Arrange
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            assert.fail('No workspace folder found');
        }

        const tasksDir = path.join(workspaceRoot, '.cappy', 'tasks');

        // Act
        await createTaskFile();

        // Assert
        assert.ok(fs.existsSync(tasksDir), 'Tasks directory should be created');
    });

    test('Should generate unique task IDs and filenames', async () => {
        // Act
        const result1 = await createTaskFile();
        const result2 = await createTaskFile();

        // Assert
        const taskId1Match = result1.match(/🆔 Task ID: (TASK_\d+)/);
        const taskId2Match = result2.match(/🆔 Task ID: (TASK_\d+)/);
        
        assert.ok(taskId1Match, 'First task should have an ID');
        assert.ok(taskId2Match, 'Second task should have an ID');
        assert.notStrictEqual(taskId1Match[1], taskId2Match[1], 'Task IDs should be unique');
    });

    test('Should write result to output.txt', async () => {
        // Arrange
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            assert.fail('No workspace folder found');
        }

        const outputPath = path.join(workspaceRoot, '.cappy', 'output.txt');

        // Act
        await createTaskFile();

        // Assert
        assert.ok(fs.existsSync(outputPath), 'Output file should be created');
        
        const outputContent = fs.readFileSync(outputPath, 'utf8');
        assert.ok(outputContent.includes('✅ Arquivo de tarefa criado com sucesso'));
    });
});
