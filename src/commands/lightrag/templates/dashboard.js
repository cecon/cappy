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
    });
    event.target.classList.add('active');
    
    // Load graph if switching to graph tab
    if (tabName === 'graph') {
        loadGraph();
    }
};

// ==================== DOCUMENT MANAGEMENT ====================

window.refreshDocuments = function() {
    vscode.postMessage({ command: 'loadDocuments' });
};

window.clearDocuments = function() {
    if (confirm('Are you sure you want to clear all documents? This action cannot be undone.')) {
        vscode.postMessage({ command: 'clearAllDocuments' });
    }
};

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
            documentId: documentId
        });
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
    
    // Clear title if it was auto-filled
    document.getElementById('document-title').value = '';
    document.getElementById('chunk-info').style.display = 'none';
};

window.uploadDocument = function() {
    const fileInput = document.getElementById('file-input');
    const title = document.getElementById('document-title').value;
    const description = document.getElementById('document-description').value;
    const category = document.getElementById('document-category').value;
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('error', 'No file selected', 'Please select a file to upload');
        return;
    }
    
    if (!title.trim()) {
        showToast('error', 'Title required', 'Please enter a document title');
        return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        
        vscode.postMessage({
            command: 'uploadDocument',
            data: {
                title: title.trim(),
                description: description.trim(),
                category: category.trim() || 'general',
                fileName: file.name,
                fileSize: file.size,
                content: content
            }
        });
        
        closeUploadModal();
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
    const titleInput = document.getElementById('document-title');
    
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Show file preview
        uploadArea.style.display = 'none';
        filePreview.style.display = 'flex';
        
        // Update file info
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = formatFileSize(file.size);
        
        // Auto-fill title if empty
        if (!titleInput.value) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }
        
        // Show chunk suggestion
        const chunkCount = Math.ceil(file.size / 1000);
        document.getElementById('chunk-info').style.display = 'block';
        document.getElementById('chunk-info-text').textContent = 
            `This document will be split into approximately ${chunkCount} chunks for optimal processing.`;
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

// ==================== GRAPH VISUALIZATION ====================

window.loadGraph = function() {
    console.log('[Graph] Loading graph data...');
    const container = document.getElementById('graph-container');
    const loading = document.getElementById('graph-loading');
    const empty = document.getElementById('graph-empty');
    
    if (!container) {
        console.error('[Graph] Graph container not found');
        return;
    }
    
    // Show loading state (elements are inside container, don't clear innerHTML)
    if (loading) {
        loading.style.display = 'flex';
    }
    if (empty) {
        empty.style.display = 'none';
    }
    
    // Remove any existing graph canvas/svg (keep loading/empty divs)
    const existingCanvas = container.querySelector('canvas');
    const existingSvg = container.querySelector('svg');
    if (existingCanvas) existingCanvas.remove();
    if (existingSvg) existingSvg.remove();
    
    console.log('[Graph] Requesting graph data from extension...');
    vscode.postMessage({ command: 'getGraphData' });
};

window.resetGraphView = function() {
    if (!graphRenderer) {
        return;
    }
    
    const camera = graphRenderer.getCamera();
    camera.animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 500 });
};

window.closeNodeDetails = function() {
    const panel = document.getElementById('node-details-panel');
    if (panel) {
        panel.classList.remove('visible');
    }
};

function renderGraph(data) {
    console.log('[Graph] Rendering graph data:', data);
    
    const loading = document.getElementById('graph-loading');
    const empty = document.getElementById('graph-empty');
    const container = document.getElementById('graph-container');
    
    // Hide loading
    if (loading) {
        loading.style.display = 'none';
    }
    
    // Check if we have data
    if (!data || !data.nodes || data.nodes.length === 0) {
        console.log('[Graph] No graph data to display');
        if (empty) {
            empty.style.display = 'flex';
        }
        return;
    }
    
    // Hide empty message
    if (empty) {
        empty.style.display = 'none';
    }
    
    console.log('[Graph] Graph visualization will be implemented in next iteration');
    console.log(`[Graph] Nodes: ${data.nodes.length}, Edges: ${data.edges ? data.edges.length : 0}`);
    
    // TODO: Implement actual graph rendering (Sigma.js, D3.js, or Force-Graph)
    // For now, just show a message
    if (container) {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%; color: var(--muted-foreground); font-size: 14px;';
        placeholder.textContent = `Graph visualization ready: ${data.nodes.length} nodes, ${data.edges ? data.edges.length : 0} edges`;
        
        // Remove old placeholder if exists
        const oldPlaceholder = container.querySelector('div:not(#graph-loading):not(#graph-empty)');
        if (oldPlaceholder) oldPlaceholder.remove();
        
        container.appendChild(placeholder);
    }
}

// ==================== MESSAGE HANDLING ====================

window.addEventListener('message', function(event) {
    const message = event.data;
    console.log('[Dashboard] Message received:', message.command);
    
    switch (message.command) {
        case 'initialData':
            documents = message.documents || [];
            renderDocuments();
            if (message.activeTab) {
                switchTab(message.activeTab);
            }
            break;
            
        case 'documentsLoaded':
            documents = message.data.documents || [];
            renderDocuments();
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
            
        case 'graphData':
            renderGraph(message.data);
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
    refreshDocuments();
});

// Close modal on background click
document.getElementById('upload-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeUploadModal();
    }
});
