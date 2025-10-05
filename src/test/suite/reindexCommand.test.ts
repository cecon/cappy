import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReindexCommand } from '../../commands/reindexCommand';

suite('🔄 Reindex Command Test Suite', () => {
    let testWorkspaceDir: string;
    let reindexCommand: ReindexCommand;

    suiteSetup(async () => {
        console.log('🧪 Setting up Reindex test suite...');
        
        // Create a temporary workspace directory for testing
        testWorkspaceDir = path.join(os.tmpdir(), 'cappy-reindex-test-' + Date.now());
        await fs.promises.mkdir(testWorkspaceDir, { recursive: true });
        
        // Initialize command
        reindexCommand = new ReindexCommand();
        
        console.log(`✅ Test workspace created at: ${testWorkspaceDir}`);
    });

    suiteTeardown(async () => {
        console.log('🧹 Cleaning up Reindex test suite...');
        
        // Clean up test workspace
        try {
            await fs.promises.rm(testWorkspaceDir, { recursive: true, force: true });
            console.log('✅ Test workspace cleaned up');
        } catch (error) {
            console.warn(`⚠️ Could not clean up test workspace: ${error}`);
        }
    });

    test('🏗️ Should create index files structure', async () => {
        // Create a test project structure with Cappy initialized
        const projectDir = path.join(testWorkspaceDir, 'test-reindex-project');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Create .cappy directory structure
        const cappyDir = path.join(projectDir, '.cappy');
        const tasksDir = path.join(cappyDir, 'tasks');
        const historyDir = path.join(cappyDir, 'history');
        const indexesDir = path.join(cappyDir, 'indexes');
        
        await fs.promises.mkdir(tasksDir, { recursive: true });
        await fs.promises.mkdir(historyDir, { recursive: true });
        
        // Create docs directory
        const docsDir = path.join(projectDir, 'docs');
        const preventionDir = path.join(docsDir, 'prevention');
        await fs.promises.mkdir(preventionDir, { recursive: true });
        
        // Create test files
        const testTask = `<?xml version="1.0" encoding="UTF-8"?>
<task id="test-task" category="auth" priority="normal" status="pending"
      created="2025-01-15T10:30:00Z"
      xmlns="https://cappy-methodology.dev/task/1.0">
    <title>Test Authentication Task</title>
    <context>
        <description>Test task for authentication</description>
        <keywords>
            <keyword>auth</keyword>
            <keyword>test</keyword>
        </keywords>
    </context>
    <execution>
        <step id="implement-auth">Implement authentication</step>
    </execution>
</task>`;
        
        const testDoc = `# Authentication Guide

This is a test documentation file for authentication patterns.

## Features
- JWT tokens
- OAuth integration
- User management
`;

        const testRule = `# Authentication Rules

## Rule 1: JWT Validation
Always validate JWT tokens before processing requests.

## Rule 2: Error Handling
Implement proper error responses for auth failures.
`;

        await fs.promises.writeFile(path.join(tasksDir, 'TASK_TEST.ACTIVE.xml'), testTask, 'utf8');
        await fs.promises.writeFile(path.join(docsDir, 'auth-guide.md'), testDoc, 'utf8');
        await fs.promises.writeFile(path.join(preventionDir, 'auth-rules.md'), testRule, 'utf8');
        
        // Mock workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = [{
            uri: vscode.Uri.file(projectDir),
            name: 'test-project',
            index: 0
        }];
        
        try {
            // Execute reindex command
            const result = await reindexCommand.execute();
            
            // Verify the command succeeded
            assert.ok(result.includes('Reindexation completed successfully'), 
                `Expected success message, got: ${result}`);
            
            // Verify index files were created
            assert.ok(await pathExists(path.join(indexesDir, 'tasks.json')), 
                'tasks.json should be created');
            assert.ok(await pathExists(path.join(indexesDir, 'docs.json')), 
                'docs.json should be created');
            assert.ok(await pathExists(path.join(indexesDir, 'rules.json')), 
                'rules.json should be created');
            
            // Verify index content
            const tasksIndex = JSON.parse(await fs.promises.readFile(
                path.join(indexesDir, 'tasks.json'), 'utf8'));
            const docsIndex = JSON.parse(await fs.promises.readFile(
                path.join(indexesDir, 'docs.json'), 'utf8'));
            const rulesIndex = JSON.parse(await fs.promises.readFile(
                path.join(indexesDir, 'rules.json'), 'utf8'));
            
            // Verify tasks index
            assert.strictEqual(tasksIndex.tasks.length, 1, 'Should index 1 task');
            assert.strictEqual(tasksIndex.tasks[0].id, 'test-task', 'Should extract correct task ID');
            assert.strictEqual(tasksIndex.tasks[0].category, 'auth', 'Should extract correct category');
            assert.strictEqual(tasksIndex.tasks[0].type, 'task', 'Should have correct type');
            
            // Verify docs index
            assert.strictEqual(docsIndex.docs.length, 1, 'Should index 1 doc');
            assert.strictEqual(docsIndex.docs[0].title, 'Authentication Guide', 'Should extract correct title');
            assert.strictEqual(docsIndex.docs[0].category, 'auth', 'Should infer correct category');
            assert.strictEqual(docsIndex.docs[0].type, 'doc', 'Should have correct type');
            
            // Verify rules index
            assert.strictEqual(rulesIndex.rules.length, 1, 'Should index 1 rule');
            assert.strictEqual(rulesIndex.rules[0].title, 'Authentication Rules', 'Should extract correct title');
            assert.strictEqual(rulesIndex.rules[0].category, 'prevention', 'Should infer correct category');
            assert.strictEqual(rulesIndex.rules[0].type, 'rule', 'Should have correct type');
            
        } finally {
            // Restore original workspace folders
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        }
    });

    test('📊 Should handle empty workspace gracefully', async () => {
        // Mock no workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = undefined;
        
        try {
            const result = await reindexCommand.execute();
            assert.ok(result.includes('No workspace folder found'), 
                `Expected no workspace message, got: ${result}`);
        } finally {
            // Restore original workspace folders
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        }
    });

    test('🚫 Should handle uninitialized Cappy project', async () => {
        // Create a project without .cappy directory
        const projectDir = path.join(testWorkspaceDir, 'test-uninit-project');
        await fs.promises.mkdir(projectDir, { recursive: true });
        
        // Mock workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = [{
            uri: vscode.Uri.file(projectDir),
            name: 'test-uninit-project',
            index: 0
        }];
        
        try {
            const result = await reindexCommand.execute();
            assert.ok(result.includes('Cappy not initialized'), 
                `Expected uninitialized message, got: ${result}`);
        } finally {
            // Restore original workspace folders
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        }
    });

    test('🔍 Should extract keywords correctly', async () => {
        // Create a test project structure
        const projectDir = path.join(testWorkspaceDir, 'test-keywords-project');
        const cappyDir = path.join(projectDir, '.cappy');
        const indexesDir = path.join(cappyDir, 'indexes');
        const docsDir = path.join(projectDir, 'docs');
        
        await fs.promises.mkdir(indexesDir, { recursive: true });
        await fs.promises.mkdir(docsDir, { recursive: true });
        
        // Create a test document with various keywords
        const testDoc = `# API Development Guide

This document covers API development best practices.

## Database Integration
- Use proper connection pools
- Implement error handling
- Add authentication middleware

## Testing Strategy
- Unit tests for components
- Integration tests for endpoints
- UI testing for frontend

Keywords: REST, GraphQL, JWT, OAuth
`;

        await fs.promises.writeFile(path.join(docsDir, 'api-guide.md'), testDoc, 'utf8');
        
        // Mock workspace folders
        const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        (vscode.workspace as any).workspaceFolders = [{
            uri: vscode.Uri.file(projectDir),
            name: 'test-keywords-project',
            index: 0
        }];
        
        try {
            const result = await reindexCommand.execute();
            assert.ok(result.includes('Reindexation completed successfully'), 
                `Expected success message, got: ${result}`);
            
            // Verify keywords extraction
            const docsIndex = JSON.parse(await fs.promises.readFile(
                path.join(indexesDir, 'docs.json'), 'utf8'));
            
            assert.strictEqual(docsIndex.docs.length, 1, 'Should index 1 doc');
            
            const keywords = docsIndex.docs[0].keywords;
            assert.ok(keywords.includes('api'), 'Should extract "api" keyword');
            assert.ok(keywords.includes('database'), 'Should extract "database" keyword');
            assert.ok(keywords.includes('test'), 'Should extract "test" keyword');
            
        } finally {
            // Restore original workspace folders
            (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
        }
    });

    // Helper function to check if path exists
    async function pathExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
});
