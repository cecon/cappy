import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getLightRAGDatabase, LightRAGDocument } from '../store/lightragDb';

/**
 * LightRAG Main Dashboard with Navigation and Document Management
 * Includes upload, delete, duplicate handling, and navigation to Graph/Retrieval/MCP docs
 */
export async function openDocumentUploadUI(context: vscode.ExtensionContext) {
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

    // Send initial data
    panel.webview.postMessage({
        command: 'loadDocuments',
        data: db.getDocuments()
    });

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
                case 'selectFile':
                    await handleFileSelection(panel);
                    break;
                case 'validateMetadata':
                    await handleMetadataValidation(message.data, panel);
                    break;
                case 'processDocument':
                    await handleDocumentProcessing(message.data, panel);
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

async function handleDocumentDelete(documentId: string, panel: vscode.WebviewPanel) {
    try {
        const db = getLightRAGDatabase();
        await db.deleteDocument(documentId);

        // Reload documents after deletion
        await handleLoadDocuments(panel);

        panel.webview.postMessage({
            command: 'documentDeleted',
            data: { id: documentId }
        });
    } catch (error) {
        panel.webview.postMessage({
            command: 'deleteError',
            data: { message: error instanceof Error ? error.message : 'Failed to delete document' }
        });
    }
}

async function handleNavigateToGraph(context: vscode.ExtensionContext) {
    // Create graph visualization panel
    const panel = vscode.window.createWebviewPanel(
        'lightragGraph',
        'LightRAG - Knowledge Graph',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    panel.webview.html = getGraphVisualizationContent();
    
    // Load graph data
    const db = getLightRAGDatabase();
    const graphData = db.getGraphData();
    
    panel.webview.postMessage({
        command: 'loadGraph',
        data: graphData
    });
}

async function handleNavigateToRetrieval(context: vscode.ExtensionContext) {
    // Create retrieval testing panel
    const panel = vscode.window.createWebviewPanel(
        'lightragRetrieval',
        'LightRAG - Knowledge Retrieval',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    panel.webview.html = getRetrievalTestingContent();
}

async function handleNavigateToMcpDocs(context: vscode.ExtensionContext) {
    // Create MCP documentation panel
    const panel = vscode.window.createWebviewPanel(
        'lightragMcpDocs',
        'LightRAG - MCP Documentation',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    panel.webview.html = getMcpDocumentationContent();
}

async function handleFileSelection(panel: vscode.WebviewPanel) {
    const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select Document',
        filters: {
            documents: ['pdf', 'docx', 'txt', 'md'],
            allFiles: ['*']
        }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) {
        const filePath = fileUri[0].fsPath;
        const fileName = path.basename(filePath);
        const fileSize = fs.statSync(filePath).size;

        panel.webview.postMessage({
            command: 'fileSelected',
            data: {
                fileName,
                filePath,
                fileSize
            }
        });
    }
}

async function handleMetadataValidation(data: any, panel: vscode.WebviewPanel) {
    const validation = {
        title: data.title && data.title.trim().length >= 3,
        description: data.description && data.description.trim().length >= 10,
        category: data.category && data.category.trim().length > 0
    };

    panel.webview.postMessage({
        command: 'validationResult',
        data: {
            isValid: Object.values(validation).every(v => v),
            validation
        }
    });
}

async function handleDocumentUpload(data: any, panel: vscode.WebviewPanel) {
    try {
        // Update progress
        panel.webview.postMessage({
            command: 'updateProgress',
            data: { progress: 25, message: 'Reading document...' }
        });

        // Simulate file reading
        await new Promise(resolve => setTimeout(resolve, 1000));

        panel.webview.postMessage({
            command: 'updateProgress',
            data: { progress: 75, message: 'Processing with LightRAG...' }
        });

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Mock processing results
        const results = {
            entities: Math.floor(Math.random() * 20) + 5,
            relationships: Math.floor(Math.random() * 15) + 3,
            keyInsights: Math.floor(Math.random() * 8) + 2,
            processingTime: (Math.random() * 3 + 1).toFixed(1) + 's'
        };

        panel.webview.postMessage({
            command: 'processingComplete',
            data: results
        });

    } catch (error) {
        panel.webview.postMessage({
            command: 'processingError',
            data: { message: error instanceof Error ? error.message : 'Processing failed' }
        });
    }
}

async function handleDocumentProcessing(data: any, panel: vscode.WebviewPanel) {
    try {
        const db = getLightRAGDatabase();
        
        // Check for duplicate filename
        const existingDoc = db.getDocumentByFileName(data.file);
        if (existingDoc) {
            // Delete the old document and its data
            await db.deleteDocument(existingDoc.id);
            
            panel.webview.postMessage({
                command: 'updateProgress',
                data: { progress: 10, message: 'Replacing existing document...' }
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Update progress
        panel.webview.postMessage({
            command: 'updateProgress',
            data: { progress: 25, message: 'Reading document...' }
        });

        // Create document entry
        const documentId = await db.addDocument({
            title: data.title,
            description: data.description,
            category: data.category,
            tags: data.tags || [],
            filePath: data.file,
            fileName: data.file,
            fileSize: data.fileSize || 0,
            content: 'Mock content for: ' + data.title, // TODO: Implement real file reading
            status: 'processing'
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        panel.webview.postMessage({
            command: 'updateProgress',
            data: { progress: 50, message: 'Extracting entities...' }
        });

        // Mock entity extraction
        const mockEntities = [
            { name: 'Entity 1', type: 'CONCEPT', description: 'Sample entity from ' + data.title },
            { name: 'Entity 2', type: 'PERSON', description: 'Another entity from document' }
        ];

        for (const entityData of mockEntities) {
            await db.addEntity({
                name: entityData.name,
                type: entityData.type,
                description: entityData.description,
                documentIds: [documentId]
            });
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

        panel.webview.postMessage({
            command: 'updateProgress',
            data: { progress: 75, message: 'Mapping relationships...' }
        });

        // Mock relationship extraction
        const entities = db.getEntities().filter(e => e.documentIds.includes(documentId));
        if (entities.length >= 2) {
            await db.addRelationship({
                source: entities[0].id,
                target: entities[1].id,
                type: 'RELATED_TO',
                description: 'Connection found in document',
                weight: 0.8,
                documentIds: [documentId]
            });
        }

        await new Promise(resolve => setTimeout(resolve, 800));

        panel.webview.postMessage({
            command: 'updateProgress',
            data: { progress: 90, message: 'Creating chunks...' }
        });

        // Mock chunking
        await db.addChunk({
            documentId: documentId,
            content: 'First chunk of the document...',
            startPosition: 0,
            endPosition: 100,
            chunkIndex: 0,
            entities: entities.map(e => e.id),
            relationships: []
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Update document with results
        const processingResults = {
            entities: entities.length,
            relationships: 1,
            chunks: 1,
            processingTime: '3.2s'
        };

        await db.updateDocument(documentId, {
            status: 'completed',
            processingResults
        });

        panel.webview.postMessage({
            command: 'processingComplete',
            data: processingResults
        });

        // Reload documents list
        await handleLoadDocuments(panel);

    } catch (error) {
        panel.webview.postMessage({
            command: 'processingError',
            data: { message: error instanceof Error ? error.message : 'Processing failed' }
        });
    }
}

function getWebviewContent(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LightRAG - Knowledge Graph Dashboard</title>
    <style>
        /* Exact LightRAG WebUI CSS Variables */
        :root {
            --background: hsl(0 0% 100%);
            --foreground: hsl(240 10% 3.9%);
            --card: hsl(0 0% 100%);
            --card-foreground: hsl(240 10% 3.9%);
            --popover: hsl(0 0% 100%);
            --popover-foreground: hsl(240 10% 3.9%);
            --primary: hsl(240 5.9% 10%);
            --primary-foreground: hsl(0 0% 98%);
            --secondary: hsl(240 4.8% 95.9%);
            --secondary-foreground: hsl(240 5.9% 10%);
            --muted: hsl(240 4.8% 95.9%);
            --muted-foreground: hsl(240 3.8% 46.1%);
            --accent: hsl(240 4.8% 95.9%);
            --accent-foreground: hsl(240 5.9% 10%);
            --destructive: hsl(0 84.2% 60.2%);
            --destructive-foreground: hsl(0 0% 98%);
            --border: hsl(240 5.9% 90%);
            --input: hsl(240 5.9% 90%);
            --ring: hsl(240 10% 3.9%);
            --chart-1: hsl(12 76% 61%);
            --chart-2: hsl(173 58% 39%);
            --chart-3: hsl(197 37% 24%);
            --chart-4: hsl(43 74% 66%);
            --chart-5: hsl(27 87% 67%);
            --radius: 0.6rem;
        }

        /* Exact LightRAG WebUI Base Styles */
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
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

        /* Header - Exact Match */
        .header {
            border-bottom: 1px solid hsl(var(--border) / 0.4);
            background: hsl(var(--background) / 0.95);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
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
            background-color: hsl(var(--muted));
            color: hsl(var(--muted-foreground));
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            padding: 4px;
            height: 100%;
            gap: 8px;
        }

        .tab-trigger {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 2px;
            font-size: 14px;
            font-weight: 500;
            white-space: nowrap;
            padding: 4px 8px;
            transition: all 0.2s;
            cursor: pointer;
            border: none;
            background: none;
            color: inherit;
        }

        .tab-trigger:hover {
            background-color: hsl(var(--background) / 0.6);
        }

        .tab-trigger.active {
            background-color: #10b981 !important;
            color: #f8fafc !important;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
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
            background-color: hsl(var(--card));
            color: hsl(var(--card-foreground));
            border-radius: 12px;
            border: 1px solid hsl(var(--border));
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            border-radius: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
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
            border: 1px solid hsl(var(--border));
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            height: 36px;
            padding: 0 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn:hover {
            background-color: hsl(var(--accent));
            color: hsl(var(--accent-foreground));
        }

        .btn-primary {
            background-color: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-color: hsl(var(--primary));
        }

        .btn-primary:hover {
            background-color: hsl(var(--primary) / 0.9);
        }

        .btn-icon {
            width: 16px;
            height: 16px;
        }

        /* Document Table */
        .document-table-container {
            background-color: hsl(var(--card));
            color: hsl(var(--card-foreground));
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            flex: 1;
            display: flex;
            flex-direction: column;
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
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
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal-content {
            background: hsl(var(--background));
            border-radius: 8px;
            padding: 24px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header {
            margin-bottom: 16px;
        }

        .modal-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .upload-area {
            border: 2px dashed hsl(var(--border));
            border-radius: 8px;
            padding: 32px;
            text-align: center;
            margin-bottom: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .upload-area:hover {
            border-color: hsl(var(--primary));
            background-color: hsl(var(--muted) / 0.3);
        }

        .upload-area.dragover {
            border-color: hsl(var(--primary));
            background-color: hsl(var(--primary) / 0.1);
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .form-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
            font-size: 14px;
        }

        .form-textarea {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
            font-size: 14px;
            min-height: 80px;
            resize: vertical;
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
                <label class="form-label">Description</label>
                <textarea id="document-description" class="form-textarea" placeholder="Enter document description"></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Category</label>
                <input type="text" id="document-category" class="form-input" placeholder="Enter category">
            </div>

            <div class="modal-actions">
                <button class="btn" onclick="closeUploadModal()">Cancel</button>
                <button class="btn btn-primary" onclick="uploadDocument()">Upload</button>
            </div>
        </div>
    </div>

        /* Base styles matching LightRAG WebUI */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            border-color: hsl(var(--border));
            outline-color: hsl(var(--ring) / 0.5);
        }

        body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            background-color: hsl(var(--background));
            color: hsl(var(--foreground));
            line-height: 1.5;
            overflow-x: hidden;
        }

        /* Container and layout matching LightRAG WebUI */
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px;
            min-height: 100vh;
        }

        .header {
            margin-bottom: 24px;
            padding: 0;
        }

        .header h1 {
            font-size: 30px;
            font-weight: 600;
            color: hsl(var(--foreground));
            margin-bottom: 8px;
            line-height: 1.2;
            letter-spacing: -0.025em;
        }

        .header p {
            font-size: 16px;
            color: hsl(var(--muted-foreground));
            margin-bottom: 0;
        }

        /* Card component matching LightRAG WebUI */
        .card {
            background-color: hsl(var(--card));
            color: hsl(var(--card-foreground));
            border: 1px solid hsl(var(--border));
            border-radius: calc(var(--radius) * 2);
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            overflow: hidden;
        }

        .card-header {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .card-title {
            font-size: 20px;
            font-weight: 600;
            color: hsl(var(--foreground));
            line-height: 1;
            letter-spacing: -0.025em;
            margin: 0;
        }

        .card-description {
            font-size: 14px;
            color: hsl(var(--muted-foreground));
            margin: 0;
        }

        .card-content {
            padding: 24px;
            padding-top: 0;
        }

        /* Button component matching LightRAG WebUI */
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: calc(var(--radius));
            border: 1px solid transparent;
            font-size: 14px;
            font-weight: 500;
            height: 36px;
            padding: 0 16px;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }

        .btn-primary {
            background-color: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
            border-color: hsl(var(--primary));
        }

        .btn-primary:hover {
            background-color: hsl(var(--primary) / 0.9);
        }

        .btn-secondary {
            background-color: hsl(var(--secondary));
            color: hsl(var(--secondary-foreground));
            border-color: hsl(var(--border));
        }

        .btn-secondary:hover {
            background-color: hsl(var(--secondary) / 0.8);
        }

        /* Input component matching LightRAG WebUI */
        .input {
            flex: 1;
            height: 36px;
            border-radius: calc(var(--radius));
            border: 1px solid hsl(var(--border));
            background-color: transparent;
            padding: 0 12px;
            font-size: 14px;
            transition: border-color 0.2s;
            color: hsl(var(--foreground));
        }

        .input:focus {
            outline: none;
            border-color: hsl(var(--ring));
            box-shadow: 0 0 0 1px hsl(var(--ring));
        }

        .input::placeholder {
            color: hsl(var(--muted-foreground));
        }

        .textarea {
            min-height: 80px;
            padding: 12px;
            resize: vertical;
        }

        .select {
            height: 36px;
            padding: 0 12px;
            border-radius: calc(var(--radius));
            border: 1px solid hsl(var(--border));
            background-color: hsl(var(--background));
            font-size: 14px;
            color: hsl(var(--foreground));
        }

        /* Upload area matching LightRAG WebUI */
        .upload-area {
            border: 2px dashed hsl(var(--border));
            border-radius: calc(var(--radius) * 2);
            padding: 48px 24px;
            text-align: center;
            background-color: hsl(var(--muted) / 0.3);
            cursor: pointer;
            transition: all 0.2s;
            margin-bottom: 24px;
        }

        .upload-area:hover {
            border-color: hsl(var(--primary));
            background-color: hsl(var(--muted) / 0.5);
        }

        .upload-area.dragover {
            border-color: hsl(var(--primary));
            background-color: hsl(var(--primary) / 0.1);
        }

        .upload-icon {
            font-size: 48px;
            color: hsl(var(--muted-foreground));
            margin-bottom: 16px;
        }

        .upload-text {
            font-size: 16px;
            color: hsl(var(--foreground));
            margin-bottom: 8px;
        }

        .upload-subtext {
            font-size: 14px;
            color: hsl(var(--muted-foreground));
        }

        /* Form sections */
        .form-section {
            margin-bottom: 24px;
        }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: hsl(var(--foreground));
            margin-bottom: 8px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        /* Progress component */
        .progress {
            width: 100%;
            height: 8px;
            background-color: hsl(var(--muted));
            border-radius: calc(var(--radius));
            overflow: hidden;
            margin-bottom: 16px;
        }

        .progress-bar {
            height: 100%;
            background-color: hsl(var(--primary));
            transition: width 0.3s ease;
        }

        /* Status indicators */
        .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            border-radius: calc(var(--radius));
            font-size: 12px;
            font-weight: 500;
        }

        .status-success {
            background-color: hsl(var(--chart-2) / 0.1);
            color: hsl(var(--chart-2));
        }

        .status-error {
            background-color: hsl(var(--destructive) / 0.1);
            color: hsl(var(--destructive));
        }

        .status-processing {
            background-color: hsl(var(--chart-4) / 0.1);
            color: hsl(var(--chart-4));
        }

        /* Grid layouts */
        .grid {
            display: grid;
            gap: 16px;
        }

        .grid-cols-2 {
            grid-template-columns: repeat(2, 1fr);
        }

        .grid-cols-3 {
            grid-template-columns: repeat(3, 1fr);
        }

        /* Utilities */
        .flex {
            display: flex;
        }

        .items-center {
            align-items: center;
        }

        .justify-between {
            justify-content: space-between;
        }

        .gap-2 {
            gap: 8px;
        }

        .gap-4 {
            gap: 16px;
        }

        .mt-4 {
            margin-top: 16px;
        }

        .mb-2 {
            margin-bottom: 8px;
        }

        .text-sm {
            font-size: 12px;
        }

        .font-medium {
            font-weight: 500;
        }

        .hidden {
            display: none;
        }

        .text-center {
            text-align: center;
        }

        /* File display */
        .file-display {
            background-color: hsl(var(--muted) / 0.5);
            border: 1px solid hsl(var(--border));
            border-radius: calc(var(--radius));
            padding: 16px;
            margin-bottom: 16px;
        }

        .file-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .file-icon {
            font-size: 24px;
            color: hsl(var(--primary));
        }

        .file-details h4 {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 4px;
        }

        .file-details p {
            font-size: 12px;
            color: hsl(var(--muted-foreground));
            margin: 0;
        }

        /* Processing options */
        .processing-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }

        .option-card {
            border: 1px solid hsl(var(--border));
            border-radius: calc(var(--radius));
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .option-card:hover {
            border-color: hsl(var(--primary));
            background-color: hsl(var(--muted) / 0.3);
        }

        .option-card.selected {
            border-color: hsl(var(--primary));
            background-color: hsl(var(--primary) / 0.1);
        }

        .option-card h4 {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 4px;
        }

        .option-card p {
            font-size: 12px;
            color: hsl(var(--muted-foreground));
            margin: 0;
        }

        /* Results display */
        .results-section {
            text-align: center;
            padding: 24px;
        }

        .results-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .results-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .results-subtitle {
            color: hsl(var(--muted-foreground));
            margin-bottom: 24px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .stat-card {
            background-color: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: calc(var(--radius));
            padding: 16px;
            text-align: center;
        }

        .stat-number {
            font-size: 24px;
            font-weight: 700;
            color: hsl(var(--primary));
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 12px;
            color: hsl(var(--muted-foreground));
        }

        /* Navigation styles */
        .nav-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .nav-tabs {
            display: flex;
            gap: 8px;
        }

        .nav-tab {
            padding: 8px 16px;
            background: hsl(var(--secondary));
            border: 1px solid hsl(var(--border));
            border-radius: calc(var(--radius));
            cursor: pointer;
            transition: all 0.2s;
            font-size: 14px;
            font-weight: 500;
        }

        .nav-tab:hover {
            background: hsl(var(--muted));
        }

        .nav-tab.active {
            background: hsl(var(--primary));
            color: hsl(var(--primary-foreground));
        }

        .stats-bar {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            padding: 16px;
            background: hsl(var(--muted) / 0.3);
            border-radius: calc(var(--radius));
            margin-bottom: 24px;
        }

        .stat-item {
            text-align: center;
        }

        .stat-value {
            display: block;
            font-size: 24px;
            font-weight: 700;
            color: hsl(var(--primary));
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 12px;
            color: hsl(var(--muted-foreground));
        }

        /* Table styles */
        .table-container {
            overflow-x: auto;
            border: 1px solid hsl(var(--border));
            border-radius: calc(var(--radius));
        }

        .documents-table {
            width: 100%;
            border-collapse: collapse;
        }

        .documents-table th,
        .documents-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid hsl(var(--border));
        }

        .documents-table th {
            background: hsl(var(--muted) / 0.5);
            font-weight: 600;
            font-size: 12px;
            color: hsl(var(--muted-foreground));
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .documents-table tr:hover {
            background: hsl(var(--muted) / 0.3);
        }

        .doc-title {
            font-weight: 500;
            color: hsl(var(--foreground));
        }

        .doc-category {
            padding: 2px 8px;
            background: hsl(var(--secondary));
            border-radius: calc(var(--radius) / 2);
            font-size: 11px;
            font-weight: 500;
        }

        .doc-status {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: calc(var(--radius) / 2);
            font-size: 11px;
            font-weight: 500;
        }

        .doc-status.completed {
            background: hsl(var(--chart-2) / 0.1);
            color: hsl(var(--chart-2));
        }

        .doc-status.processing {
            background: hsl(var(--chart-4) / 0.1);
            color: hsl(var(--chart-4));
        }

        .doc-status.failed {
            background: hsl(var(--destructive) / 0.1);
            color: hsl(var(--destructive));
        }

        .doc-actions {
            display: flex;
            gap: 8px;
        }

        .btn-small {
            padding: 4px 8px;
            font-size: 12px;
            height: auto;
        }

        .btn-danger {
            background: hsl(var(--destructive));
            color: hsl(var(--destructive-foreground));
            border-color: hsl(var(--destructive));
        }

        .btn-danger:hover {
            background: hsl(var(--destructive) / 0.9);
        }

        /* Modal styles */
        .modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .modal-content {
            background: hsl(var(--card));
            border-radius: calc(var(--radius) * 2);
            max-width: 600px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px;
            border-bottom: 1px solid hsl(var(--border));
        }

        .modal-header h3 {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: hsl(var(--muted-foreground));
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: calc(var(--radius));
            transition: all 0.2s;
        }

        .modal-close:hover {
            background: hsl(var(--muted));
        }

        .modal-body {
            padding: 24px;
        }

        /* Empty state */
        .empty-state {
            text-align: center;
            padding: 48px 24px;
        }

        .empty-icon {
            font-size: 64px;
            margin-bottom: 16px;
            opacity: 0.5;
        }

        .empty-state h3 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .empty-state p {
            color: hsl(var(--muted-foreground));
            margin-bottom: 24px;
        }

        /* View content */
        .view-content {
            display: block;
        }

        .view-content.hidden {
            display: none;
        }
        @media (max-width: 768px) {
            .container {
                padding: 16px;
            }
            
            .grid-cols-2 {
                grid-template-columns: 1fr;
            }
            
            .card-header,
            .card-content {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
<body>
    <div class="container">
        <!-- Navigation Header -->
        <div class="header">
            <div class="nav-header">
                <h1>LightRAG Knowledge Graph</h1>
                <div class="nav-tabs">
                    <button class="nav-tab active" id="documentsTab">📄 Documents</button>
                    <button class="nav-tab" id="graphTab">🕸️ Graph</button>
                    <button class="nav-tab" id="retrievalTab">🔍 Retrieval</button>
                    <button class="nav-tab" id="mcpDocsTab">📖 MCP API</button>
                </div>
            </div>
            <div class="stats-bar">
                <div class="stat-item">
                    <span class="stat-value" id="docsCount">0</span>
                    <span class="stat-label">Documents</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="entitiesCount">0</span>
                    <span class="stat-label">Entities</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="relationshipsCount">0</span>
                    <span class="stat-label">Relationships</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value" id="chunksCount">0</span>
                    <span class="stat-label">Chunks</span>
                </div>
            </div>
        </div>

        <!-- Documents View (Default) -->
        <div id="documentsView" class="view-content">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Document Management</h2>
                    <button class="btn btn-primary" id="uploadBtn">📁 Upload Document</button>
                </div>
                <div class="card-content">
                    <!-- Empty State -->
                    <div id="emptyState" class="empty-state">
                        <div class="empty-icon">📄</div>
                        <h3>No documents uploaded yet</h3>
                        <p>Upload your first document to start building your knowledge graph</p>
                        <button class="btn btn-primary" onclick="showUploadModal()">Upload Document</button>
                    </div>

                    <!-- Documents Table -->
                    <div id="documentsTable" class="hidden">
                        <div class="table-container">
                            <table class="documents-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Entities</th>
                                        <th>Relationships</th>
                                        <th>Chunks</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="documentsTableBody">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Upload Modal -->
        <div id="uploadModal" class="modal hidden">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Upload Document</h3>
                    <button class="modal-close" onclick="hideUploadModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Upload Area -->
                    <div class="upload-area" id="uploadArea">
                        <div class="upload-icon">📄</div>
                        <div class="upload-text">Drag & drop your document here</div>
                        <div class="upload-subtext">or click to browse files</div>
                        <input type="file" id="fileInput" class="hidden" accept=".pdf,.docx,.txt,.md">
                    </div>

                    <!-- Selected File Display -->
                    <div id="fileDisplay" class="file-display hidden">
                        <div class="file-info">
                            <div class="file-icon">📄</div>
                            <div class="file-details">
                                <h4 id="fileName"></h4>
                                <p id="fileSize"></p>
                            </div>
                        </div>
                    </div>

                    <!-- Metadata Form -->
                    <div id="metadataForm" class="hidden">
                        <div class="form-section">
                            <h3 class="form-label">Document Information</h3>
                            
                            <div class="grid grid-cols-2">
                                <div class="form-group">
                                    <label class="form-label" for="docTitle">Title *</label>
                                    <input type="text" id="docTitle" class="input" placeholder="Enter document title" required>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label" for="docCategory">Category</label>
                                    <select id="docCategory" class="select">
                                        <option value="research">Research</option>
                                        <option value="documentation">Documentation</option>
                                        <option value="manual">Manual</option>
                                        <option value="report">Report</option>
                                        <option value="article">Article</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="docDescription">Description *</label>
                                <textarea id="docDescription" class="input textarea" placeholder="Describe the document content and purpose" required></textarea>
                            </div>

                            <div class="form-group">
                                <label class="form-label" for="docTags">Tags</label>
                                <input type="text" id="docTags" class="input" placeholder="Enter tags separated by commas">
                            </div>
                        </div>

                        <div class="flex justify-between mt-4">
                            <button class="btn btn-secondary" onclick="hideUploadModal()">Cancel</button>
                            <button class="btn btn-primary" id="processBtn" disabled>Process Document</button>
                        </div>
                    </div>

                    <!-- Progress Section -->
                    <div id="progressSection" class="hidden">
                        <div class="text-center">
                            <div class="progress">
                                <div class="progress-bar" id="progressBar" style="width: 0%"></div>
                            </div>
                            <p id="progressText">Initializing...</p>
                        </div>
                    </div>

                    <!-- Results Section -->
                    <div id="resultsSection" class="hidden">
                        <div class="results-section">
                            <div class="results-icon">✅</div>
                            <h3 class="results-title">Processing Complete!</h3>
                            <p class="results-subtitle">Your document has been successfully processed</p>
                            
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-number" id="modalEntitiesCount">0</div>
                                    <div class="stat-label">Entities</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-number" id="modalRelationshipsCount">0</div>
                                    <div class="stat-label">Relationships</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-number" id="modalChunksCount">0</div>
                                    <div class="stat-label">Chunks</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-number" id="modalProcessingTime">0s</div>
                                    <div class="stat-label">Time</div>
                                </div>
                            </div>

                            <button class="btn btn-primary" onclick="hideUploadModal()">Done</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // State
        let documents = [];
        let selectedFile = null;

        // Elements
        const documentsTab = document.getElementById('documentsTab');
        const graphTab = document.getElementById('graphTab');
        const retrievalTab = document.getElementById('retrievalTab');
        const mcpDocsTab = document.getElementById('mcpDocsTab');
        
        const uploadBtn = document.getElementById('uploadBtn');
        const uploadModal = document.getElementById('uploadModal');
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        const emptyState = document.getElementById('emptyState');
        const documentsTable = document.getElementById('documentsTable');
        const documentsTableBody = document.getElementById('documentsTableBody');
        
        const fileDisplay = document.getElementById('fileDisplay');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const metadataForm = document.getElementById('metadataForm');
        const docTitle = document.getElementById('docTitle');
        const docDescription = document.getElementById('docDescription');
        const processBtn = document.getElementById('processBtn');
        
        const progressSection = document.getElementById('progressSection');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const resultsSection = document.getElementById('resultsSection');

        // Navigation handlers
        documentsTab.addEventListener('click', () => switchTab('documents'));
        graphTab.addEventListener('click', () => vscode.postMessage({ command: 'navigateToGraph' }));
        retrievalTab.addEventListener('click', () => vscode.postMessage({ command: 'navigateToRetrieval' }));
        mcpDocsTab.addEventListener('click', () => vscode.postMessage({ command: 'navigateToMcpDocs' }));

        // Upload handlers
        uploadBtn.addEventListener('click', showUploadModal);
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelection(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelection(e.target.files[0]);
            }
        });

        processBtn.addEventListener('click', () => {
            if (!selectedFile) return;
            
            hideAllSections();
            progressSection.classList.remove('hidden');
            
            const formData = {
                file: selectedFile.name,
                title: docTitle.value,
                description: docDescription.value,
                category: document.getElementById('docCategory').value,
                tags: document.getElementById('docTags').value.split(',').map(t => t.trim()).filter(t => t),
                fileSize: selectedFile.size
            };
            
            vscode.postMessage({
                command: 'processDocument',
                data: formData
            });
        });

        // Form validation
        docTitle.addEventListener('input', validateForm);
        docDescription.addEventListener('input', validateForm);

        function switchTab(tab) {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(tab + 'Tab').classList.add('active');
            // Documents tab is always visible in this view
        }

        function showUploadModal() {
            uploadModal.classList.remove('hidden');
            resetUploadForm();
        }

        function hideUploadModal() {
            uploadModal.classList.add('hidden');
            resetUploadForm();
        }

        function resetUploadForm() {
            selectedFile = null;
            hideAllSections();
            uploadArea.classList.remove('hidden');
            docTitle.value = '';
            docDescription.value = '';
            document.getElementById('docTags').value = '';
            validateForm();
        }

        function hideAllSections() {
            uploadArea.classList.add('hidden');
            fileDisplay.classList.add('hidden');
            metadataForm.classList.add('hidden');
            progressSection.classList.add('hidden');
            resultsSection.classList.add('hidden');
        }

        function handleFileSelection(file) {
            selectedFile = file;
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            
            hideAllSections();
            fileDisplay.classList.remove('hidden');
            metadataForm.classList.remove('hidden');
            
            // Auto-fill title with filename
            docTitle.value = file.name.replace(/\.[^/.]+$/, "");
            validateForm();
        }

        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function validateForm() {
            const titleValid = docTitle.value.trim().length >= 3;
            const descValid = docDescription.value.trim().length >= 10;
            const fileValid = selectedFile !== null;
            
            processBtn.disabled = !(titleValid && descValid && fileValid);
        }

        function updateDocumentsList(docs) {
            documents = docs;
            updateStats();
            
            if (docs.length === 0) {
                emptyState.classList.remove('hidden');
                documentsTable.classList.add('hidden');
            } else {
                emptyState.classList.add('hidden');
                documentsTable.classList.remove('hidden');
                renderDocumentsTable();
            }
        }

        function updateStats() {
            const stats = {
                documents: documents.length,
                entities: documents.reduce((sum, doc) => sum + (doc.processingResults?.entities || 0), 0),
                relationships: documents.reduce((sum, doc) => sum + (doc.processingResults?.relationships || 0), 0),
                chunks: documents.reduce((sum, doc) => sum + (doc.processingResults?.chunks || 0), 0)
            };

            document.getElementById('docsCount').textContent = stats.documents;
            document.getElementById('entitiesCount').textContent = stats.entities;
            document.getElementById('relationshipsCount').textContent = stats.relationships;
            document.getElementById('chunksCount').textContent = stats.chunks;
        }

        function renderDocumentsTable() {
            documentsTableBody.innerHTML = '';
            
            documents.forEach(doc => {
                const row = document.createElement('tr');
                
                // Create title cell
                const titleCell = document.createElement('td');
                const titleDiv = document.createElement('div');
                titleDiv.className = 'doc-title';
                titleDiv.textContent = doc.title;
                
                const fileDiv = document.createElement('div');
                fileDiv.style.fontSize = '12px';
                fileDiv.style.color = 'hsl(var(--muted-foreground))';
                fileDiv.textContent = doc.fileName;
                
                titleCell.appendChild(titleDiv);
                titleCell.appendChild(fileDiv);
                
                // Create category cell
                const categoryCell = document.createElement('td');
                const categorySpan = document.createElement('span');
                categorySpan.className = 'doc-category';
                categorySpan.textContent = doc.category;
                categoryCell.appendChild(categorySpan);
                
                // Create status cell
                const statusCell = document.createElement('td');
                const statusSpan = document.createElement('span');
                statusSpan.className = 'doc-status ' + doc.status;
                statusSpan.textContent = getStatusText(doc.status);
                statusCell.appendChild(statusSpan);
                
                // Create data cells
                const entitiesCell = document.createElement('td');
                entitiesCell.textContent = String(doc.processingResults?.entities || 0);
                
                const relationshipsCell = document.createElement('td');
                relationshipsCell.textContent = String(doc.processingResults?.relationships || 0);
                
                const chunksCell = document.createElement('td');
                chunksCell.textContent = String(doc.processingResults?.chunks || 0);
                
                const createdCell = document.createElement('td');
                createdCell.textContent = formatDate(doc.created);
                
                // Create actions cell
                const actionsCell = document.createElement('td');
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'doc-actions';
                
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-danger btn-small';
                deleteBtn.textContent = '🗑️';
                deleteBtn.onclick = () => deleteDocument(doc.id);
                
                actionsDiv.appendChild(deleteBtn);
                actionsCell.appendChild(actionsDiv);
                
                // Append all cells to row
                row.appendChild(titleCell);
                row.appendChild(categoryCell);
                row.appendChild(statusCell);
                row.appendChild(entitiesCell);
                row.appendChild(relationshipsCell);
                row.appendChild(chunksCell);
                row.appendChild(createdCell);
                row.appendChild(actionsCell);
                
                documentsTableBody.appendChild(row);
            });
        }

        function getStatusText(status) {
            const statusMap = {
                'completed': '✓ Completed',
                'processing': '⏳ Processing',
                'failed': '✗ Failed'
            };
            return statusMap[status] || status;
        }

        function formatDate(dateString) {
            return new Date(dateString).toLocaleDateString();
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function deleteDocument(documentId) {
            if (confirm('Are you sure you want to delete this document? This will also remove all related entities and relationships.')) {
                vscode.postMessage({
                    command: 'deleteDocument',
                    data: { id: documentId }
                });
            }
        }

        // Global functions for onclick handlers
        window.showUploadModal = showUploadModal;
        window.hideUploadModal = hideUploadModal;
        window.deleteDocument = deleteDocument;

        // Message handler
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'documentsLoaded':
                    updateDocumentsList(message.data.documents);
                    break;
                    
                case 'updateProgress':
                    progressBar.style.width = message.data.progress + '%';
                    progressText.textContent = message.data.message;
                    break;
                    
                case 'processingComplete':
                    hideAllSections();
                    resultsSection.classList.remove('hidden');
                    
                    document.getElementById('modalEntitiesCount').textContent = message.data.entities;
                    document.getElementById('modalRelationshipsCount').textContent = message.data.relationships;
                    document.getElementById('modalChunksCount').textContent = message.data.chunks;
                    document.getElementById('modalProcessingTime').textContent = message.data.processingTime;
                    break;
                    
                case 'processingError':
                    hideAllSections();
                    alert('Processing failed: ' + message.data.message);
                    metadataForm.classList.remove('hidden');
                    break;
                    
                case 'documentDeleted':
                    // Documents will be reloaded automatically
                    break;
                    
                case 'loadError':
                case 'deleteError':
                    alert('Error: ' + message.data.message);
                    break;
            }
        });

        // Initialize
        vscode.postMessage({ command: 'loadDocuments' });
    </script>
</body>
</html>`;
}

function getGraphVisualizationContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>LightRAG - Knowledge Graph</title>
    <style>
        body { font-family: system-ui; margin: 0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #333; margin-bottom: 20px; }
        .graph-container { 
            width: 100%; 
            height: 600px; 
            border: 1px solid #ddd; 
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f5f5;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🕸️ Knowledge Graph Visualization</h1>
        <div class="graph-container">
            <p>Graph visualization will be implemented here using Sigma.js</p>
        </div>
    </div>
</body>
</html>`;
}

function getRetrievalTestingContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>LightRAG - Knowledge Retrieval</title>
    <style>
        body { font-family: system-ui; margin: 0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #333; margin-bottom: 20px; }
        .search-container { margin-bottom: 20px; }
        input { 
            width: 100%; 
            padding: 12px; 
            border: 1px solid #ddd; 
            border-radius: 8px;
            font-size: 16px;
        }
        .results { 
            border: 1px solid #ddd; 
            border-radius: 8px; 
            padding: 20px;
            background: #f9f9f9;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Knowledge Retrieval Testing</h1>
        <div class="search-container">
            <input type="text" placeholder="Enter your query to search the knowledge base..." />
        </div>
        <div class="results">
            <p>Search results will appear here</p>
        </div>
    </div>
</body>
</html>`;
}

function getMcpDocumentationContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>LightRAG - MCP Documentation</title>
    <style>
        body { font-family: system-ui; margin: 0; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #333; margin-bottom: 20px; }
        .api-section { 
            margin-bottom: 30px; 
            padding: 20px; 
            border: 1px solid #ddd; 
            border-radius: 8px;
        }
        code { 
            background: #f5f5f5; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📖 MCP API Documentation</h1>
        
        <div class="api-section">
            <h2>Available MCP Tools</h2>
            <ul>
                <li><code>addDocument</code> - Add a new document to the knowledge graph</li>
                <li><code>searchEntities</code> - Search for entities in the knowledge base</li>
                <li><code>getRelationships</code> - Retrieve relationships between entities</li>
                <li><code>queryGraph</code> - Perform complex graph queries</li>
            </ul>
        </div>
        
        <div class="api-section">
            <h2>Usage Examples</h2>
            <p>Documentation for using the MCP tools will be shown here</p>
        </div>
    </div>
</body>
</html>`;
}