/**
 * LightRAG Dashboard JavaScript
 * Extracted from documentUpload.ts for better organization
 * All functions are attached to window for onclick handlers
 */

// VS Code API
const vscode = acquireVsCodeApi();

// State
let documents = [];
let currentFilter = 'all';
let graphRenderer = null;
let graphData = null;
let currentLayout = 'force';

// ==================== TOAST NOTIFICATIONS ====================

function showToast(type, title, message, duration = 5000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    const iconSvg = type === 'success' 
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />'
        : type === 'error'
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />';
    
    toast.innerHTML = `
        <svg class="toast-icon ${type}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${iconSvg}
        </svg>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <svg class="toast-close" width="16" height="16" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" onclick="this.parentElement.remove()">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    `;
    
    container.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// ==================== TAB SWITCHING ====================

window.switchTab = function(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('visible');
        tab.classList.add('hidden');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        selectedTab.classList.add('visible');
    }
    
    // Update tab buttons
    document.querySelectorAll('.tab-trigger').forEach(trigger => {
        trigger.classList.remove('active');
        if (trigger.getAttribute('onclick')?.includes(tabName)) {
            trigger.classList.add('active');
        }
    });
    
    // Note: Graph page is now opened manually via launch card button
    // No automatic navigation to graph page
};

// ==================== DOCUMENT MANAGEMENT ====================

function updateStats(stats) {
    const docEl = document.getElementById('stat-documents');
    const entEl = document.getElementById('stat-entities');
    const relEl = document.getElementById('stat-relationships');
    const chunkEl = document.getElementById('stat-chunks');
    
    if (docEl) docEl.textContent = stats.documents || 0;
    if (entEl) entEl.textContent = stats.entities || 0;
    if (relEl) relEl.textContent = stats.relationships || 0;
    if (chunkEl) chunkEl.textContent = stats.chunks || 0;
    
    // Update graph preview stats
    const previewDocEl = document.getElementById('preview-doc-count');
    const previewEntEl = document.getElementById('preview-entity-count');
    const previewRelEl = document.getElementById('preview-rel-count');
    
    if (previewDocEl) previewDocEl.textContent = stats.documents || 0;
    if (previewEntEl) previewEntEl.textContent = stats.entities || 0;
    if (previewRelEl) previewRelEl.textContent = stats.relationships || 0;
    
    console.log('[Stats] Updated:', stats);
}

window.refreshDocuments = function() {
    vscode.postMessage({ command: 'loadDocuments' });
};

window.clearDocuments = function() {
    if (confirm('Are you sure you want to clear all documents? This action cannot be undone.')) {
        vscode.postMessage({ command: 'clearAllDocuments' });
    }
};

// ==================== QUEUE MANAGEMENT ====================

window.refreshQueue = function() {
    vscode.postMessage({ command: 'getQueueStatus' });
};

window.retryDocument = function(documentId) {
    vscode.postMessage({ 
        command: 'retryDocument',
        documentId: documentId
    });
};

function renderQueue(data) {
    // Update stats
    document.getElementById('queue-pending').textContent = data.status.pending;
    document.getElementById('queue-processing').textContent = data.status.processing;
    document.getElementById('queue-completed').textContent = data.status.completed;
    document.getElementById('queue-failed').textContent = data.status.failed;
    
    // Render queue table
    const tbody = document.getElementById('queue-tbody');
    
    if (data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #888;">No items in queue</td></tr>';
        return;
    }
    
    tbody.innerHTML = data.items.map(item => {
        const statusBadge = getStatusBadge(item.status);
        const progressBar = getProgressBar(item.progress);
        const actions = getQueueActions(item);
        const queuedDate = new Date(item.createdAt).toLocaleString();
        
        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${item.title}</div>
                    <div style="font-size: 12px; color: #888;">${item.fileName}</div>
                </td>
                <td>${statusBadge}</td>
                <td>
                    ${progressBar}
                    <div style="font-size: 12px; color: #888; margin-top: 4px;">${item.currentStep}</div>
                </td>
                <td style="text-align: center;">${item.processedChunks}</td>
                <td style="text-align: center;">${item.totalChunks}</td>
                <td style="font-size: 12px;">${queuedDate}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

function getStatusBadge(status) {
    const badges = {
        pending: '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 500;">⏳ Pending</span>',
        processing: '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 500;">⚙️ Processing</span>',
        completed: '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; background: #d1fae5; color: #065f46; font-size: 12px; font-weight: 500;">✅ Completed</span>',
        failed: '<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 500;">❌ Failed</span>'
    };
    return badges[status] || badges.pending;
}

function getProgressBar(progress) {
    const percentage = Math.round(progress);
    return `
        <div style="width: 100%; background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="width: ${percentage}%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); height: 100%; transition: width 0.3s;"></div>
        </div>
        <div style="font-size: 12px; color: #888; text-align: center; margin-top: 2px;">${percentage}%</div>
    `;
}

function getQueueActions(item) {
    if (item.status === 'failed') {
        return `
            <button class="btn btn-sm" onclick="retryDocument('${item.documentId}')" title="Retry processing">
                <svg style="width: 16px; height: 16px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>
        `;
    }
    return '<span style="color: #888;">—</span>';
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
    // Show custom confirmation dialog instead of browser confirm()
    const doc = documents.find(d => d.id === documentId);
    const docName = doc ? doc.title : 'this document';
    
    showToast('warning', 'Confirm Delete', 
        `Delete "${docName}"? This action cannot be undone. Click again to confirm.`, 
        5000);
    
    // Mark for deletion
    if (window.pendingDelete === documentId) {
        // Second click - confirm deletion
        vscode.postMessage({
            command: 'deleteDocument',
            documentId: documentId
        });
        window.pendingDelete = null;
    } else {
        // First click - mark for deletion
        window.pendingDelete = documentId;
        setTimeout(() => {
            if (window.pendingDelete === documentId) {
                window.pendingDelete = null;
            }
        }, 5000); // Clear after 5 seconds
    }
}

// ==================== UPLOAD MODAL ====================

window.openUploadModal = function() {
    document.getElementById('upload-modal').style.display = 'flex';
    // Initialize drag and drop after modal is visible
    setTimeout(() => initDragAndDrop(), 100);
};

window.closeUploadModal = function() {
    document.getElementById('upload-modal').style.display = 'none';
    
    // Reset form
    document.getElementById('file-input').value = '';
    document.getElementById('document-title').value = '';
    document.getElementById('document-description').value = '';
    document.getElementById('document-category').value = '';
    
    // Reset file preview state
    document.getElementById('upload-area').style.display = 'flex';
    document.getElementById('file-preview').style.display = 'none';
    
    // Clear chunk info
    document.getElementById('chunk-info').style.display = 'none';
};

window.removeFile = function() {
    // Clear file input
    document.getElementById('file-input').value = '';
    
    // Show upload area, hide preview
    document.getElementById('upload-area').style.display = 'flex';
    document.getElementById('file-preview').style.display = 'none';
    
    // Disable upload button
    const uploadBtn = document.getElementById('upload-btn');
    if (uploadBtn) {
        uploadBtn.disabled = true;
    }
};

window.uploadDocument = function() {
    const fileInput = document.getElementById('file-input');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('error', 'No file selected', 'Please select a file to upload');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Show loading toast
    showToast('info', 'Adding to Queue', `Processing ${file.name}...`, 0);
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        
        // Use filename as title (without extension)
        const title = file.name.replace(/\.[^/.]+$/, '');
        
        vscode.postMessage({
            command: 'uploadDocument',
            data: {
                title: title,
                description: '', // Will be generated by Copilot
                category: 'general', // Will be classified by Copilot
                fileName: file.name,
                fileSize: file.size,
                content: content
            }
        });
        
        closeUploadModal();
        showToast('success', 'Document Queued', `"${title}" added to processing queue. Copilot will analyze it.`, 5000);
    };
    
    reader.onerror = function() {
        showToast('error', 'File read error', 'Failed to read the file');
    };
    
    reader.readAsText(file);
};

window.askCopilotForDescription = async function() {
    const fileInput = document.getElementById('file-input');
    const titleInput = document.getElementById('document-title');
    const descriptionTextarea = document.getElementById('document-description');
    const categoryInput = document.getElementById('document-category');
    
    if (!fileInput.files || fileInput.files.length === 0) {
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
        reader.onerror = function() {
            descriptionTextarea.value = originalDesc;
            descriptionTextarea.disabled = false;
            categoryInput.value = originalCategory;
            categoryInput.disabled = false;
            showToast('error', 'File Read Failed', 'Could not read file content');
        };
        reader.readAsText(file);
    } catch (error) {
        descriptionTextarea.value = originalDesc;
        descriptionTextarea.disabled = false;
        categoryInput.value = originalCategory;
        categoryInput.disabled = false;
        showToast('error', 'Analysis Failed', error.message);
    }
};

// ==================== FILE UPLOAD HANDLING ====================

function initDragAndDrop() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    if (!uploadArea || !fileInput) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('drag-over');
        }, false);
    });
    
    uploadArea.addEventListener('drop', function(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect();
        }
    }, false);
    
    fileInput.addEventListener('change', handleFileSelect);
}

function handleFileSelect() {
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const filePreview = document.getElementById('file-preview');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Show file preview
        uploadArea.style.display = 'none';
        filePreview.style.display = 'flex';
        
        // Update file info
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        document.getElementById('file-name').textContent = fileName;
        document.getElementById('file-size').textContent = formatFileSize(file.size) + ' • Ready to queue';
        
        // Enable upload button
        if (uploadBtn) {
            uploadBtn.disabled = false;
        }
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ==================== DOCUMENT RENDERING ====================

function renderDocuments() {
    const tbody = document.getElementById('documents-tbody');
    if (!tbody) return;
    
    const filteredDocs = currentFilter === 'all' 
        ? documents 
        : documents.filter(doc => doc.status === currentFilter);
    
    if (filteredDocs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--muted-foreground);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <svg style="width: 48px; height: 48px; opacity: 0.5;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <div>No documents found</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredDocs.map(doc => `
        <tr>
            <td>
                <div class="text-truncate font-mono" title="${doc.id}">
                    ${doc.id}
                </div>
            </td>
            <td>
                <div class="text-truncate" title="${doc.title}">
                    ${doc.title}
                </div>
            </td>
            <td>
                <span class="status-badge ${doc.status}">
                    ${doc.status === 'completed' ? '✓ Completed' : doc.status === 'failed' ? '✗ Failed' : '⟳ Processing'}
                </span>
            </td>
            <td>${doc.category || '-'}</td>
            <td>${new Date(doc.created).toLocaleString()}</td>
            <td>
                <button class="btn" onclick="deleteDocument('${doc.id}')" style="padding: 6px 12px; font-size: 13px;">
                    <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== RETRIEVAL / QUERY TESTING ====================

let currentRetrievalMode = 'hybrid';

window.updateRetrievalMode = function() {
    const mode = document.querySelector('input[name="retrieval-mode"]:checked').value;
    currentRetrievalMode = mode;
    console.log('[Retrieval] Mode changed to:', mode);
};

window.executeQuery = function() {
    const queryInput = document.getElementById('query-input');
    const query = queryInput.value.trim();
    
    if (!query) {
        showToast('error', 'Empty Query', 'Please enter a query');
        return;
    }
    
    console.log('[Retrieval] Executing query:', query, 'mode:', currentRetrievalMode);
    
    // Show loading state
    const resultsDiv = document.getElementById('retrieval-results');
    const emptyDiv = document.getElementById('retrieval-empty');
    const answerDiv = document.getElementById('query-answer');
    const contextDiv = document.getElementById('query-context');
    const statsDiv = document.getElementById('query-stats');
    
    resultsDiv.style.display = 'block';
    emptyDiv.style.display = 'none';
    
    answerDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted-foreground);">⏳ Processing query...</div>';
    contextDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted-foreground);">Loading context...</div>';
    statsDiv.innerHTML = 'Processing...';
    
    // Send query to extension
    vscode.postMessage({
        command: 'executeQuery',
        data: {
            query: query,
            mode: currentRetrievalMode
        }
    });
};

window.clearQuery = function() {
    document.getElementById('query-input').value = '';
    document.getElementById('retrieval-results').style.display = 'none';
    document.getElementById('retrieval-empty').style.display = 'block';
};

function displayQueryResults(data) {
    console.log('[Retrieval] Displaying results:', data);
    
    const answerDiv = document.getElementById('query-answer');
    const contextDiv = document.getElementById('query-context');
    const statsDiv = document.getElementById('query-stats');
    
    if (!data || data.error) {
        answerDiv.innerHTML = '<div style="padding: 16px; background: #fee2e2; border: 1px solid #fecaca; border-radius: 6px; color: #dc2626;">❌ ' + (data?.error || 'Query failed') + '</div>';
        contextDiv.innerHTML = '';
        statsDiv.innerHTML = 'Query failed';
        showToast('error', 'Query Failed', data?.error || 'An error occurred');
        return;
    }
    
    // Display answer
    answerDiv.innerHTML = data.answer || '<i style="color: var(--muted-foreground);">No answer generated</i>';
    
    // Display context
    if (data.context && data.context.length > 0) {
        let contextHtml = '<div style="display: flex; flex-direction: column; gap: 12px;">';
        
        data.context.forEach((ctx, index) => {
            contextHtml += `
                <div style="padding: 12px; background: var(--muted); border-radius: 6px;">
                    <div style="font-weight: 600; margin-bottom: 6px; font-size: 14px;">
                        ${ctx.type === 'entity' ? '🎯' : '🌐'} ${ctx.type === 'entity' ? 'Entity' : 'Concept'}: ${ctx.name || 'Unknown'}
                    </div>
                    <div style="font-size: 13px; color: var(--muted-foreground);">
                        ${ctx.content || ctx.description || 'No description'}
                    </div>
                    ${ctx.score ? `<div style="margin-top: 6px; font-size: 12px; color: var(--muted-foreground);">Relevance: ${(ctx.score * 100).toFixed(1)}%</div>` : ''}
                </div>
            `;
        });
        
        contextHtml += '</div>';
        contextDiv.innerHTML = contextHtml;
    } else {
        contextDiv.innerHTML = '<i style="color: var(--muted-foreground);">No context retrieved</i>';
    }
    
    // Display stats
    const stats = [];
    if (data.entities) stats.push(`${data.entities} entities`);
    if (data.relationships) stats.push(`${data.relationships} relationships`);
    if (data.processingTime) stats.push(`${data.processingTime}ms`);
    statsDiv.innerHTML = stats.join(' • ') || 'Query completed';
    
    showToast('success', 'Query Complete', `Retrieved ${data.context?.length || 0} context items`);
}

// ==================== GRAPH VISUALIZATION ====================

window.openGraphPage = function() {
    console.log('[Graph] Opening full-page knowledge graph...');
    try {
        // Navigate to dedicated graph page
        vscode.postMessage({ command: 'openGraphPage' });
    } catch (error) {
        console.error('[Graph] Error opening graph page:', error);
        showToast('error', 'Navigation Error', 'Failed to open graph page: ' + error.message);
    }
};

window.loadGraph = function() {
    // Deprecated - redirect to openGraphPage
    openGraphPage();
};

window.resetGraphView = function() {
    if (graphRenderer && graphRenderer.draw) {
        // Reset zoom and pan
        const container = document.getElementById('graph-container');
        const canvas = document.getElementById('graph-canvas');
        if (canvas) {
            renderGraph(graphData);
            showToast('info', 'View Reset', 'Graph view has been reset to default');
        }
    }
};

window.closeNodeDetails = function() {
    const panel = document.getElementById('node-details');
    if (panel) {
        panel.style.display = 'none';
        panel.classList.remove('visible');
    }
};

window.changeLayout = function() {
    const select = document.getElementById('layout-select');
    currentLayout = select.value;
    
    if (graphRenderer && graphData) {
        renderGraph(graphData);
    }
};

window.searchGraph = function() {
    const searchInput = document.getElementById('graph-search');
    const query = searchInput.value.toLowerCase().trim();
    
    if (!graphRenderer || !query) {
        return;
    }

    let found = false;
    graphRenderer.nodes.forEach(node => {
        if (node.label.toLowerCase().includes(query)) {
            node.color = '#ef4444'; // Red highlight
            found = true;
        } else {
            node.color = getNodeColor(node.type);
        }
    });

    graphRenderer.draw();

    if (found) {
        showToast('success', 'Search Results', 'Found nodes matching: ' + query);
    } else {
        showToast('info', 'No Results', 'No nodes found matching: ' + query);
    }
};

function renderGraph(data) {
    console.log('[Graph] Rendering graph with data:', data);
    const container = document.getElementById('graph-container');
    const loading = document.getElementById('graph-loading');
    const empty = document.getElementById('graph-empty');

    if (!data || (!data.nodes || data.nodes.length === 0)) {
        console.log('[Graph] No data to render, showing empty state');
        loading.style.display = 'none';
        empty.style.display = 'flex';
        
        // Remove canvas but keep loading/empty elements
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }
        
        showToast('info', 'No Graph Data', 'Upload documents to generate the knowledge graph');
        return;
    }

    graphData = data;
    
    // Hide loading/empty states
    loading.style.display = 'none';
    empty.style.display = 'none';

    try {
        // Get container dimensions (accounting for loading/empty elements)
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;
        
        // Apply layout to calculate positions
        const nodes = data.nodes.map((node, i) => {
            return {
                ...node,
                x: width / 2 + Math.cos(i * 2 * Math.PI / data.nodes.length) * 200,
                y: height / 2 + Math.sin(i * 2 * Math.PI / data.nodes.length) * 200,
                vx: 0,
                vy: 0
            };
        });

        // Apply force-directed layout if selected
        if (currentLayout === 'force') {
            applyForceLayout(nodes, data.edges, 50);
        }

        // Remove existing canvas if any
        const existingCanvas = container.querySelector('#graph-canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        // Create canvas element properly (don't use innerHTML to avoid removing loading/empty)
        const canvas = document.createElement('canvas');
        canvas.id = 'graph-canvas';
        canvas.width = width;
        canvas.height = height;
        canvas.style.cssText = 'cursor: grab; position: absolute; top: 0; left: 0;';
        container.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');

        let offsetX = 0, offsetY = 0, scale = 1;
        let isDragging = false, dragStart = { x: 0, y: 0 };

        // Draw function
        function draw() {
            ctx.clearRect(0, 0, width, height);
            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);

            // Draw edges
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            data.edges.forEach(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (source && target) {
                    ctx.beginPath();
                    ctx.moveTo(source.x, source.y);
                    ctx.lineTo(target.x, target.y);
                    ctx.stroke();
                }
            });

            // Draw nodes
            nodes.forEach(node => {
                ctx.fillStyle = node.color || getNodeColor(node.type);
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size || 10, 0, 2 * Math.PI);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw label
                ctx.fillStyle = '#1f2937';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(node.label || node.id, node.x, node.y + (node.size || 10) + 15);
            });

            ctx.restore();
        }

        // Mouse interactions
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
            canvas.style.cursor = 'grabbing';
        });

        canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                offsetX = e.clientX - dragStart.x;
                offsetY = e.clientY - dragStart.y;
                draw();
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale *= delta;
            scale = Math.max(0.1, Math.min(5, scale));
            draw();
        });

        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - offsetX) / scale;
            const y = (e.clientY - rect.top - offsetY) / scale;

            // Find clicked node
            const clicked = nodes.find(n => {
                const dx = n.x - x;
                const dy = n.y - y;
                return Math.sqrt(dx * dx + dy * dy) < (n.size || 10);
            });

            if (clicked) {
                showNodeDetails(clicked.id, clicked);
            }
        });

        // Initial draw
        draw();
        graphRenderer = { canvas, draw, nodes, edges: data.edges };

        // Update legend counts
        updateGraphLegend(data);

        showToast('success', 'Graph Loaded', 'Knowledge graph rendered with ' + data.nodes.length + ' nodes and ' + data.edges.length + ' relationships');

    } catch (error) {
        console.error('[Graph] Error rendering graph:', error);
        showToast('error', 'Rendering Error', 'Failed to render graph: ' + error.message);
        empty.style.display = 'flex';
    }
}

// Simple force-directed layout
function applyForceLayout(nodes, edges, iterations) {
    const k = 50; // Spring constant
    
    for (let iter = 0; iter < iterations; iter++) {
        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].vx = 0;
            nodes[i].vy = 0;
            
            for (let j = 0; j < nodes.length; j++) {
                if (i !== j) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = k * k / dist;
                    nodes[i].vx += (dx / dist) * force * 0.1;
                    nodes[i].vy += (dy / dist) * force * 0.1;
                }
            }
        }
        
        // Attraction along edges
        edges.forEach(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (source && target) {
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = dist / k;
                source.vx += (dx / dist) * force * 0.1;
                source.vy += (dy / dist) * force * 0.1;
                target.vx -= (dx / dist) * force * 0.1;
                target.vy -= (dy / dist) * force * 0.1;
            }
        });
        
        // Apply velocities
        nodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;
        });
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

// Show node details panel
function showNodeDetails(nodeId, attributes) {
    const panel = document.getElementById('node-details');
    const title = document.getElementById('node-title');
    const type = document.getElementById('node-type');
    const meta = document.getElementById('node-metadata');

    if (!panel || !title || !type || !meta) {
        console.warn('[Graph] Node details elements not found in DOM');
        return;
    }

    title.textContent = attributes.label || nodeId;
    
    // Enhanced type display with icon
    const typeIcons = {
        'document': '📄',
        'entity': '🏷️',
        'chunk': '📝',
        'relationship': '🔗'
    };
    const typeIcon = typeIcons[attributes.type] || '•';
    type.textContent = typeIcon + ' Type: ' + (attributes.type || 'unknown');
    
    // Format metadata with enhanced display for chunks
    let metaHtml = '';
    if (attributes.metadata && Object.keys(attributes.metadata).length > 0) {
        metaHtml = '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">';
        
        // Special handling for chunk content
        if (attributes.type === 'chunk' && attributes.metadata.fullContent) {
            metaHtml += '<div style="margin-bottom: 12px;">';
            metaHtml += '<strong style="display: block; margin-bottom: 8px; color: var(--foreground);">Content:</strong>';
            metaHtml += '<div style="background: var(--background); border: 1px solid var(--border); border-radius: 6px; padding: 12px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; color: var(--muted-foreground);">';
            metaHtml += escapeHtml(attributes.metadata.fullContent);
            metaHtml += '</div></div>';
        }
        
        // Display other metadata
        Object.keys(attributes.metadata).forEach(key => {
            // Skip fullContent as we've already displayed it
            if (key === 'fullContent') { return; }
            
            const value = attributes.metadata[key];
            metaHtml += '<div style="margin-bottom: 8px;">';
            metaHtml += '<strong>' + formatMetadataKey(key) + ':</strong> ';
            
            // Format value based on type
            if (typeof value === 'number') {
                metaHtml += '<span style="color: #10b981;">' + value + '</span>';
            } else if (Array.isArray(value)) {
                metaHtml += '<span style="color: #3b82f6;">[' + value.length + ' items]</span>';
            } else {
                metaHtml += value;
            }
            metaHtml += '</div>';
        });
        metaHtml += '</div>';
    }
    meta.innerHTML = metaHtml;

    panel.style.display = 'block';
    panel.classList.add('visible');
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format metadata keys nicely
function formatMetadataKey(key) {
    return key
        .replace(/([A-Z])/g, ' $1') // Add space before capitals
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .trim();
}

// Update legend counts
function updateGraphLegend(data) {
    const counts = {
        document: 0,
        entity: 0,
        relationship: 0
    };

    // Count nodes by type
    data.nodes.forEach(node => {
        if (counts.hasOwnProperty(node.type)) {
            counts[node.type]++;
        }
    });

    // Count relationship edges (edges between entities with specific color)
    data.edges.forEach(edge => {
        // Relationship edges have color #f97316 and connect entities
        if (edge.color === '#f97316') {
            counts.relationship++;
        }
    });

    const docCount = document.getElementById('doc-count');
    const entityCount = document.getElementById('entity-count');
    const relCount = document.getElementById('rel-count');

    if (docCount) {docCount.textContent = 'Documents: ' + counts.document;}
    if (entityCount) {entityCount.textContent = 'Entities: ' + counts.entity;}
    if (relCount) {relCount.textContent = 'Relationships: ' + counts.relationship;}
}

// ==================== MESSAGE HANDLING ====================

window.addEventListener('message', function(event) {
    const message = event.data;
    console.log('[Dashboard] Message received:', message.command);
    
    switch (message.command) {
        case 'initialData':
            documents = message.documents || [];
            renderDocuments();
            
            // Update stats
            if (message.stats) {
                updateStats(message.stats);
            }
            
            // Always respect the activeTab parameter, default to 'documents'
            const tabToActivate = message.activeTab || 'documents';
            switchTab(tabToActivate);
            break;
            
        case 'documentsLoaded':
            documents = message.data.documents || [];
            renderDocuments();
            
            // Update stats
            if (message.data.stats) {
                updateStats(message.data.stats);
            }
            
            // Ensure we stay on documents tab after loading
            switchTab('documents');
            break;
            
        case 'documentAdded':
            documents.unshift(message.data);
            renderDocuments();
            showToast('success', 'Document uploaded', 'Processing will complete in background');
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
            
        case 'graphD3HTML':
            // Use data URI to load HTML (works reliably in VS Code iframes)
            console.log('[Graph] Received D3.js HTML, loading in iframe...');
            const iframe = document.getElementById('graph-d3-iframe');
            if (iframe) {
                // Convert HTML to base64 data URI
                const base64Html = btoa(unescape(encodeURIComponent(message.data)));
                iframe.src = 'data:text/html;base64,' + base64Html;
                iframe.style.display = 'block';
                
                // Wait for iframe to load
                iframe.onload = function() {
                    console.log('[Graph] D3.js iframe loaded via data URI, requesting graph data...');
                    setTimeout(() => {
                        vscode.postMessage({ command: 'getGraphData' });
                    }, 500);
                };
            }
            break;
        
        case 'graphD3HTMLError':
            console.error('[Graph] Failed to load D3.js HTML:', message.data.message);
            const loading = document.getElementById('graph-loading');
            const empty = document.getElementById('graph-empty');
            if (loading) loading.style.display = 'none';
            if (empty) {
                empty.style.display = 'flex';
                empty.querySelector('h3').textContent = 'Failed to Load Graph';
                empty.querySelector('p').textContent = message.data.message;
            }
            showToast('error', 'Graph Error', message.data.message);
            break;
        
        case 'graphData':
            // Send data to D3.js iframe
            console.log('[Graph] Received graph data, sending to D3.js iframe...');
            const graphIframe = document.getElementById('graph-d3-iframe');
            if (graphIframe && graphIframe.contentWindow) {
                graphIframe.contentWindow.postMessage({
                    command: 'graphData',
                    data: message.data
                }, '*');
                
                // Hide loading
                const graphLoading = document.getElementById('graph-loading');
                const graphEmpty = document.getElementById('graph-empty');
                if (graphLoading) graphLoading.style.display = 'none';
                if (graphEmpty) graphEmpty.style.display = 'none';
                
                showToast('success', 'Graph Loaded', `Loaded ${message.data.nodes.length} nodes and ${message.data.edges.length} edges`);
            }
            updateGraphLegend(message.data);
            break;
            
        case 'queryResults':
            displayQueryResults(message.data);
            break;
            
        case 'descriptionGenerated':
            const descriptionTextarea = document.getElementById('document-description');
            const categoryInput = document.getElementById('document-category');
            const chunkInfo = document.getElementById('chunk-info');
            const chunkInfoText = document.getElementById('chunk-info-text');
            
            if (message.data.description) {
                descriptionTextarea.value = message.data.description;
                descriptionTextarea.disabled = false;
            }
            
            if (message.data.category) {
                categoryInput.value = message.data.category;
                categoryInput.disabled = false;
            }
            
            if (message.data.chunkInfo) {
                chunkInfoText.textContent = message.data.chunkInfo;
                chunkInfo.style.display = 'block';
            }
            
            showToast('success', 'Analysis Complete', 'Document metadata generated by Copilot');
            break;
            
        case 'queryResult':
            console.log('[Retrieval] Query result received:', message.data);
            displayQueryResults(message.data);
            break;
            
        case 'queueStatus':
            console.log('[Queue] Status received:', message.data);
            renderQueue(message.data);
            break;
            
        case 'uploadError':
        case 'loadError':
        case 'deleteError':
        case 'graphDataError':
            showToast('error', 'Error', message.data.message);
            break;
    }
});

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('[Dashboard] DOM loaded, initializing...');
    
    // Ensure Documents tab is active by default
    switchTab('documents');
    
    // Initialize document refresh
    refreshDocuments();
    
    // Start queue auto-refresh (every 3 seconds)
    setInterval(function() {
        // Only refresh if queue tab is visible
        const queueTab = document.getElementById('queue-tab');
        if (queueTab && queueTab.classList.contains('visible')) {
            refreshQueue();
        }
    }, 3000);
    
    // Close modal on background click
    const uploadModal = document.getElementById('upload-modal');
    if (uploadModal) {
        uploadModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeUploadModal();
            }
        });
    }
});
