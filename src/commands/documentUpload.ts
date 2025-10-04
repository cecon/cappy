import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getLightRAGDatabase, LightRAGDocument } from '../store/lightragDb';

/**
 * LightRAG Main Dashboard with Navigation and Document Management
 * Replicates exact LightRAG WebUI design and functionality
 */
export async function openDocumentUploadUI(context: vscode.ExtensionContext, initialTab: string = 'documents') {
    const panel = vscode.window.createWebviewPanel(
        'lightragDashboard',
        'LightRAG - Knowledge Graph Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    // Initialize database
    const db = getLightRAGDatabase();

    // Set the webview HTML content
    panel.webview.html = getWebviewContent(panel.webview);

    // Send initial data and initial tab
    try {
        const documents = db.getDocuments();
        const stats = db.getStatistics();
        
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
        const db = getLightRAGDatabase();
        const documents = db.getDocuments();
        const stats = db.getStatistics();

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
        const db = getLightRAGDatabase();
        
        // Create document object
        const newDocument: LightRAGDocument = {
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
        db.addDocument(newDocument);

        // Simulate processing
        setTimeout(() => {
            newDocument.status = 'completed';
            newDocument.processingResults = {
                entities: Math.floor(Math.random() * 50) + 10,
                relationships: Math.floor(Math.random() * 30) + 5,
                chunks: Math.floor(data.content.length / 1000) + 1,
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
        const db = getLightRAGDatabase();
        db.deleteDocument(documentId);

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
        const db = getLightRAGDatabase();
        const documents = db.getDocuments();
        
        // Delete all documents
        documents.forEach(doc => {
            db.deleteDocument(doc.id);
        });

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
        const db = getLightRAGDatabase();
        const documents = db.getDocuments();
        const entities = db.getEntities();
        const relationships = db.getRelationships();
        const chunks = db.getChunks();

        // Build graph data structure
        const nodes: any[] = [];
        const edges: any[] = [];

        // Add document nodes
        documents.forEach(doc => {
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
        entities.forEach(entity => {
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
                entity.documentIds.forEach(docId => {
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
        relationships.forEach(rel => {
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
        chunks.slice(0, 50).forEach(chunk => { // Limit to 50 chunks for performance
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

        panel.webview.postMessage({
            command: 'graphData',
            data: {
                nodes,
                edges
            }
        });

    } catch (error) {
        console.error('Error loading graph data:', error);
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
                
                const response = await model.sendRequest(messages, {});
                
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

function getWebviewContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LightRAG - Knowledge Graph Dashboard</title>
    <style>
        /* Improved CSS Variables - Better Contrast */
        :root {
            --background: #f8f9fa;
            --foreground: #1f2937;
            --card: #ffffff;
            --card-foreground: #1f2937;
            --popover: #ffffff;
            --popover-foreground: #1f2937;
            --primary: #1f2937;
            --primary-foreground: #ffffff;
            --secondary: #e5e7eb;
            --secondary-foreground: #1f2937;
            --muted: #f3f4f6;
            --muted-foreground: #6b7280;
            --accent: #f3f4f6;
            --accent-foreground: #1f2937;
            --destructive: #ef4444;
            --destructive-foreground: #ffffff;
            --border: #e5e7eb;
            --input: #ffffff;
            --ring: #10b981;
            --success: #10b981;
            --success-foreground: #ffffff;
            --radius: 0.5rem;
        }

        /* Exact LightRAG WebUI Base Styles */
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--background);
            color: var(--foreground);
            line-height: 1.5;
        }

        /* Main Layout - Exact Structure */
        .main-container {
            display: flex;
            height: 100vh;
            width: 100vw;
            overflow: hidden;
        }

        .content-wrapper {
            display: flex;
            flex-grow: 1;
            flex-direction: column;
            overflow: hidden;
            margin: 0;
            padding: 0;
        }

        /* Header - Improved Contrast */
        .header {
            border-bottom: 1px solid var(--border);
            background: var(--card);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            position: sticky;
            top: 0;
            z-index: 50;
            display: flex;
            height: 40px;
            width: 100%;
            padding: 0 16px;
            align-items: center;
        }

        .header-left {
            min-width: 200px;
            width: auto;
            display: flex;
            align-items: center;
        }

        .logo-link {
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            color: inherit;
        }

        .logo-icon {
            width: 16px;
            height: 16px;
            color: #10b981;
        }

        .logo-text {
            font-weight: 700;
            font-size: 14px;
        }

        .header-center {
            display: flex;
            height: 40px;
            flex: 1;
            align-items: center;
            justify-content: center;
        }

        .tab-container {
            display: flex;
            height: 32px;
            align-self: center;
        }

        .tab-list {
            background-color: var(--muted);
            color: var(--muted-foreground);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            padding: 4px;
            height: 100%;
            gap: 4px;
            border: 1px solid var(--border);
        }

        .tab-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            padding: 6px 12px;
            transition: all 0.15s ease;
            cursor: pointer;
            border: none;
            background: transparent;
            color: var(--foreground);
        }

        .tab-trigger:hover {
            background-color: var(--accent);
        }

        .tab-trigger.active {
            background-color: #10b981;
            color: #ffffff;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .header-right {
            width: 200px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
        }

        .version-badge {
            font-size: 12px;
            color: #92400e;
            background-color: #fef3c7;
            border-radius: 6px;
            padding: 4px 8px;
            margin-left: 8px;
        }

        /* Content Area */
        .content-area {
            position: relative;
            flex-grow: 1;
        }

        .tab-content {
            height: 100%;
            width: 100%;
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            overflow: auto;
        }

        .tab-content.hidden {
            visibility: hidden;
        }

        .tab-content.visible {
            visibility: visible;
        }

        /* Document Management Panel */
        .document-panel {
            background-color: transparent;
            color: var(--card-foreground);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
            padding: 16px;
        }

        .panel-header {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 24px;
            padding-bottom: 8px;
            padding-top: 8px;
            padding-left: 24px;
            padding-right: 24px;
        }

        .panel-title {
            font-weight: 600;
            letter-spacing: -0.025em;
            font-size: 18px;
            line-height: 1;
        }

        .panel-content {
            padding: 24px;
            padding-top: 0;
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: auto;
        }

        /* Document Controls */
        .document-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .control-group-left {
            display: flex;
            gap: 8px;
        }

        .control-group-right {
            display: flex;
            gap: 8px;
        }

        /* Buttons */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            white-space: nowrap;
            font-size: 14px;
            font-weight: 500;
            border-radius: 6px;
            border: 1px solid var(--border);
            background-color: var(--card);
            color: var(--foreground);
            height: 36px;
            padding: 0 16px;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .btn:hover {
            background-color: var(--muted);
            border-color: var(--muted-foreground);
        }

        .btn-primary {
            background-color: #10b981;
            color: #ffffff;
            border-color: #10b981;
        }

        .btn-primary:hover {
            background-color: #059669;
            border-color: #059669;
        }

        .btn-secondary {
            background-color: var(--secondary);
            color: var(--foreground);
            border-color: var(--border);
        }

        .btn-secondary:hover {
            background-color: var(--muted);
        }

        .btn-icon {
            width: 16px;
            height: 16px;
        }

        /* Document Table */
        .document-table-container {
            background-color: var(--card);
            color: var(--card-foreground);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            flex: 1;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--border);
            border-radius: 8px;
            min-height: 0;
            margin-bottom: 8px;
        }

        .table-header {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 24px;
            flex: none;
            padding-bottom: 8px;
            padding-top: 8px;
            padding-left: 16px;
            padding-right: 16px;
        }

        .table-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .table-title {
            line-height: 1;
            font-weight: 600;
            letter-spacing: -0.025em;
        }

        .table-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status-filters {
            display: flex;
            gap: 4px;
        }

        .status-filter {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            white-space: nowrap;
            font-size: 14px;
            font-weight: 500;
            border-radius: 6px;
            height: 36px;
            padding: 0 12px;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid hsl(var(--border));
            background-color: hsl(var(--background));
        }

        .status-filter.active {
            background-color: #f3f4f6;
            border-color: #9ca3af;
            font-weight: 500;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .status-filter.success {
            color: #059669;
        }

        .status-filter.error {
            color: #dc2626;
        }

        .status-filter.processing {
            color: #6b7280;
        }

        /* Table */
        .table-scroll-container {
            flex: 1;
            position: relative;
            padding: 0;
        }

        .table-scroll-inner {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            padding: 0;
        }

        .table-border-container {
            position: absolute;
            inset: -1px;
            display: flex;
            flex-direction: column;
            padding: 0;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }

        .table-wrapper {
            position: relative;
            width: 100%;
            overflow: auto;
        }

        .data-table {
            width: 100%;
            font-size: 14px;
            border-collapse: collapse;
        }

        .table-head {
            position: sticky;
            top: 0;
            background-color: hsl(var(--background));
            z-index: 10;
            box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        }

        .table-head tr {
            border-bottom: 1px solid hsl(var(--border));
            background-color: hsl(var(--card) / 0.95);
            backdrop-filter: blur(12px);
            box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        }

        .table-head th {
            color: hsl(var(--muted-foreground));
            height: 40px;
            padding: 0 8px;
            text-align: left;
            vertical-align: middle;
            font-weight: 500;
            cursor: pointer;
        }

        .table-head th:hover {
            background-color: #f9fafb;
        }

        .table-body tr {
            border-bottom: 1px solid hsl(var(--border));
            transition: all 0.2s;
        }

        .table-body tr:hover {
            background-color: hsl(var(--muted) / 0.5);
        }

        .table-body td {
            padding: 8px;
            vertical-align: middle;
        }

        .text-truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 250px;
        }

        .font-mono {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        /* Status Indicators */
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status-text-success {
            color: #059669;
        }

        .status-text-error {
            color: #dc2626;
        }

        .status-text-processing {
            color: #d97706;
        }

        /* Icons */
        .icon {
            width: 16px;
            height: 16px;
            display: inline-block;
        }

        .icon-zap {
            color: #10b981;
        }

        /* Upload Modal Styles */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .modal-content {
            background: var(--card);
            border-radius: 12px;
            padding: 32px;
            width: 90%;
            max-width: 560px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from {
                transform: translateY(20px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }

        .modal-header {
            margin-bottom: 24px;
        }

        .modal-title {
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--foreground);
        }

        .modal-header p {
            color: var(--muted-foreground);
            margin: 0;
            font-size: 14px;
        }

        .upload-area {
            border: 2px dashed var(--border);
            border-radius: 12px;
            padding: 40px 24px;
            text-align: center;
            margin-bottom: 24px;
            cursor: pointer;
            transition: all 0.2s ease;
            background-color: var(--muted);
        }

        .upload-area:hover {
            border-color: var(--ring);
            background-color: rgba(16, 185, 129, 0.05);
        }

        .upload-area.dragover {
            border-color: var(--ring);
            background-color: rgba(16, 185, 129, 0.1);
            border-style: solid;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--foreground);
        }

        .form-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 14px;
            background-color: var(--input);
            color: var(--foreground);
            transition: border-color 0.15s ease;
        }

        .form-input:focus {
            outline: none;
            border-color: var(--ring);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .form-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 6px;
            font-size: 14px;
            min-height: 100px;
            resize: vertical;
            background-color: var(--input);
            color: var(--foreground);
            font-family: inherit;
            line-height: 1.5;
            transition: border-color 0.15s ease;
        }

        .form-textarea:focus {
            outline: none;
            border-color: var(--ring);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .modal-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
        }

        /* Toast Notifications */
        .toast-container {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .toast {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            min-width: 300px;
            max-width: 400px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: start;
            gap: 12px;
            animation: slideInRight 0.3s ease;
        }

        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .toast.success {
            border-left: 4px solid var(--success);
        }

        .toast.error {
            border-left: 4px solid var(--destructive);
        }

        .toast.info {
            border-left: 4px solid #3b82f6;
        }

        .toast-icon {
            flex-shrink: 0;
            width: 20px;
            height: 20px;
        }

        .toast-icon.success {
            color: var(--success);
        }

        .toast-icon.error {
            color: var(--destructive);
        }

        .toast-icon.info {
            color: #3b82f6;
        }

        .toast-content {
            flex: 1;
        }

        .toast-title {
            font-weight: 600;
            margin-bottom: 4px;
            font-size: 14px;
        }

        .toast-message {
            font-size: 13px;
            color: var(--muted-foreground);
        }

        .toast-close {
            cursor: pointer;
            opacity: 0.5;
            transition: opacity 0.2s;
        }

        .toast-close:hover {
            opacity: 1;
        }

        /* Upload Progress */
        .upload-progress {
            margin-top: 12px;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--muted);
        }

        .upload-progress-bar {
            height: 4px;
            background: var(--border);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 8px;
        }

        .upload-progress-fill {
            height: 100%;
            background: var(--success);
            transition: width 0.3s ease;
        }
    </style>
    
    <!-- Sigma.js and Graphology Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/graphology@0.25.4/dist/graphology.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/sigma@3.0.0-beta.20/build/sigma.min.js"></script>
</head>
<body>
    <!-- Toast Container -->
    <div id="toast-container" class="toast-container"></div>
    <main class="main-container">
        <div class="content-wrapper">
            <!-- Header -->
            <header class="header">
                <div class="header-left">
                    <a href="#" class="logo-link">
                        <svg class="logo-icon icon-zap" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>
                        </svg>
                        <span class="logo-text">LightRAG</span>
                    </a>
                </div>
                
                <div class="header-center">
                    <div class="tab-container">
                        <div class="tab-list">
                            <button class="tab-trigger active" onclick="switchTab('documents')">Documents</button>
                            <button class="tab-trigger" onclick="switchTab('knowledge-graph')">Knowledge Graph</button>
                            <button class="tab-trigger" onclick="switchTab('retrieval')">Retrieval</button>
                            <button class="tab-trigger" onclick="switchTab('api')">API</button>
                        </div>
                    </div>
                    <div class="version-badge">VS Code Extension</div>
                </div>
                
                <div class="header-right">
                    <!-- Right header content -->
                </div>
            </header>

            <!-- Content Area -->
            <div class="content-area">
                <!-- Documents Tab -->
                <div id="documents-tab" class="tab-content visible">
                    <div class="document-panel">
                        <div class="panel-header">
                            <h2 class="panel-title">Document Management</h2>
                        </div>
                        <div class="panel-content">
                            <div class="document-controls">
                                <div class="control-group-left">
                                    <button class="btn" onclick="refreshDocuments()">
                                        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Scan
                                    </button>
                                    <button class="btn">
                                        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        Pipeline Status
                                    </button>
                                </div>
                                <div class="control-group-right">
                                    <button class="btn" onclick="clearDocuments()">
                                        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Clear
                                    </button>
                                    <button class="btn btn-primary" onclick="openUploadModal()">
                                        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        Upload
                                    </button>
                                </div>
                            </div>

                            <div class="document-table-container">
                                <div class="table-header">
                                    <div class="table-title-row">
                                        <h3 class="table-title">Uploaded Documents</h3>
                                        <div class="table-controls">
                                            <div class="status-filters">
                                                <button class="status-filter active" onclick="filterDocuments('all')">All (<span id="count-all">0</span>)</button>
                                                <button class="status-filter success" onclick="filterDocuments('completed')">Completed (<span id="count-completed">0</span>)</button>
                                                <button class="status-filter processing" onclick="filterDocuments('processing')">Processing (<span id="count-processing">0</span>)</button>
                                                <button class="status-filter error" onclick="filterDocuments('failed')">Failed (<span id="count-failed">0</span>)</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="table-scroll-container">
                                    <div class="table-scroll-inner">
                                        <div class="table-border-container">
                                            <div class="table-wrapper">
                                                <table class="data-table">
                                                    <thead class="table-head">
                                                        <tr>
                                                            <th>ID</th>
                                                            <th>Title</th>
                                                            <th>Status</th>
                                                            <th>Size</th>
                                                            <th>Chunks</th>
                                                            <th>Created</th>
                                                            <th>Updated</th>
                                                            <th>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody class="table-body" id="documents-table-body">
                                                        <!-- Document rows will be populated here -->
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Knowledge Graph Tab -->
                <div id="knowledge-graph-tab" class="tab-content hidden">
                    <div style="display: flex; flex-direction: column; height: 100%; padding: 16px; gap: 16px;">
                        <!-- Graph Controls -->
                        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <button class="btn btn-secondary" onclick="loadGraph()">
                                        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Reload Graph
                                    </button>
                                    <button class="btn btn-secondary" onclick="resetGraphView()">
                                        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                        Reset View
                                    </button>
                                    <div style="border-left: 1px solid var(--border); height: 24px; margin: 0 4px;"></div>
                                    <label style="font-size: 14px; font-weight: 500; margin-right: 8px;">Layout:</label>
                                    <select id="graph-layout" class="form-input" style="width: 140px; padding: 6px 10px; height: 36px;" onchange="changeLayout()">
                                        <option value="force">Force-Directed</option>
                                        <option value="circular">Circular</option>
                                        <option value="random">Random</option>
                                    </select>
                                </div>
                                <div style="display: flex; gap: 12px; align-items: center; font-size: 13px; color: var(--muted-foreground);">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></div>
                                        <span>Documents (<span id="doc-count">0</span>)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%;"></div>
                                        <span>Entities (<span id="entity-count">0</span>)</span>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 50%;"></div>
                                        <span>Relationships (<span id="rel-count">0</span>)</span>
                                    </div>
                                </div>
                            </div>
                            <div style="margin-top: 12px;">
                                <input type="text" id="graph-search" class="form-input" placeholder="Search nodes..." style="width: 100%;" oninput="searchGraph(this.value)">
                            </div>
                        </div>

                        <!-- Graph Container -->
                        <div style="flex: 1; background: var(--card); border: 1px solid var(--border); border-radius: 8px; position: relative; overflow: hidden;">
                            <div id="graph-container" style="width: 100%; height: 100%;"></div>
                            <div id="graph-loading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.9);">
                                <div style="text-align: center;">
                                    <svg style="width: 48px; height: 48px; color: #10b981; animation: spin 1s linear infinite;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle style="opacity: 0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path style="opacity: 0.75;" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p style="margin-top: 16px; color: var(--muted-foreground);">Loading knowledge graph...</p>
                                </div>
                            </div>
                            <div id="graph-empty" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center;">
                                <div style="text-align: center; color: var(--muted-foreground);">
                                    <svg style="width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.5;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                    <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Knowledge Graph Data</h3>
                                    <p>Upload documents to build your knowledge graph</p>
                                </div>
                            </div>
                        </div>

                        <!-- Node Details Panel -->
                        <div id="node-details" style="display: none; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 12px;">
                                <h3 style="font-size: 16px; font-weight: 600; flex: 1;" id="node-title">Node Details</h3>
                                <button onclick="closeNodeDetails()" style="border: none; background: none; cursor: pointer; opacity: 0.5; padding: 0;">
                                    <svg style="width: 20px; height: 20px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div id="node-info" style="font-size: 14px;"></div>
                        </div>
                    </div>
                </div>

                <!-- Retrieval Tab -->
                <div id="retrieval-tab" class="tab-content hidden">
                    <div style="padding: 24px; text-align: center;">
                        <h2>Retrieval Testing Interface</h2>
                        <p>Query testing interface will be implemented here.</p>
                    </div>
                </div>

                <!-- API Tab -->
                <div id="api-tab" class="tab-content hidden">
                    <div style="padding: 24px; text-align: center;">
                        <h2>API Documentation</h2>
                        <p>API documentation will be implemented here.</p>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Upload Modal -->
    <div id="upload-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Upload Document</h3>
                <p>Upload a document to be processed by LightRAG</p>
            </div>
            
            <div class="upload-area" onclick="document.getElementById('file-input').click()">
                <svg style="width: 48px; height: 48px; color: #6b7280; margin-bottom: 16px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p style="font-size: 16px; margin-bottom: 8px;">Drop files here or click to select</p>
                <p style="font-size: 14px; color: #6b7280;">Supports: PDF, TXT, MD, DOC, DOCX</p>
                <input type="file" id="file-input" style="display: none;" accept=".pdf,.txt,.md,.doc,.docx" onchange="handleFileSelect(event)">
            </div>

            <div class="form-group">
                <label class="form-label">Title</label>
                <input type="text" id="document-title" class="form-input" placeholder="Enter document title">
            </div>

            <div class="form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <label class="form-label" style="margin-bottom: 0;">Description</label>
                    <button class="btn btn-secondary" onclick="askCopilotForDescription()" style="height: 28px; padding: 0 12px; font-size: 13px;" title="Generate description using Copilot">
                        <svg style="width: 14px; height: 14px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Ask Copilot
                    </button>
                </div>
                <textarea id="document-description" class="form-textarea" placeholder="Enter document description"></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Category</label>
                <input type="text" id="document-category" class="form-input" placeholder="e.g., Documentation, Code, Research">
            </div>

            <div id="chunk-info" style="display: none; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; margin-bottom: 16px;">
                <div style="display: flex; align-items: start; gap: 8px;">
                    <svg style="width: 16px; height: 16px; color: #0284c7; flex-shrink: 0; margin-top: 2px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 13px; color: #0c4a6e; margin-bottom: 4px;">Copilot Chunking Suggestion</div>
                        <div id="chunk-info-text" style="font-size: 12px; color: #075985;"></div>
                    </div>
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn" onclick="closeUploadModal()">Cancel</button>
                <button class="btn btn-primary" onclick="uploadDocument()">Upload</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let documents = [];
        let currentFilter = 'all';

        // Toast notification system
        function showToast(type, title, message, duration = 5000) {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            
            const iconSvg = type === 'success' 
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : type === 'error'
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
            
            toast.innerHTML = '<svg class="toast-icon ' + type + '" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
                    iconSvg +
                '</svg>' +
                '<div class="toast-content">' +
                    '<div class="toast-title">' + title + '</div>' +
                    (message ? '<div class="toast-message">' + message + '</div>' : '') +
                '</div>' +
                '<svg class="toast-close" width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" onclick="this.parentElement.remove()">' +
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />' +
                '</svg>';
            
            container.appendChild(toast);
            
            if (duration > 0) {
                setTimeout(function() {
                    toast.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(function() { toast.remove(); }, 300);
                }, duration);
            }
        }

        // Tab switching
        function switchTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('visible');
                tab.classList.add('hidden');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.remove('hidden');
            document.getElementById(tabName + '-tab').classList.add('visible');
            
            // Update tab buttons
            document.querySelectorAll('.tab-trigger').forEach(trigger => {
                trigger.classList.remove('active');
            });
            event.target.classList.add('active');

            // Send navigation event to VS Code
            vscode.postMessage({
                command: 'navigate' + tabName.charAt(0).toUpperCase() + tabName.slice(1).replace('-', ''),
                data: { tab: tabName }
            });
        }

        // Document management functions
        function refreshDocuments() {
            vscode.postMessage({ command: 'loadDocuments' });
        }

        function clearDocuments() {
            if (confirm('Are you sure you want to clear all documents? This action cannot be undone.')) {
                vscode.postMessage({ command: 'clearAllDocuments' });
            }
        }

        function filterDocuments(filter) {
            currentFilter = filter;
            
            // Update active filter button
            document.querySelectorAll('.status-filter').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            renderDocuments();
        }

        function deleteDocument(documentId) {
            if (confirm('Are you sure you want to delete this document?')) {
                vscode.postMessage({
                    command: 'deleteDocument',
                    data: { id: documentId }
                });
            }
        }

        // Upload modal functions
        function openUploadModal() {
            document.getElementById('upload-modal').style.display = 'flex';
            // Initialize drag and drop after modal is visible
            setTimeout(() => initDragAndDrop(), 100);
        }

        function closeUploadModal() {
            document.getElementById('upload-modal').style.display = 'none';
            // Reset form
            document.getElementById('file-input').value = '';
            document.getElementById('document-title').value = '';
            document.getElementById('document-description').value = '';
            document.getElementById('document-category').value = '';
            // Hide chunk info
            const chunkInfo = document.getElementById('chunk-info');
            if (chunkInfo) {
                chunkInfo.style.display = 'none';
            }
        }

        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file) {
                // Auto-fill title if empty
                if (!document.getElementById('document-title').value) {
                    document.getElementById('document-title').value = file.name.replace(/\.[^/.]+$/, '');
                }
            }
        }

        async function askCopilotForDescription() {
            const fileInput = document.getElementById('file-input');
            const titleInput = document.getElementById('document-title');
            const descriptionTextarea = document.getElementById('document-description');
            const categoryInput = document.getElementById('document-category');
            
            if (!fileInput.files[0]) {
                showToast('error', 'No File Selected', 'Please select a file first');
                return;
            }

            const file = fileInput.files[0];
            const fileName = file.name;
            const fileExtension = fileName.split('.').pop().toLowerCase();
            
            // Show loading state for all fields
            const originalDesc = descriptionTextarea.value;
            const originalCategory = categoryInput.value;
            descriptionTextarea.value = '⏳ Asking Copilot to analyze...';
            descriptionTextarea.disabled = true;
            categoryInput.value = '⏳ Analyzing...';
            categoryInput.disabled = true;
            
            showToast('info', 'Analyzing Document', 'Copilot is analyzing your file...');
            
            try {
                // Read file content (first 3000 chars for better analysis)
                const reader = new FileReader();
                reader.onload = function(e) {
                    const content = e.target.result;
                    const preview = content.substring(0, 3000);
                    
                    // Send request to backend to generate all metadata
                    vscode.postMessage({
                        command: 'generateDescription',
                        data: {
                            fileName: fileName,
                            fileExtension: fileExtension,
                            fileSize: file.size,
                            contentPreview: preview,
                            title: titleInput.value,
                            generateAll: true
                        }
                    });
                };
                reader.readAsText(file);
            } catch (error) {
                descriptionTextarea.value = originalDesc;
                descriptionTextarea.disabled = false;
                categoryInput.value = originalCategory;
                categoryInput.disabled = false;
                showToast('error', 'Analysis Failed', error.message);
            }
        }

        function uploadDocument() {
            const fileInput = document.getElementById('file-input');
            const title = document.getElementById('document-title').value;
            const description = document.getElementById('document-description').value;
            const category = document.getElementById('document-category').value;

            if (!fileInput.files[0]) {
                showToast('error', 'No File Selected', 'Please select a file to upload');
                return;
            }

            if (!title.trim()) {
                showToast('error', 'Title Required', 'Please enter a document title');
                return;
            }

            const file = fileInput.files[0];
            
            // Show upload progress toast
            showToast('info', 'Uploading...', 'Uploading "' + file.name + '"', 0);
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                vscode.postMessage({
                    command: 'uploadDocument',
                    data: {
                        fileName: file.name,
                        title: title.trim(),
                        description: description.trim(),
                        category: category.trim() || 'general',
                        content: e.target.result,
                        fileSize: file.size,
                        fileType: file.type
                    }
                });
                closeUploadModal();
            };
            
            reader.onerror = function() {
                showToast('error', 'Upload Failed', 'Failed to read file content');
            };
            
            reader.readAsText(file);
        }

        // Render documents table
        function renderDocuments() {
            const tableBody = document.getElementById('documents-table-body');
            const filteredDocs = documents.filter(doc => {
                if (currentFilter === 'all') return true;
                return doc.status === currentFilter;
            });

            tableBody.innerHTML = '';

            if (filteredDocs.length === 0) {
                tableBody.innerHTML = \`
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 48px; color: #6b7280;">
                            No documents found. Upload your first document to get started.
                        </td>
                    </tr>
                \`;
                return;
            }

            filteredDocs.forEach(doc => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td>
                        <div class="text-truncate font-mono" title="\${doc.id}">
                            \${doc.id}
                        </div>
                    </td>
                    <td>
                        <div class="text-truncate" title="\${doc.title}">
                            \${doc.title}
                        </div>
                    </td>
                    <td>
                        <div class="status-indicator">
                            <span class="status-text-\${doc.status === 'completed' ? 'success' : doc.status === 'failed' ? 'error' : 'processing'}">
                                \${doc.status === 'completed' ? 'Completed' : doc.status === 'failed' ? 'Failed' : 'Processing'}
                            </span>
                        </div>
                    </td>
                    <td>\${formatFileSize(doc.fileSize)}</td>
                    <td>\${doc.processingResults?.chunks || '-'}</td>
                    <td>\${formatDate(doc.created)}</td>
                    <td>\${formatDate(doc.updated)}</td>
                    <td>
                        <button class="btn" onclick="deleteDocument('\${doc.id}')" style="padding: 4px 8px; height: 28px;">
                            <svg class="btn-icon" style="width: 12px; height: 12px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                \`;
                tableBody.appendChild(row);
            });

            updateDocumentCounts();
        }

        function updateDocumentCounts() {
            const counts = {
                all: documents.length,
                completed: documents.filter(d => d.status === 'completed').length,
                processing: documents.filter(d => d.status === 'processing').length,
                failed: documents.filter(d => d.status === 'failed').length
            };

            document.getElementById('count-all').textContent = counts.all;
            document.getElementById('count-completed').textContent = counts.completed;
            document.getElementById('count-processing').textContent = counts.processing;
            document.getElementById('count-failed').textContent = counts.failed;
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ', ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        // Drag and drop support - Initialize when modal opens
        function initDragAndDrop() {
            const uploadArea = document.querySelector('.upload-area');
            if (!uploadArea) return;
            
            const preventDefaults = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            const highlight = () => {
                uploadArea.classList.add('dragover');
            };

            const unhighlight = () => {
                uploadArea.classList.remove('dragover');
            };

            const handleDrop = (e) => {
                const dt = e.dataTransfer;
                const files = dt?.files;

                if (files && files.length > 0) {
                    const fileInput = document.getElementById('file-input');
                    fileInput.files = files;
                    handleFileSelect({ target: { files: files } });
                }
            };
            
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, preventDefaults, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                uploadArea.addEventListener(eventName, highlight, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                uploadArea.addEventListener(eventName, unhighlight, false);
            });

            uploadArea.addEventListener('drop', handleDrop, false);
        }

        // Message handling from VS Code
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'documentsLoaded':
                    documents = message.data.documents || [];
                    renderDocuments();
                    break;
                    
                case 'switchTab':
                    const tabName = message.data.tab;
                    // Hide all tabs
                    document.querySelectorAll('.tab-content').forEach(tab => {
                        tab.classList.remove('visible');
                        tab.classList.add('hidden');
                    });
                    // Show selected tab
                    const targetTab = document.getElementById(tabName + '-tab');
                    if (targetTab) {
                        targetTab.classList.remove('hidden');
                        targetTab.classList.add('visible');
                    }
                    // Update tab buttons
                    document.querySelectorAll('.tab-trigger').forEach(trigger => {
                        trigger.classList.remove('active');
                        if (trigger.textContent.toLowerCase().replace(' ', '-') === tabName) {
                            trigger.classList.add('active');
                        }
                    });
                    break;
                    
                case 'documentAdded':
                    documents.push(message.data);
                    renderDocuments();
                    showToast('success', 'Document Uploaded', '"' + message.data.title + '" is now being processed');
                    break;
                    
                case 'documentUpdated':
                    const index = documents.findIndex(d => d.id === message.data.id);
                    if (index !== -1) {
                        documents[index] = message.data;
                        renderDocuments();
                    }
                    break;
                    
                case 'documentDeleted':
                    documents = documents.filter(d => d.id !== message.data.id);
                    renderDocuments();
                    break;
                    
                case 'documentsCleared':
                    documents = [];
                    renderDocuments();
                    break;
                    
                case 'descriptionGenerated':
                    const descTextarea = document.getElementById('document-description');
                    const categoryInput = document.getElementById('document-category');
                    const chunkInfo = document.getElementById('chunk-info');
                    const chunkInfoText = document.getElementById('chunk-info-text');
                    
                    if (descTextarea) {
                        descTextarea.value = message.data.description;
                        descTextarea.disabled = false;
                    }
                    if (categoryInput && message.data.category) {
                        categoryInput.value = message.data.category;
                        categoryInput.disabled = false;
                    }
                    if (chunkInfo && chunkInfoText && message.data.suggestedChunkSize) {
                        const chunkSize = message.data.suggestedChunkSize;
                        const reasoning = message.data.reasoning || 'Optimized for RAG processing';
                        chunkInfoText.innerHTML = '<strong>Suggested chunk size:</strong> ' + chunkSize + ' tokens. ' + reasoning;
                        chunkInfo.style.display = 'block';
                    }
                    showToast('success', 'Analysis Complete', 'Document metadata generated by Copilot');
                    break;
                    
                case 'descriptionGenerationError':
                    const errorTextarea = document.getElementById('document-description');
                    const errorCategory = document.getElementById('document-category');
                    if (errorTextarea) {
                        errorTextarea.disabled = false;
                    }
                    if (errorCategory) {
                        errorCategory.disabled = false;
                    }
                    showToast('error', 'Analysis Failed', message.data.message);
                    break;
                    
                case 'loadError':
                    console.error('Load error:', message.data.message);
                    document.getElementById('documents-table-body').innerHTML = \`
                        <tr>
                            <td colspan="8" style="text-align: center; padding: 48px; color: #dc2626;">
                                Error loading documents: \${message.data.message}
                            </td>
                        </tr>
                    \`;
                    break;
            }
        });

        // Close modal when clicking outside
        document.getElementById('upload-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeUploadModal();
            }
        });

        // Load initial data
        document.addEventListener('DOMContentLoaded', function() {
            refreshDocuments();
        });

        // ================== KNOWLEDGE GRAPH VISUALIZATION (SIGMA.JS) ==================
        let graphRenderer = null;
        let graphData = null;
        let currentLayout = 'force';

        // Load and display the knowledge graph
        async function loadGraph() {
            const container = document.getElementById('graph-container');
            const loading = document.getElementById('graph-loading');
            const empty = document.getElementById('graph-empty');
            
            // Show loading state
            loading.style.display = 'flex';
            empty.style.display = 'none';
            container.innerHTML = '';

            try {
                // Request graph data from extension
                vscode.postMessage({ command: 'getGraphData' });
            } catch (error) {
                console.error('Error loading graph:', error);
                showToast('error', 'Graph Error', 'Failed to load knowledge graph: ' + error.message);
                loading.style.display = 'none';
                empty.style.display = 'flex';
            }
        }

        // Render the graph with Sigma.js
        function renderGraph(data) {
            const container = document.getElementById('graph-container');
            const loading = document.getElementById('graph-loading');
            const empty = document.getElementById('graph-empty');

            if (!data || (!data.nodes || data.nodes.length === 0)) {
                loading.style.display = 'none';
                empty.style.display = 'flex';
                container.innerHTML = '';
                return;
            }

            graphData = data;
            
            // Hide loading/empty states
            loading.style.display = 'none';
            empty.style.display = 'none';

            try {
                // Create a new graph using Graphology
                const graph = new graphology.Graph();

                // Add nodes
                data.nodes.forEach(node => {
                    graph.addNode(node.id, {
                        label: node.label,
                        size: node.size || 10,
                        color: node.color || getNodeColor(node.type),
                        x: Math.random() * 100,
                        y: Math.random() * 100,
                        type: node.type,
                        metadata: node.metadata || {}
                    });
                });

                // Add edges
                data.edges.forEach(edge => {
                    try {
                        graph.addEdge(edge.source, edge.target, {
                            label: edge.label || '',
                            type: edge.type || 'line',
                            size: edge.size || 2,
                            color: '#94a3b8'
                        });
                    } catch (e) {
                        console.warn('Failed to add edge:', edge, e);
                    }
                });

                // Apply layout
                applyGraphLayout(graph, currentLayout);

                // Clear container and create Sigma renderer
                container.innerHTML = '';
                graphRenderer = new Sigma(graph, container, {
                    renderLabels: true,
                    renderEdgeLabels: false,
                    labelSize: 12,
                    labelWeight: 'bold',
                    defaultNodeColor: '#64748b',
                    defaultEdgeColor: '#94a3b8',
                    minCameraRatio: 0.1,
                    maxCameraRatio: 10
                });

                // Add interaction handlers
                graphRenderer.on('clickNode', function(event) {
                    showNodeDetails(event.node, graph.getNodeAttributes(event.node));
                });

                // Update legend counts
                updateGraphLegend(data);

                showToast('success', 'Graph Loaded', 'Knowledge graph rendered with ' + data.nodes.length + ' nodes and ' + data.edges.length + ' relationships');

            } catch (error) {
                console.error('Error rendering graph:', error);
                showToast('error', 'Rendering Error', 'Failed to render graph: ' + error.message);
                empty.style.display = 'flex';
            }
        }

        // Get color based on node type
        function getNodeColor(type) {
            const colors = {
                'document': '#10b981',  // Green
                'entity': '#3b82f6',    // Blue
                'relationship': '#f97316', // Orange
                'chunk': '#8b5cf6',     // Purple
                'keyword': '#ec4899'    // Pink
            };
            return colors[type] || '#64748b';
        }

        // Apply different graph layouts
        function applyGraphLayout(graph, layoutType) {
            const nodes = graph.nodes();
            const nodeCount = nodes.length;

            if (layoutType === 'force') {
                // Simple force-directed layout simulation
                const iterations = 50;
                const k = Math.sqrt(100 / nodeCount);
                
                for (let i = 0; i < iterations; i++) {
                    // Repulsion between all nodes
                    nodes.forEach(v => {
                        const vAttr = graph.getNodeAttributes(v);
                        let dx = 0, dy = 0;
                        
                        nodes.forEach(u => {
                            if (v !== u) {
                                const uAttr = graph.getNodeAttributes(u);
                                const deltaX = vAttr.x - uAttr.x;
                                const deltaY = vAttr.y - uAttr.y;
                                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
                                const force = k * k / distance;
                                dx += (deltaX / distance) * force;
                                dy += (deltaY / distance) * force;
                            }
                        });
                        
                        graph.setNodeAttribute(v, 'x', vAttr.x + dx);
                        graph.setNodeAttribute(v, 'y', vAttr.y + dy);
                    });
                    
                    // Attraction along edges
                    graph.forEachEdge((edge, attributes, source, target) => {
                        const sourceAttr = graph.getNodeAttributes(source);
                        const targetAttr = graph.getNodeAttributes(target);
                        const deltaX = targetAttr.x - sourceAttr.x;
                        const deltaY = targetAttr.y - sourceAttr.y;
                        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
                        const force = distance * distance / k;
                        
                        const dx = (deltaX / distance) * force * 0.5;
                        const dy = (deltaY / distance) * force * 0.5;
                        
                        graph.setNodeAttribute(source, 'x', sourceAttr.x + dx);
                        graph.setNodeAttribute(source, 'y', sourceAttr.y + dy);
                        graph.setNodeAttribute(target, 'x', targetAttr.x - dx);
                        graph.setNodeAttribute(target, 'y', targetAttr.y - dy);
                    });
                }
            } else if (layoutType === 'circular') {
                // Circular layout
                const radius = 40;
                const angleStep = (2 * Math.PI) / nodeCount;
                nodes.forEach((node, i) => {
                    graph.setNodeAttribute(node, 'x', radius * Math.cos(i * angleStep));
                    graph.setNodeAttribute(node, 'y', radius * Math.sin(i * angleStep));
                });
            } else if (layoutType === 'random') {
                // Random layout
                nodes.forEach(node => {
                    graph.setNodeAttribute(node, 'x', (Math.random() - 0.5) * 100);
                    graph.setNodeAttribute(node, 'y', (Math.random() - 0.5) * 100);
                });
            }
        }

        // Change graph layout
        function changeLayout() {
            const select = document.getElementById('layout-select');
            currentLayout = select.value;
            
            if (graphRenderer && graphData) {
                renderGraph(graphData);
            }
        }

        // Reset graph view to initial state
        function resetGraphView() {
            if (graphRenderer) {
                graphRenderer.getCamera().setState({ x: 0.5, y: 0.5, ratio: 1 });
                showToast('info', 'View Reset', 'Graph view has been reset to default');
            }
        }

        // Search for nodes in the graph
        function searchGraph() {
            const searchInput = document.getElementById('graph-search');
            const query = searchInput.value.toLowerCase().trim();
            
            if (!graphRenderer || !query) {
                return;
            }

            const graph = graphRenderer.getGraph();
            let found = false;

            graph.forEachNode((node, attributes) => {
                if (attributes.label.toLowerCase().includes(query)) {
                    // Highlight found node
                    graph.setNodeAttribute(node, 'highlighted', true);
                    graph.setNodeAttribute(node, 'color', '#ef4444'); // Red highlight
                    found = true;
                    
                    // Center camera on first match
                    if (!found) {
                        graphRenderer.getCamera().setState({
                            x: attributes.x,
                            y: attributes.y,
                            ratio: 0.5
                        });
                    }
                } else {
                    graph.setNodeAttribute(node, 'highlighted', false);
                    graph.setNodeAttribute(node, 'color', getNodeColor(attributes.type));
                }
            });

            graphRenderer.refresh();

            if (found) {
                showToast('success', 'Search Results', 'Found nodes matching: ' + query);
            } else {
                showToast('info', 'No Results', 'No nodes found matching: ' + query);
            }
        }

        // Show node details panel
        function showNodeDetails(nodeId, attributes) {
            const panel = document.getElementById('node-details');
            const title = document.getElementById('node-title');
            const type = document.getElementById('node-type');
            const meta = document.getElementById('node-metadata');

            title.textContent = attributes.label || nodeId;
            type.textContent = 'Type: ' + (attributes.type || 'unknown');
            
            // Format metadata
            let metaHtml = '';
            if (attributes.metadata && Object.keys(attributes.metadata).length > 0) {
                metaHtml = '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">';
                Object.keys(attributes.metadata).forEach(key => {
                    metaHtml += '<div style="margin-bottom: 8px;"><strong>' + key + ':</strong> ' + attributes.metadata[key] + '</div>';
                });
                metaHtml += '</div>';
            }
            meta.innerHTML = metaHtml;

            panel.classList.add('visible');
        }

        // Close node details panel
        function closeNodeDetails() {
            document.getElementById('node-details').classList.remove('visible');
        }

        // Update legend counts
        function updateGraphLegend(data) {
            const counts = {
                document: 0,
                entity: 0,
                relationship: 0
            };

            data.nodes.forEach(node => {
                if (counts.hasOwnProperty(node.type)) {
                    counts[node.type]++;
                }
            });

            const docCount = document.getElementById('doc-count');
            const entityCount = document.getElementById('entity-count');
            const relCount = document.getElementById('rel-count');

            if (docCount) docCount.textContent = 'Documents: ' + counts.document;
            if (entityCount) entityCount.textContent = 'Entities: ' + counts.entity;
            if (relCount) relCount.textContent = 'Relationships: ' + counts.relationship;
        }

        // Handle messages from extension
        window.addEventListener('message', function(event) {
            const message = event.data;
            
            if (message.command === 'graphData') {
                renderGraph(message.data);
            }
        });

        // ================== END KNOWLEDGE GRAPH ==================
    </script>
</body>
</html>`;
}