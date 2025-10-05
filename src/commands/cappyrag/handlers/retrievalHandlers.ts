import * as vscode from 'vscode';
import { getDatabase } from '../utils/databaseHelper';

/**
 * Handle query execution with retrieval
 */
export async function handleExecuteQuery(query: string, panel: vscode.WebviewPanel): Promise<void> {
    try {
        console.log('[Retrieval] Executing query:', query);
        
        const db = getDatabase();
        await db.initialize();
        
        // Step 1: Get all chunks
        const allChunks = await db.getChunksAsync();
        
        if (allChunks.length === 0) {
            panel.webview.postMessage({
                command: 'queryResult',
                data: {
                    answer: 'No documents have been indexed yet. Please upload and process documents first.',
                    context: [],
                    stats: { entities: 0, relationships: 0, chunks: 0 }
                }
            });
            return;
        }
        
        // Step 2: Simple keyword-based retrieval (BM25-like)
        const relevantChunks = rankChunksByRelevance(query, allChunks);
        const topChunks = relevantChunks.slice(0, 5); // Top 5 most relevant
        
        // Step 3: Get entities and relationships from relevant chunks
        const entities = await db.getEntitiesAsync();
        const relationships = await db.getRelationshipsAsync();
        
        // Filter entities that appear in top chunks
        const relevantEntityIds = new Set<string>();
        topChunks.forEach(chunk => {
            if (Array.isArray(chunk.entities)) {
                chunk.entities.forEach((entityId: string) => relevantEntityIds.add(entityId));
            }
        });
        
        const relevantEntities = entities.filter(e => relevantEntityIds.has(e.id));
        
        // Filter relationships between relevant entities
        const relevantRelationships = relationships.filter(r => 
            relevantEntityIds.has(r.source) && relevantEntityIds.has(r.target)
        );
        
        // Step 4: Use Copilot to generate answer
        const answer = await generateAnswerWithCopilot(query, topChunks, relevantEntities, relevantRelationships);
        
        // Step 5: Send results
        panel.webview.postMessage({
            command: 'queryResult',
            data: {
                answer,
                context: topChunks.map(chunk => ({
                    documentId: chunk.documentId,
                    content: chunk.content.substring(0, 200) + '...',
                    score: chunk.score || 0
                })),
                stats: {
                    entities: relevantEntities.length,
                    relationships: relevantRelationships.length,
                    chunks: topChunks.length
                }
            }
        });
        
    } catch (error) {
        console.error('[Retrieval] Query execution failed:', error);
        panel.webview.postMessage({
            command: 'queryResult',
            data: {
                answer: `Error executing query: ${error instanceof Error ? error.message : 'Unknown error'}`,
                context: [],
                stats: { entities: 0, relationships: 0, chunks: 0 }
            }
        });
    }
}

/**
 * Rank chunks by relevance to query (simple keyword matching)
 */
function rankChunksByRelevance(query: string, chunks: any[]): any[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    
    return chunks.map(chunk => {
        const content = chunk.content.toLowerCase();
        let score = 0;
        
        // Count keyword matches
        queryTerms.forEach(term => {
            const matches = (content.match(new RegExp(term, 'g')) || []).length;
            score += matches;
        });
        
        // Boost if terms appear close together
        const contentWords = content.split(/\s+/);
        queryTerms.forEach(term => {
            const index = contentWords.indexOf(term);
            if (index !== -1) {
                score += 2; // Exact word match bonus
            }
        });
        
        return { ...chunk, score };
    }).sort((a, b) => b.score - a.score);
}

/**
 * Generate answer using Copilot based on retrieved context
 */
async function generateAnswerWithCopilot(
    query: string,
    chunks: any[],
    entities: any[],
    relationships: any[]
): Promise<string> {
    try {
        // Check if Copilot is available
        const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
        });
        
        if (models.length === 0) {
            // Fallback: generate simple answer without Copilot
            return generateSimpleAnswer(query, chunks);
        }
        
        const model = models[0];
        
        // Build context from chunks
        const context = chunks.map((chunk, i) => 
            `[Chunk ${i + 1}]:\n${chunk.content}\n`
        ).join('\n');
        
        // Build entity context
        const entityContext = entities.length > 0 
            ? `\nRelevant entities: ${entities.map(e => `${e.name} (${e.type})`).join(', ')}`
            : '';
        
        // Build relationship context
        const relContext = relationships.length > 0
            ? `\nRelationships: ${relationships.map(r => {
                const source = entities.find(e => e.id === r.source);
                const target = entities.find(e => e.id === r.target);
                return `${source?.name || 'Unknown'} --[${r.type}]--> ${target?.name || 'Unknown'}`;
            }).join(', ')}`
            : '';
        
        const prompt = `You are a helpful assistant answering questions based on a knowledge base.

Question: ${query}

Context from documents:
${context}
${entityContext}
${relContext}

Please provide a clear, accurate answer based ONLY on the context provided above. If the context doesn't contain enough information to answer the question, say so.

Answer:`;

        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        
        const tokenSource = new vscode.CancellationTokenSource();
        const response = await model.sendRequest(messages, {
            justification: 'Querying CappyRAG knowledge base to retrieve relevant information'
        }, tokenSource.token);
        
        let answer = '';
        for await (const chunk of response.text) {
            answer += chunk;
        }
        
        return answer.trim() || 'I could not generate an answer based on the available context.';
        
    } catch (error) {
        console.error('[Retrieval] Copilot answer generation failed:', error);
        return generateSimpleAnswer(query, chunks);
    }
}

/**
 * Fallback: Generate simple answer without Copilot
 */
function generateSimpleAnswer(query: string, chunks: any[]): string {
    if (chunks.length === 0) {
        return 'No relevant information found in the knowledge base.';
    }
    
    return `Found ${chunks.length} relevant chunk(s) related to your query. Here's the most relevant content:\n\n${chunks[0].content.substring(0, 500)}...`;
}
