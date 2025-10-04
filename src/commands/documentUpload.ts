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

async function handleGenerateDescription(data: any, panel: vscode.WebviewPanel) {
    try {
        const { fileName, fileExtension, fileSize, contentPreview, title } = data;
        
        // Create a prompt for generating description
        const prompt = `Analyze this file and generate a concise, informative description (2-3 sentences max):

File: ${fileName}
Type: ${fileExtension}
Size: ${(fileSize / 1024).toFixed(2)} KB
${title ? `Title: ${title}` : ''}

Content preview:
${contentPreview}

Generate a professional description focusing on the file's purpose, main topics, and key information.`;

        // Try to use GitHub Copilot Chat API
        let description = '';
        
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
                
                for await (const part of response.text) {
                    description += part;
                }
            } else {
                throw new Error('No language model available');
            }
        } catch (error) {
            // Fallback: Generate a basic description based on file info
            description = generateFallbackDescription(fileName, fileExtension, contentPreview, title);
        }

        // Send the generated description back to the webview
        panel.webview.postMessage({
            command: 'descriptionGenerated',
            data: { description: description.trim() }
        });

    } catch (error) {
        panel.webview.postMessage({
            command: 'descriptionGenerationError',
            data: { message: error instanceof Error ? error.message : 'Failed to generate description' }
        });
    }
}

function generateFallbackDescription(fileName: string, fileExtension: string, contentPreview: string, title: string): string {
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
    
    return `This is a ${typeDescription} ${hasTitle ? `titled "${title}"` : `named "${fileName}"`}. It contains approximately ${wordCount} words across ${lines.length} lines. ${firstLine ? `The content begins with: "${firstLine.substring(0, 100)}..."` : ''}`;
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
    </style>
</head>
<body>
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
                    <div style="padding: 24px; text-align: center;">
                        <h2>Knowledge Graph Visualization</h2>
                        <p>Graph visualization will be implemented here.</p>
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
        }

        function closeUploadModal() {
            document.getElementById('upload-modal').style.display = 'none';
            // Reset form
            document.getElementById('file-input').value = '';
            document.getElementById('document-title').value = '';
            document.getElementById('document-description').value = '';
            document.getElementById('document-category').value = '';
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
            
            if (!fileInput.files[0]) {
                alert('Please select a file first');
                return;
            }

            const file = fileInput.files[0];
            const fileName = file.name;
            const fileExtension = fileName.split('.').pop().toLowerCase();
            
            // Show loading state
            const originalText = descriptionTextarea.value;
            descriptionTextarea.value = '⏳ Asking Copilot to analyze the file...';
            descriptionTextarea.disabled = true;
            
            try {
                // Read file content (first 2000 chars for analysis)
                const reader = new FileReader();
                reader.onload = function(e) {
                    const content = e.target.result;
                    const preview = content.substring(0, 2000);
                    
                    // Send request to backend to generate description
                    vscode.postMessage({
                        command: 'generateDescription',
                        data: {
                            fileName: fileName,
                            fileExtension: fileExtension,
                            fileSize: file.size,
                            contentPreview: preview,
                            title: titleInput.value
                        }
                    });
                };
                reader.readAsText(file);
            } catch (error) {
                descriptionTextarea.value = originalText;
                descriptionTextarea.disabled = false;
                alert('Error reading file: ' + error.message);
            }
        }

        function uploadDocument() {
            const fileInput = document.getElementById('file-input');
            const title = document.getElementById('document-title').value;
            const description = document.getElementById('document-description').value;
            const category = document.getElementById('document-category').value;

            if (!fileInput.files[0]) {
                alert('Please select a file');
                return;
            }

            if (!title.trim()) {
                alert('Please enter a title');
                return;
            }

            const file = fileInput.files[0];
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

        // Drag and drop support
        const uploadArea = document.querySelector('.upload-area');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea?.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea?.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea?.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            uploadArea?.classList.add('dragover');
        }

        function unhighlight(e) {
            uploadArea?.classList.remove('dragover');
        }

        uploadArea?.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                document.getElementById('file-input').files = files;
                handleFileSelect({ target: { files: files } });
            }
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
                    if (descTextarea) {
                        descTextarea.value = message.data.description;
                        descTextarea.disabled = false;
                    }
                    break;
                    
                case 'descriptionGenerationError':
                    const errorTextarea = document.getElementById('document-description');
                    if (errorTextarea) {
                        errorTextarea.disabled = false;
                        alert('Failed to generate description: ' + message.data.message);
                    }
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
    </script>
</body>
</html>`;
}