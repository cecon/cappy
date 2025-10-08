const vscode = require('vscode');

// Test the addDocument command
vscode.commands.executeCommand('cappy.mcp.addDocument', {
    filePath: 'd:\\projetos\\cappy-framework\\test-addDocument.md',
    title: 'Test Document via MCP',
    author: 'Test User',
    tags: ['test', 'mcp', 'addDocument'],
    resultFile: 'd:\\projetos\\cappy-framework\\test-result.json'
}).then(result => {
    console.log('Command executed successfully:', result);
}).catch(error => {
    console.error('Command failed:', error);
});