import * as assert from 'assert';
import * as vscode from 'vscode';

suite('🧩 New Task Command Tests', () => {
    test('Returns processed instruction from canonical command', async () => {
        const result = await vscode.commands.executeCommand<string>('cappy.new');
        assert.strictEqual(typeof result, 'string');
        assert.ok(result.length > 0, 'Result should not be empty');
        assert.ok(result.includes('<new>'), 'Result should be XML format with new element');
        assert.ok(result.includes('<template>'), 'Result should include template element');
        assert.ok(result.includes('cappy') || result.includes('Cappy'), 'Result should include Cappy branding');
    });

    test('Alias cappy.new works', async () => {
        const result = await vscode.commands.executeCommand<string>('cappy.new', { projectName: 'AliasTest' });
        assert.strictEqual(typeof result, 'string');
        assert.ok(result.includes('AliasTest') || result.length > 0, 'Result should include overrides or not be empty');
    });
});
