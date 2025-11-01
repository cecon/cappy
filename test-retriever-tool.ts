/**
 * Test script for cappy_retrieve_context Language Model Tool
 * 
 * This script tests the context retrieval tool by simulating what the LLM does
 */

import * as vscode from 'vscode';

async function testRetrieverTool() {
    console.log('🧪 Testing cappy_retrieve_context tool...');
    
    try {
        // Get all available Language Model tools
        const allTools = vscode.lm.tools;
        console.log(`📋 Total Language Model tools available: ${allTools.length}`);
        console.log(`📋 Tools: ${allTools.map(t => t.name).join(', ')}`);
        
        // Find the cappy_retrieve_context tool
        const contextTool = allTools.find(t => t.name === 'cappy_retrieve_context');
        
        if (!contextTool) {
            console.error('❌ cappy_retrieve_context tool not found!');
            console.log('Available tools:', allTools.map(t => t.name));
            return;
        }
        
        console.log('✅ Found cappy_retrieve_context tool');
        console.log('📝 Tool description:', contextTool.description);
        
        // Test 1: Search for "HybridRetriever"
        console.log('\n🔍 Test 1: Searching for "HybridRetriever"...');
        const result1 = await vscode.lm.invokeTool(
            'cappy_retrieve_context',
            {
                query: 'HybridRetriever',
                maxResults: 5,
                minScore: 0.3,
                sources: ['code', 'documentation']
            },
            new vscode.CancellationTokenSource().token
        );
        
        console.log('📊 Result 1:');
        for await (const part of result1) {
            if (part instanceof vscode.LanguageModelTextPart) {
                console.log(part.value);
            }
        }
        
        // Test 2: Search for "database query"
        console.log('\n🔍 Test 2: Searching for "database query"...');
        const result2 = await vscode.lm.invokeTool(
            'cappy_retrieve_context',
            {
                query: 'database query',
                maxResults: 3,
                minScore: 0.5,
                sources: ['code']
            },
            new vscode.CancellationTokenSource().token
        );
        
        console.log('📊 Result 2:');
        for await (const part of result2) {
            if (part instanceof vscode.LanguageModelTextPart) {
                console.log(part.value);
            }
        }
        
        // Test 3: Search for "authentication"
        console.log('\n🔍 Test 3: Searching for "authentication"...');
        const result3 = await vscode.lm.invokeTool(
            'cappy_retrieve_context',
            {
                query: 'authentication',
                maxResults: 5,
                sources: ['code', 'documentation', 'prevention']
            },
            new vscode.CancellationTokenSource().token
        );
        
        console.log('📊 Result 3:');
        for await (const part of result3) {
            if (part instanceof vscode.LanguageModelTextPart) {
                console.log(part.value);
            }
        }
        
        console.log('\n✅ All tests completed!');
        
    } catch (error) {
        console.error('❌ Error testing tool:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
        }
    }
}

// Register command to run the test
export function registerTestCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        'cappy.testRetrieverTool',
        testRetrieverTool
    );
    
    context.subscriptions.push(disposable);
    console.log('✅ Registered command: cappy.testRetrieverTool');
}
