import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Generate webview HTML content with external CSS and JS
 * This replaces the monolithic inline approach
 */
export function generateWebviewHTML(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    // Read CSS and JS content directly (more reliable than external files in webview)
    const cssPath = path.join(context.extensionPath, 'out', 'commands', 'lightrag', 'templates', 'dashboard.css');
    const jsPath = path.join(context.extensionPath, 'out', 'commands', 'lightrag', 'templates', 'dashboard.js');
    
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : '';
    const jsContent = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8') : '';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval';">
    <title>LightRAG - Knowledge Graph Dashboard</title>
    <style>${cssContent}</style>
</head>
<body>
    <!-- Toast Container -->
    <div id="toast-container"></div>
    
    <!-- Main Container -->
    <main class="main-container">
        <div class="content-wrapper">
            <!-- Header -->
            <header class="header">
                <div class="header-left">
                    <h1 class="header-title">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        LightRAG Dashboard
                    </h1>
                </div>
                
                <nav class="nav-tabs">
                    <button class="tab-trigger active" onclick="switchTab('documents')">Documents</button>
                    <button class="tab-trigger" onclick="switchTab('graph')">Knowledge Graph</button>
                </nav>
            </header>

            <!-- Content Area -->
            <div class="content-area">
                <!-- Documents Tab -->
                <div id="documents-tab" class="tab-content visible">
                    <div class="page-header">
                        <h2 class="page-title">Document Management</h2>
                        <p class="page-description">Upload and manage your documents for knowledge graph extraction</p>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-group-left">
                            <button class="btn" onclick="refreshDocuments()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                        <div class="control-group-right">
                            <button class="btn" onclick="clearDocuments()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Clear All
                            </button>
                            <button class="btn btn-primary" onclick="openUploadModal()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Upload Document
                            </button>
                        </div>
                    </div>
                    
                    <!-- Stats Grid -->
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon documents">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div class="stat-content">
                                <p class="stat-label">Documents</p>
                                <h3 class="stat-value" id="stat-documents">0</h3>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon entities">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div class="stat-content">
                                <p class="stat-label">Entities</p>
                                <h3 class="stat-value" id="stat-entities">0</h3>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon relationships">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <div class="stat-content">
                                <p class="stat-label">Relationships</p>
                                <h3 class="stat-value" id="stat-relationships">0</h3>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-icon chunks">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </div>
                            <div class="stat-content">
                                <p class="stat-label">Chunks</p>
                                <h3 class="stat-value" id="stat-chunks">0</h3>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Documents Table -->
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Category</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="documents-tbody">
                                <tr>
                                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--muted-foreground);">
                                        Loading documents...
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Knowledge Graph Tab -->
                <div id="graph-tab" class="tab-content hidden">
                    <div class="page-header">
                        <h2 class="page-title">Knowledge Graph</h2>
                        <p class="page-description">Visualize entities and relationships extracted from your documents</p>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-group-left">
                            <button class="btn btn-secondary" onclick="loadGraph()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Graph
                            </button>
                        </div>
                        <div class="control-group-right">
                            <button class="btn btn-secondary" onclick="resetGraphView()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                                Reset View
                            </button>
                        </div>
                    </div>
                    
                    <div id="graph-container">
                        <div id="graph-loading">Loading graph...</div>
                        <div id="graph-empty" style="display: none;">No graph data available</div>
                    </div>
                    
                    <div id="node-details-panel">
                        <button onclick="closeNodeDetails()">Close</button>
                        <div id="node-details-content"></div>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Upload Modal -->
    <div id="upload-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Upload Document</h3>
            </div>
            <div class="modal-body">
                <input type="file" id="file-input" accept=".txt,.md,.pdf,.doc,.docx" style="display: none;">
                
                <div id="upload-area" class="upload-area" onclick="document.getElementById('file-input').click()">
                    <svg style="width: 48px; height: 48px; color: var(--muted-foreground);" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p style="margin: 16px 0 8px 0; font-weight: 500;">Click to upload or drag and drop</p>
                    <p style="margin: 0; font-size: 13px; color: var(--muted-foreground);">TXT, MD, PDF, DOC, DOCX up to 10MB</p>
                </div>
                
                <div id="file-preview" class="file-preview">
                    <div style="flex: 1;">
                        <div id="file-name" style="font-weight: 500; margin-bottom: 4px;">file.txt</div>
                        <div id="file-size" style="font-size: 13px; color: var(--muted-foreground);">0 KB</div>
                    </div>
                    <button type="button" onclick="removeFile()" style="padding: 8px; background: #fee2e2; color: #dc2626; border: none; border-radius: 6px; cursor: pointer;">
                        <svg style="width: 16px; height: 16px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
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
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="closeUploadModal()">Cancel</button>
                <button class="btn btn-primary" onclick="uploadDocument()">Upload</button>
            </div>
        </div>
    </div>

    <script>${jsContent}</script>
</body>
</html>`;
}
