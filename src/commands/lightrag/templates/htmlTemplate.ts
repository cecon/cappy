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
                    <button class="tab-trigger" onclick="switchTab('retrieval')">Query & Retrieval</button>
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
                    
                    <!-- Graph Controls -->
                    <div class="control-group" style="margin-bottom: 16px;">
                        <div class="control-group-left">
                            <button class="btn btn-secondary" onclick="loadGraph()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh Graph
                            </button>
                            <button class="btn btn-secondary" onclick="resetGraphView()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                </svg>
                                Reset View
                            </button>
                            <label style="margin-left: 16px; font-size: 14px; font-weight: 500;">Layout:</label>
                            <select id="layout-select" class="form-input" style="width: 150px; margin-left: 8px;" onchange="changeLayout()">
                                <option value="force">Force-Directed</option>
                                <option value="circular">Circular</option>
                            </select>
                        </div>
                        <div class="control-group-right" style="display: flex; gap: 16px; align-items: center; font-size: 13px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 12px; height: 12px; background: #10b981; border-radius: 50%;"></div>
                                <span id="doc-count">Documents: 0</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 12px; height: 12px; background: #3b82f6; border-radius: 50%;"></div>
                                <span id="entity-count">Entities: 0</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="width: 12px; height: 12px; background: #f97316; border-radius: 50%;"></div>
                                <span id="rel-count">Relationships: 0</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Search Bar -->
                    <div style="margin-bottom: 16px;">
                        <input type="text" id="graph-search" class="form-input" placeholder="Search nodes in the graph..." style="width: 100%;" onkeyup="if(event.key === 'Enter') searchGraph()">
                    </div>
                    
                    <!-- Graph Container -->
                    <div style="position: relative; height: 600px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                        <div id="graph-container" style="width: 100%; height: 100%; position: relative;">
                            <div id="graph-loading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--card);">
                                <div style="text-align: center;">
                                    <svg style="width: 48px; height: 48px; color: #10b981; animation: spin 1s linear infinite; margin: 0 auto;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle style="opacity: 0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path style="opacity: 0.75;" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <p style="margin-top: 16px; color: var(--muted-foreground);">Loading knowledge graph...</p>
                                </div>
                            </div>
                            <div id="graph-empty" style="position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: var(--card);">
                                <div style="text-align: center; color: var(--muted-foreground);">
                                    <svg style="width: 64px; height: 64px; margin: 0 auto 16px; opacity: 0.5;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                    <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Knowledge Graph Data</h3>
                                    <p>Upload documents to build your knowledge graph</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Node Details Panel -->
                    <div id="node-details" style="margin-top: 16px; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; display: none;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <h3 id="node-title" style="font-size: 16px; font-weight: 600; flex: 1;">Node Details</h3>
                            <button onclick="closeNodeDetails()" class="btn btn-secondary" style="padding: 4px 8px;">
                                <svg style="width: 16px; height: 16px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div id="node-type" style="font-size: 14px; margin-bottom: 8px; color: var(--muted-foreground);"></div>
                        <div id="node-metadata" style="font-size: 14px;"></div>
                    </div>
                </div>

                <!-- Retrieval Tab -->
                <div id="retrieval-tab" class="tab-content hidden">
                    <div class="page-header">
                        <h2 class="page-title">Query & Retrieval Testing</h2>
                        <p class="page-description">Test knowledge graph queries with dual-level retrieval (specific entities + abstract concepts)</p>
                    </div>
                    
                    <!-- Query Input Section -->
                    <div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 24px; margin-bottom: 16px;">
                        <div class="form-group">
                            <label class="form-label" style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Enter your query</label>
                            <textarea id="query-input" class="form-textarea" placeholder="Ask anything about your documents... (e.g., 'What are the main concepts?', 'How is X related to Y?')" style="min-height: 100px; font-size: 14px;"></textarea>
                        </div>
                        
                        <div style="display: flex; gap: 12px; margin-top: 16px;">
                            <button class="btn btn-primary" onclick="executeQuery()" style="flex: 1;">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Execute Query
                            </button>
                            <button class="btn btn-secondary" onclick="clearQuery()">
                                <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Clear
                            </button>
                        </div>
                        
                        <!-- Query Mode Options -->
                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                            <label class="form-label" style="margin-bottom: 8px;">Retrieval Mode</label>
                            <div style="display: flex; gap: 16px;">
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="radio" name="retrieval-mode" value="hybrid" checked onchange="updateRetrievalMode()">
                                    <span style="font-size: 14px;">🔀 Hybrid (Low + High Level)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="radio" name="retrieval-mode" value="low" onchange="updateRetrievalMode()">
                                    <span style="font-size: 14px;">🎯 Low-Level (Entities)</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                    <input type="radio" name="retrieval-mode" value="high" onchange="updateRetrievalMode()">
                                    <span style="font-size: 14px;">🌐 High-Level (Concepts)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Results Section -->
                    <div id="retrieval-results" style="display: none;">
                        <!-- Query Info -->
                        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <svg style="width: 20px; height: 20px; color: #10b981;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <h3 style="font-size: 16px; font-weight: 600; margin: 0;">Query Results</h3>
                            </div>
                            <div id="query-stats" style="font-size: 13px; color: var(--muted-foreground);"></div>
                        </div>
                        
                        <!-- Answer Section -->
                        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <svg style="width: 20px; height: 20px; color: #3b82f6;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                Answer
                            </h3>
                            <div id="query-answer" style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;"></div>
                        </div>
                        
                        <!-- Retrieved Context -->
                        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 20px;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                                <svg style="width: 20px; height: 20px; color: #f59e0b;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                Retrieved Context
                            </h3>
                            <div id="query-context" style="font-size: 13px; color: var(--muted-foreground);"></div>
                        </div>
                    </div>
                    
                    <!-- Empty State -->
                    <div id="retrieval-empty" style="text-align: center; padding: 60px 20px;">
                        <svg style="width: 64px; height: 64px; margin: 0 auto 16px; opacity: 0.5; color: var(--muted-foreground);" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--foreground);">No Query Yet</h3>
                        <p style="color: var(--muted-foreground); margin: 0;">Enter a query above to test the knowledge graph retrieval</p>
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
