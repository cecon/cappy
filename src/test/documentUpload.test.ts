/**
 * Simple test to verify LightRAG upload UI functionality
 */

import * as vscode from 'vscode';

export async function testDocumentUploadUI() {
    try {
        console.log('Testing LightRAG Document Upload UI...');
        
        // Test command registration
        const commands = await vscode.commands.getCommands();
        const uploadCommand = commands.find(cmd => cmd === 'cappy.lightrag.uploadUI');
        
        if (uploadCommand) {
            console.log('✅ Upload command is registered');
            
            // Test opening the UI
            try {
                await vscode.commands.executeCommand('cappy.lightrag.uploadUI');
                console.log('✅ Upload UI opened successfully');
            } catch (error) {
                console.error('❌ Failed to open upload UI:', error);
            }
        } else {
            console.error('❌ Upload command not found in registered commands');
        }
        
        // Test MCP commands
        const mcpCommands = [
            'cappy.lightrag.addDocument',
            'cappy.lightrag.processDocument',
            'cappy.lightrag.validateMetadata'
        ];
        
        for (const cmd of mcpCommands) {
            if (commands.includes(cmd)) {
                console.log(`✅ MCP command ${cmd} is registered`);
            } else {
                console.log(`⚠️  MCP command ${cmd} not found (may be registered separately)`);
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Test data for document upload
export const testDocumentData = {
    metadata: {
        title: 'Test Document',
        description: 'This is a test document for verifying the upload functionality',
        category: 'other',
        tags: ['test', 'verification', 'lightrag']
    },
    options: {
        extractEntities: true,
        extractRelationships: true,
        generateSummary: false,
        chunkText: true
    }
};

// Mock file data for testing
export const mockFileData = {
    filePath: '/mock/path/test-document.pdf',
    fileName: 'test-document.pdf',
    fileSize: 1024000, // 1MB
    fileExtension: '.pdf',
    lastModified: new Date()
};