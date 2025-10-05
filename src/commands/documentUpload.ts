import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getCappyRAGLanceDatabase, CappyRAGDocument, CappyRAGLanceDatabase } from '../store/cappyragLanceDb';

/**
 * Helper to get database instance with workspace path
 */
function getDatabase(): CappyRAGLanceDatabase {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder open');
    }
    return getCappyRAGLanceDatabase(workspaceFolders[0].uri.fsPath);
}

/**
 * CappyRAG Main Dashboard with Navigation and Document Management
 * Replicates exact CappyRAG WebUI design and functionality
 */
export async function openDocumentUploadUI(context: vscode.ExtensionContext, initialTab: string = 'documents') {
    const panel = vscode.window.createWebviewPanel(
        'CappyRAGDashboard',
        'CappyRAG - Knowledge Graph Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    // Initialize database
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const db = getCappyRAGLanceDatabase(workspaceFolders[0].uri.fsPath);
    await db.initialize();

    // Set the webview HTML content
    panel.webview.html = getWebviewContent(panel.webview);

    // Send initial data and initial tab
    try {
        const documents = await db.getDocumentsAsync();
        const stats = await db.getStatisticsAsync();
        
        panel.webview.postMessage({
            command: 'documentsLoaded',
            data: {
                documents,
                stats
            }
        });
        
        // Set initial active tab
        if (initialTab !== 'documents') {
            panel.webview.postMessage({
                command: 'switchTab',
                data: { tab: initialTab }
            });
        }
    } catch (error) {
        panel.webview.postMessage({
            command: 'loadError',
            data: { message: error instanceof Error ? error.message : 'Failed to initialize database' }
        });
    }

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'loadDocuments':
                    await handleLoadDocuments(panel);
                    break;
                case 'uploadDocument':
                    await handleDocumentUpload(message.data, panel);
                    break;
                case 'deleteDocument':
                    await handleDocumentDelete(message.data.id, panel);
                    break;
                case 'clearAllDocuments':
                    await handleClearAllDocuments(panel);
                    break;
                case 'generateDescription':
                    await handleGenerateDescription(message.data, panel);
                    break;
                case 'navigateToGraph':
                    await handleNavigateToGraph(context);
                    break;
                case 'navigateToRetrieval':
                    await handleNavigateToRetrieval(context);
                    break;
                case 'navigateToMcpDocs':
                    await handleNavigateToMcpDocs(context);
                    break;
                case 'getGraphData':
                    await handleGetGraphData(panel);
                    break;
                case 'showError':
                    vscode.window.showErrorMessage(message.data.message);
                    break;
                case 'showSuccess':
                    vscode.window.showInformationMessage(message.data.message);
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

async function handleLoadDocuments(panel: vscode.WebviewPanel) {
    try {
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        const stats = {
            documents: documents.length,
            entities: (await db.getEntitiesAsync()).length,
            relationships: (await db.getRelationshipsAsync()).length,
            chunks: (await db.getChunksAsync()).length
        };

        panel.webview.postMessage({
            command: 'documentsLoaded',
            data: {
                documents,
                stats
            }
        });
    } catch (error) {
        panel.webview.postMessage({
            command: 'loadError',
            data: { message: error instanceof Error ? error.message : 'Failed to load documents' }
        });
    }
}

async function handleDocumentUpload(data: any, panel: vscode.WebviewPanel) {
    try {
        const db = getDatabase();
        await db.initialize();
        
        // Create document object
        const newDocument: CappyRAGDocument = {
            id: generateDocumentId(),
            title: data.title,
            description: data.description || '',
            category: data.category || 'general',
            tags: [],
            filePath: data.fileName,
            fileName: data.fileName,
            fileSize: data.fileSize,
            content: data.content,
            status: 'processing',
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        // Add document to database
        await db.addDocument(newDocument);

        // Simulate processing and create graph entities
        setTimeout(async () => {
            newDocument.status = 'completed';
            
            // Extract simple entities from content (words that appear frequently)
            const words = data.content.split(/\W+/).filter((w: string) => w.length > 5);
            const wordFreq: { [key: string]: number } = {};
            words.forEach((word: string) => {
                const lower = word.toLowerCase();
                wordFreq[lower] = (wordFreq[lower] || 0) + 1;
            });
            
            // Get top entities
            const topEntities = Object.entries(wordFreq)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([word]) => word);
            
            // Create entities
            const createdEntities: string[] = [];
            for (const entity of topEntities) {
                const entityId = await db.addEntity({
                    name: entity.charAt(0).toUpperCase() + entity.slice(1),
                    type: 'keyword',
                    description: 'Extracted from ' + newDocument.title,
                    documentIds: [newDocument.id]
                });
                createdEntities.push(entityId);
            }
            
            // Create relationships between entities
            const createdRelationships = Math.floor(createdEntities.length / 2);
            for (let i = 0; i < createdRelationships; i++) {
                const sourceIdx = i;
                const targetIdx = (i + 1) % createdEntities.length;
                await db.addRelationship({
                    source: createdEntities[sourceIdx],
                    target: createdEntities[targetIdx],
                    type: 'co-occurs',
                    description: 'Found together in document',
                    weight: 1.0,
                    documentIds: [newDocument.id]
                });
            }
            
            // Create chunks
            const chunkSize = 1000;
            const chunks = Math.ceil(data.content.length / chunkSize);
            for (let i = 0; i < chunks; i++) {
                await db.addChunk({
                    documentId: newDocument.id,
                    content: data.content.substring(i * chunkSize, (i + 1) * chunkSize),
                    startPosition: i * chunkSize,
                    endPosition: Math.min((i + 1) * chunkSize, data.content.length),
                    chunkIndex: i,
                    entities: createdEntities.slice(0, 3),
                    relationships: []
                });
            }
            
            newDocument.processingResults = {
                entities: createdEntities.length,
                relationships: createdRelationships,
                chunks: chunks,
                processingTime: '00:02:15'
            };
            newDocument.updated = new Date().toISOString();
            
            panel.webview.postMessage({
                command: 'documentUpdated',
                data: newDocument
            });
        }, 3000);

        panel.webview.postMessage({
            command: 'documentAdded',
            data: newDocument
        });

        vscode.window.showInformationMessage(`Document "${data.title}" uploaded successfully`);
    } catch (error) {
        panel.webview.postMessage({
            command: 'uploadError',
            data: { message: error instanceof Error ? error.message : 'Failed to upload document' }
        });
        vscode.window.showErrorMessage('Failed to upload document');
    }
}

async function handleDocumentDelete(documentId: string, panel: vscode.WebviewPanel) {
    try {
        const db = getDatabase();
        await db.initialize();
        await db.deleteDocument(documentId);

        panel.webview.postMessage({
            command: 'documentDeleted',
            data: { id: documentId }
        });

        vscode.window.showInformationMessage('Document deleted successfully');
    } catch (error) {
        panel.webview.postMessage({
            command: 'deleteError',
            data: { message: error instanceof Error ? error.message : 'Failed to delete document' }
        });
        vscode.window.showErrorMessage('Failed to delete document');
    }
}

async function handleClearAllDocuments(panel: vscode.WebviewPanel) {
    try {
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        
        // Delete all documents
        for (const doc of documents) {
            await db.deleteDocument(doc.id);
        }

        panel.webview.postMessage({
            command: 'documentsCleared'
        });

        vscode.window.showInformationMessage('All documents cleared successfully');
    } catch (error) {
        vscode.window.showErrorMessage('Failed to clear documents');
    }
}

async function handleGetGraphData(panel: vscode.WebviewPanel) {
    try {
        console.log('[Backend] Getting graph data...');
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        const entities = await db.getEntitiesAsync();
        const relationships = await db.getRelationshipsAsync();
        const chunks = await db.getChunksAsync();
        
        console.log(`[Backend] Found: ${documents.length} docs, ${entities.length} entities, ${relationships.length} rels, ${chunks.length} chunks`);

        // Build graph data structure
        const nodes: any[] = [];
        const edges: any[] = [];

        // Add document nodes
        documents.forEach((doc: CappyRAGDocument) => {
            nodes.push({
                id: doc.id,
                label: doc.title,
                type: 'document',
                size: 15,
                color: '#10b981',
                metadata: {
                    category: doc.category,
                    status: doc.status,
                    created: doc.created,
                    fileName: doc.fileName
                }
            });
        });

        // Add entity nodes
        entities.forEach((entity: any) => {
            nodes.push({
                id: entity.id,
                label: entity.name,
                type: 'entity',
                size: 10,
                color: '#3b82f6',
                metadata: {
                    type: entity.type,
                    documentIds: entity.documentIds
                }
            });

            // Connect entity to its documents
            if (entity.documentIds && entity.documentIds.length > 0) {
                entity.documentIds.forEach((docId: string) => {
                    edges.push({
                        source: docId,
                        target: entity.id,
                        label: 'contains',
                        type: 'line',
                        size: 2
                    });
                });
            }
        });

        // Add relationship edges
        relationships.forEach((rel: any) => {
            edges.push({
                source: rel.source,
                target: rel.target,
                label: rel.type,
                type: 'line',
                size: 3,
                color: '#f97316'
            });
        });

        // Add chunk nodes (smaller, connected to documents)
        chunks.slice(0, 50).forEach((chunk: any) => { // Limit to 50 chunks for performance
            nodes.push({
                id: chunk.id,
                label: `Chunk ${chunk.chunkIndex}`,
                type: 'chunk',
                size: 5,
                color: '#8b5cf6',
                metadata: {
                    contentLength: chunk.content.length,
                    documentId: chunk.documentId,
                    entities: chunk.entities.length,
                    relationships: chunk.relationships.length
                }
            });

            // Connect chunk to its document
            if (chunk.documentId) {
                edges.push({
                    source: chunk.documentId,
                    target: chunk.id,
                    label: 'chunk',
                    type: 'line',
                    size: 1
                });
            }
        });

        console.log(`[Backend] Sending graph data: ${nodes.length} nodes, ${edges.length} edges`);
        panel.webview.postMessage({
            command: 'graphData',
            data: {
                nodes,
                edges
            }
        });

    } catch (error) {
        console.error('[Backend] Error loading graph data:', error);
        panel.webview.postMessage({
            command: 'graphData',
            data: { nodes: [], edges: [] }
        });
    }
}

async function handleGenerateDescription(data: any, panel: vscode.WebviewPanel) {
    try {
        const { fileName, fileExtension, fileSize, contentPreview, title, generateAll } = data;
        
        // Enhanced prompt for complete metadata generation
        const prompt = generateAll 
            ? `Analyze this document and generate complete metadata in JSON format:

File: ${fileName}
Type: ${fileExtension}
Size: ${(fileSize / 1024).toFixed(2)} KB
${title ? `Title: ${title}` : ''}
Lines: ${contentPreview.split('\n').length}
Words: ~${contentPreview.split(/\s+/).length}

Content preview (first 3000 chars):
${contentPreview}

Generate a JSON response with:
{
  "description": "2-3 sentence professional description of the document's purpose and content",
  "category": "single word category (e.g., Documentation, Code, Research, Tutorial, API, Configuration, Guide, Report)",
  "suggestedChunkSize": number (recommended chunk size for RAG: 500-2000 tokens based on content type),
  "reasoning": "brief explanation of chunking strategy for this document type"
}

Be concise and accurate. Choose chunk size based on content structure and density.`
            : `Analyze this file and generate a concise, informative description (2-3 sentences max):

File: ${fileName}
Type: ${fileExtension}
Size: ${(fileSize / 1024).toFixed(2)} KB
${title ? `Title: ${title}` : ''}

Content preview:
${contentPreview}

Generate a professional description focusing on the file's purpose, main topics, and key information.`;

        let result: any = { description: '' };
        
        try {
            // Use VS Code's language model API if available
            const models = await vscode.lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4o'
            });
            
            if (models && models.length > 0) {
                const model = models[0];
                const messages = [
                    vscode.LanguageModelChatMessage.User(prompt)
                ];
                
                const response = await model.sendRequest(messages, {
                    justification: 'Generating document description and category for CappyRAG indexing'
                });
                
                let fullResponse = '';
                for await (const part of response.text) {
                    fullResponse += part;
                }

                if (generateAll) {
                    // Try to parse JSON response
                    try {
                        // Extract JSON from markdown code blocks if present
                        const jsonMatch = fullResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                                         fullResponse.match(/(\{[\s\S]*\})/);
                        if (jsonMatch) {
                            result = JSON.parse(jsonMatch[1]);
                        } else {
                            throw new Error('No JSON found in response');
                        }
                    } catch (parseError) {
                        // Fallback if JSON parsing fails
                        result = {
                            description: fullResponse.trim(),
                            category: inferCategory(fileExtension, contentPreview),
                            suggestedChunkSize: calculateOptimalChunkSize(fileSize, contentPreview)
                        };
                    }
                } else {
                    result.description = fullResponse.trim();
                }
            } else {
                throw new Error('No language model available');
            }
        } catch (error) {
            // Fallback: Generate metadata based on file analysis
            result = generateFallbackMetadata(fileName, fileExtension, contentPreview, title, fileSize);
        }

        // Send the generated metadata back to the webview
        panel.webview.postMessage({
            command: 'descriptionGenerated',
            data: { 
                description: result.description || result,
                category: result.category,
                suggestedChunkSize: result.suggestedChunkSize,
                reasoning: result.reasoning
            }
        });

    } catch (error) {
        panel.webview.postMessage({
            command: 'descriptionGenerationError',
            data: { message: error instanceof Error ? error.message : 'Failed to generate description' }
        });
    }
}

function inferCategory(fileExtension: string, contentPreview: string): string {
    const ext = fileExtension.toLowerCase();
    const content = contentPreview.toLowerCase();
    
    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php'].includes(ext)) {
        return 'Code';
    }
    
    // Documentation
    if (['md', 'mdx'].includes(ext) || content.includes('# ') || content.includes('## ')) {
        return 'Documentation';
    }
    
    // Configuration
    if (['json', 'yaml', 'yml', 'toml', 'ini', 'conf', 'config'].includes(ext)) {
        return 'Configuration';
    }
    
    // API/OpenAPI
    if (content.includes('openapi') || content.includes('swagger') || content.includes('"paths"')) {
        return 'API';
    }
    
    // Research/Academic
    if (content.includes('abstract:') || content.includes('references:') || content.includes('bibliography')) {
        return 'Research';
    }
    
    // Tutorial/Guide
    if (content.includes('step ') || content.includes('tutorial') || content.includes('how to')) {
        return 'Tutorial';
    }
    
    return 'Documentation';
}

function calculateOptimalChunkSize(fileSize: number, contentPreview: string): number {
    const avgLineLength = contentPreview.split('\n')
        .filter(l => l.trim().length > 0)
        .reduce((sum, line) => sum + line.length, 0) / 
        Math.max(1, contentPreview.split('\n').filter(l => l.trim().length > 0).length);
    
    // Heuristics for optimal chunk size
    if (avgLineLength > 200) {
        // Dense content (long sentences, technical docs)
        return 1500;
    } else if (avgLineLength > 100) {
        // Medium density (normal paragraphs)
        return 1000;
    } else if (avgLineLength > 50) {
        // Code or structured content
        return 800;
    } else {
        // Short lines (lists, configs)
        return 500;
    }
}

function generateFallbackMetadata(fileName: string, fileExtension: string, contentPreview: string, title: string, fileSize: number): any {
    const ext = fileExtension.toLowerCase();
    const lines = contentPreview.split('\n').filter(l => l.trim().length > 0);
    const wordCount = contentPreview.split(/\s+/).length;
    
    let typeDescription = 'document';
    if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) {
        typeDescription = 'source code file';
    } else if (['md', 'txt', 'doc', 'docx'].includes(ext)) {
        typeDescription = 'text document';
    } else if (['json', 'xml', 'yaml', 'yml'].includes(ext)) {
        typeDescription = 'configuration file';
    } else if (['pdf'].includes(ext)) {
        typeDescription = 'PDF document';
    }
    
    const firstLine = lines[0] || '';
    const hasTitle = title && title.trim().length > 0;
    
    const description = `This is a ${typeDescription} ${hasTitle ? `titled "${title}"` : `named "${fileName}"`}. It contains approximately ${wordCount} words across ${lines.length} lines. ${firstLine ? `The content begins with: "${firstLine.substring(0, 100)}..."` : ''}`;
    
    return {
        description,
        category: inferCategory(fileExtension, contentPreview),
        suggestedChunkSize: calculateOptimalChunkSize(fileSize, contentPreview),
        reasoning: `Based on ${typeDescription} structure with average line length of ~${Math.round(firstLine.length)} characters`
    };
}

async function handleNavigateToGraph(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Knowledge Graph visualization will be implemented');
}

async function handleNavigateToRetrieval(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('Retrieval testing interface will be implemented');
}

async function handleNavigateToMcpDocs(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('MCP documentation will be implemented');
}

function generateDocumentId(): string {
    return 'doc-' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

export function getWebviewContent(webview: vscode.Webview): string {
    // Load HTML from external file
    const htmlPath = path.join(__dirname, 'cappyrag', 'templates', 'documentUpload.html');
    
    try {
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        return htmlContent;
    } catch (error) {
        console.error('Failed to load documentUpload.html:', error);
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Error</title>
            </head>
            <body>
                <h1>Error loading dashboard</h1>
                <p>Failed to load documentUpload.html from: ${htmlPath}</p>
                <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            </body>
            </html>
        `;
    }
}
