import * as vscode from 'vscode';
import { cleanOrphanedDataCommand } from './cappyrag/cleanOrphanedDataCommand';
import { getDatabase } from './cappyrag/utils/databaseHelper';

/**
 * Query the CappyRAG knowledge base
 */
async function queryKnowledgeBase(query: string, limit: number = 10): Promise<string> {
    try {
        const db = getDatabase();
        await db.initialize();
        
        // Get all chunks and do simple text search
        const allChunks = await db.getChunksAsync();
        
        if (allChunks.length === 0) {
            return 'No documents have been indexed yet. Please upload and process documents first.';
        }
        
        // Simple keyword search in chunk content
        const queryLower = query.toLowerCase();
        const relevantChunks = allChunks
            .filter(chunk => 
                chunk.content.toLowerCase().includes(queryLower) ||
                chunk.id.toLowerCase().includes(queryLower)
            )
            .slice(0, limit);
        
        if (relevantChunks.length === 0) {
            return `No chunks found matching "${query}". Total chunks available: ${allChunks.length}`;
        }
        
        // Format results
        let result = `Found ${relevantChunks.length} chunks matching "${query}":\n\n`;
        
        relevantChunks.forEach((chunk, index) => {
            result += `${index + 1}. **Chunk ID**: ${chunk.id}\n`;
            result += `   **Document**: ${chunk.documentId}\n`;
            result += `   **Content**: ${chunk.content.substring(0, 200)}${chunk.content.length > 200 ? '...' : ''}\n\n`;
        });
        
        return result;
        
    } catch (error) {
        console.error('Error querying knowledge base:', error);
        return `Error querying knowledge base: ${error}`;
    }
}

/**
 * Register all CappyRAG commands with VS Code
 */
export function registerCappyRAGCommands(context: vscode.ExtensionContext): void {
    // Register query command
    const queryCommand = vscode.commands.registerCommand(
        'cappy.query',
        queryKnowledgeBase
    );
    
    // Register cleanup command
    const cleanupCommand = vscode.commands.registerCommand(
        'cappy.CappyRAG.cleanOrphanedData',
        () => cleanOrphanedDataCommand(context)
    );
    
    context.subscriptions.push(queryCommand, cleanupCommand);
    
    console.log('CappyRAG commands registered (query, cleanup)');
}

// Placeholder functions
function registerContextMenuCommands(context: vscode.ExtensionContext): void {
    // Temporarily disabled
}

function registerKeybindings(context: vscode.ExtensionContext): void {
    // Temporarily disabled
}
