// VS Code API
const vscode = acquireVsCodeApi();

// State
let graphData = null;
let originalGraphData = null;
let simulation = null;
let svg = null;
let g = null;
let zoom = null;
let isInitialized = false;
let dataRequested = false;
let searchTimeout = null;
let filters = {
    search: '',
    types: { document: true, entity: true, relationship: false, chunk: true },
    category: '',
    dateFrom: null,
    dateTo: null
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Graph Page] Initializing...');
    if (!dataRequested) {
        dataRequested = true;
        requestGraphData();
    }
});

// Request graph data from extension
function requestGraphData() {
    console.log('[Graph Page] Requesting graph data...');
    vscode.postMessage({ command: 'getGraphData' });
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    
    if (message.command === 'graphData') {
        console.log('[Graph Page] Received graph data:', message.data);
        console.log('[Graph Page] Nodes:', message.data.nodes?.length, 'Edges:', message.data.edges?.length);
        
        // Prevent duplicate initialization
        if (isInitialized) {
            console.warn('[Graph Page] Already initialized, skipping duplicate data');
            return;
        }
        
        graphData = message.data;
        originalGraphData = JSON.parse(JSON.stringify(message.data)); // Deep copy
        isInitialized = true;
        initializeGraph();
        setupFilters();
        populateCategories();
        buildTimeline();
        document.getElementById('loading').style.display = 'none';
    }
});

// Navigate back to dashboard
function goBack() {
    vscode.postMessage({ command: 'backToDashboard' });
}

// Initialize D3.js graph
function initializeGraph() {
    if (!graphData || !graphData.nodes || !graphData.edges) return;

    const width = window.innerWidth - 280;
    const height = window.innerHeight - 48 - 49; // header + stats bar

    // Setup SVG
    svg = d3.select('#graph-svg')
        .attr('width', width)
        .attr('height', height);

    // Setup zoom
    zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoom);

    // Click on background to close node details
    svg.on('click', function(event) {
        if (event.target === this) {
            closeNodeDetails();
            g.selectAll('circle').attr('stroke', '#1e1e1e').attr('stroke-width', 2);
        }
    });

    // Main group
    g = svg.append('g');

    // Setup simulation with stronger forces to keep nodes closer
    simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.edges)
            .id(d => d.id)
            .distance(80))
        .force('charge', d3.forceManyBody().strength(-500))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 5))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY(height / 2).strength(0.1));

    renderGraph();
    updateStats();
}

// Render graph
function renderGraph() {
    if (!graphData || !graphData.nodes || !simulation) return;

    console.log('[Render] Rendering graph with', graphData.nodes.length, 'nodes');

    // Clear existing
    g.selectAll('*').remove();

    // Draw edges
    const links = g.append('g')
        .selectAll('line')
        .data(graphData.edges)
        .enter()
        .append('line')
        .attr('stroke', '#3c3c3c')
        .attr('stroke-width', 1)
        .attr('opacity', 0.6);

    // Draw nodes
    const nodeGroup = g.append('g');
    
    const nodes = nodeGroup
        .selectAll('g')
        .data(graphData.nodes)
        .enter()
        .append('g')
        .call(drag(simulation))
        .on('click', function(event, d) {
            event.stopPropagation();
            showNodeDetails(d);
            // Highlight clicked node
            nodeGroup.selectAll('circle').attr('stroke', '#1e1e1e').attr('stroke-width', 2);
            d3.select(this).select('circle').attr('stroke', '#fbbf24').attr('stroke-width', 4);
        })
        .on('mouseover', function(event, d) {
            d3.select(this).select('circle')
                .attr('stroke', '#0e639c')
                .attr('stroke-width', 3);
        })
        .on('mouseout', function(event, d) {
            const isSelected = document.getElementById('node-details-panel').style.display === 'block';
            if (!isSelected) {
                d3.select(this).select('circle')
                    .attr('stroke', '#1e1e1e')
                    .attr('stroke-width', 2);
            }
        });

    // Add circles
    nodes.append('circle')
        .attr('r', d => getNodeSize(d))
        .attr('fill', d => getNodeColor(d))
        .attr('stroke', '#1e1e1e')
        .attr('stroke-width', 2);

    // Add text labels for documents with icons
    nodes.filter(d => d.type === 'document' && d.metadata?.fileCategory)
        .append('text')
        .text(d => getCategoryIcon(d.metadata.fileCategory))
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', d => getNodeSize(d) * 0.8 + 'px')
        .attr('pointer-events', 'none')
        .style('user-select', 'none');

    // Update positions
    simulation.on('tick', () => {
        links
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        nodes
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

// Helper functions
function getNodeColor(node) {
    // Use category colors for documents
    if (node.type === 'document' && node.metadata?.fileCategory) {
        const categoryColors = {
            'markdown': '#10b981',
            'documentation': '#10b981',
            'text': '#6b7280',
            'csharp': '#68217a',
            'dotnet': '#512bd4',
            'java': '#b07219',
            'python': '#3572A5',
            'ruby': '#701516',
            'go': '#00ADD8',
            'rust': '#dea584',
            'php': '#4F5D95',
            'javascript': '#f1e05a',
            'typescript': '#2b7489',
            'react': '#61dafb',
            'vue': '#41b883',
            'angular': '#dd0031',
            'svelte': '#ff3e00',
            'css': '#563d7c',
            'scss': '#c6538c',
            'html': '#e34c26',
            'xml': '#0060ac',
            'json': '#292929',
            'yaml': '#cb171e',
            'sql': '#e38c00',
            'mongodb': '#4db33d',
            'graphql': '#e10098',
            'shell': '#89e051',
            'powershell': '#012456',
            'dockerfile': '#384d54',
            'unknown': '#9ca3af'
        };
        return categoryColors[node.metadata.fileCategory] || categoryColors.unknown;
    }
    
    // Default colors by type
    const colors = {
        'document': '#4a9eff',
        'entity': '#4ec9b0',
        'relationship': '#ce9178',
        'chunk': '#c586c0'
    };
    return colors[node.type] || '#cccccc';
}

function getNodeSize(node) {
    if (node.type === 'document') {
        return node.size || 15; // Use size from backend
    }
    return node.size || (node.importance ? 5 + (node.importance * 15) : 8);
}

function getCategoryIcon(category) {
    const icons = {
        'markdown': '📝',
        'documentation': '📄',
        'text': '📃',
        'csharp': '💜',
        'dotnet': '🔵',
        'java': '☕',
        'python': '🐍',
        'ruby': '💎',
        'go': '🔷',
        'rust': '🦀',
        'php': '🐘',
        'javascript': '🟨',
        'typescript': '🔷',
        'react': '⚛️',
        'vue': '💚',
        'angular': '🅰️',
        'svelte': '🧡',
        'css': '🎨',
        'scss': '🎨',
        'html': '🌐',
        'xml': '📋',
        'json': '📦',
        'yaml': '⚙️',
        'sql': '🗄️',
        'mongodb': '🍃',
        'graphql': '◼️',
        'shell': '💻',
        'powershell': '🖥️',
        'dockerfile': '🐳',
        'unknown': '📄'
    };
    return icons[category] || icons.unknown;
}

function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

function updateStats() {
    if (!graphData) return;
    
    const visibleNodes = graphData.nodes.length;
    const visibleEdges = graphData.edges.length;
    const totalNodes = originalGraphData ? originalGraphData.nodes.length : visibleNodes;
    
    document.getElementById('stat-nodes').textContent = totalNodes;
    document.getElementById('stat-edges').textContent = originalGraphData ? originalGraphData.edges.length : visibleEdges;
    document.getElementById('stat-filtered').textContent = visibleNodes;
    
    if (graphData.statistics) {
        document.getElementById('stat-confidence').textContent = 
            (graphData.statistics.avgConfidence || 0).toFixed(1) + '%';
    }

    console.log('[Stats] Total:', totalNodes, 'Visible:', visibleNodes);
}

function resetView() {
    // Reset zoom
    svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
    );
    
    // Reload graph data
    console.log('[Reset] Reloading graph data...');
    vscode.postMessage({ command: 'getGraphData' });
}

function zoomIn() {
    svg.transition().duration(750).call(zoom.scaleBy, 1.3);
}

function zoomOut() {
    svg.transition().duration(750).call(zoom.scaleBy, 0.7);
}

function exportImage() {
    alert('Export feature coming soon!');
}

// ============ FILTER FUNCTIONS ============

function setupFilters() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filters.search = e.target.value.toLowerCase();
            applyFilters();
        }, 300);
    });

    // Type checkboxes
    document.getElementById('filter-documents').addEventListener('change', (e) => {
        filters.types.document = e.target.checked;
        applyFilters();
    });
    document.getElementById('filter-entities').addEventListener('change', (e) => {
        filters.types.entity = e.target.checked;
        applyFilters();
    });
    document.getElementById('filter-relationships').addEventListener('change', (e) => {
        filters.types.relationship = e.target.checked;
        applyFilters();
    });
    document.getElementById('filter-chunks').addEventListener('change', (e) => {
        filters.types.chunk = e.target.checked;
        applyFilters();
    });

    // Category filter
    document.getElementById('category-filter').addEventListener('change', (e) => {
        filters.category = e.target.value;
        console.log('[Filter] Category changed to:', filters.category);
        applyFilters();
    });

    // Date range is handled by timeline drag selection
}

function applyFilters() {
    if (!originalGraphData) return;

    console.log('[Filters] Applying filters:', filters);

    // Deep copy nodes to avoid D3.js mutations
    let filteredNodes = originalGraphData.nodes
        .filter(node => {
            // Type filter
            if (!filters.types[node.type]) return false;

            // Search filter
            if (filters.search && !node.label.toLowerCase().includes(filters.search)) {
                return false;
            }

            // Category filter
            if (filters.category && node.metadata?.fileCategory !== filters.category) {
                return false;
            }

            // Date filter
            if (node.metadata?.created) {
                const nodeDate = new Date(node.metadata.created);
                if (filters.dateFrom && nodeDate < new Date(filters.dateFrom)) return false;
                if (filters.dateTo && nodeDate > new Date(filters.dateTo)) return false;
            }

            return true;
        })
        .map(node => ({ ...node })); // Create shallow copies

    console.log('[Filters] Filtered nodes:', filteredNodes.length, 'of', originalGraphData.nodes.length);

    // Get IDs of filtered nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter edges (only keep edges between visible nodes) - also copy
    let filteredEdges = originalGraphData.edges
        .filter(edge => {
            const sourceId = edge.source.id || edge.source;
            const targetId = edge.target.id || edge.target;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
        })
        .map(edge => ({
            ...edge,
            source: edge.source.id || edge.source,
            target: edge.target.id || edge.target
        }));

    console.log('[Filters] Filtered edges:', filteredEdges.length, 'of', originalGraphData.edges.length);

    // Update graphData with fresh copies
    graphData = {
        nodes: filteredNodes,
        edges: filteredEdges,
        statistics: originalGraphData.statistics
    };

    // Stop old simulation
    if (simulation) {
        simulation.stop();
    }

    // Reinitialize graph completely
    const width = window.innerWidth - 280;
    const height = window.innerHeight - 48 - 49;

    // Setup new simulation with same forces
    simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.edges)
            .id(d => d.id)
            .distance(80))
        .force('charge', d3.forceManyBody().strength(-500))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 5))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY(height / 2).strength(0.1));

    // Re-render
    renderGraph();
    updateStats();
}

function clearFilters() {
    filters = {
        search: '',
        types: { document: true, entity: true, relationship: false, chunk: true },
        category: '',
        dateFrom: null,
        dateTo: null
    };

    document.getElementById('search-input').value = '';
    document.getElementById('filter-documents').checked = true;
    document.getElementById('filter-entities').checked = true;
    document.getElementById('filter-relationships').checked = false;
    document.getElementById('filter-chunks').checked = true;
    document.getElementById('category-filter').value = '';

    // Reset timeline
    if (timelineData.monthCounts && timelineData.monthCounts.length > 0) {
        timelineData.startIndex = 0;
        timelineData.endIndex = timelineData.monthCounts.length - 1;
        updateTimelineSelection();
        document.getElementById('timeline-range-text').textContent = 'Click and drag to filter • Double-click to reset';
    }

    applyFilters();
}

function populateCategories() {
    const categories = new Set();
    originalGraphData.nodes.forEach(node => {
        if (node.metadata?.fileCategory) {
            categories.add(node.metadata.fileCategory);
        }
    });

    const select = document.getElementById('category-filter');
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        select.appendChild(option);
    });
}

// ============ NODE DETAILS PANEL ============

function showNodeDetails(node) {
    const panel = document.getElementById('node-details-panel');
    const content = document.getElementById('node-details-content');
    
    let html = `
        <div class="detail-row">
            <div class="detail-label">Type</div>
            <div class="detail-value">
                <span class="detail-badge" style="background: ${getNodeColor(node)}">${node.type.toUpperCase()}</span>
            </div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">Label</div>
            <div class="detail-value"><strong>${node.label}</strong></div>
        </div>
        
        <div class="detail-row">
            <div class="detail-label">ID</div>
            <div class="detail-value" style="font-size: 10px; color: #858585;">${node.id}</div>
        </div>
    `;

    // Metadata
    if (node.metadata) {
        const meta = node.metadata;
        
        if (meta.fileName) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">File Name</div>
                    <div class="detail-value">${meta.fileName}</div>
                </div>
            `;
        }
        
        if (meta.filePath) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">File Path</div>
                    <div class="detail-value" style="font-size: 11px; word-break: break-all;">${meta.filePath}</div>
                </div>
            `;
        }
        
        if (meta.fileCategory) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Category</div>
                    <div class="detail-value">
                        <span class="detail-badge">${meta.fileCategory}</span>
                    </div>
                </div>
            `;
        }
        
        if (meta.entityType) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Entity Type</div>
                    <div class="detail-value">${meta.entityType}</div>
                </div>
            `;
        }
        
        if (meta.description) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Description</div>
                    <div class="detail-value">${meta.description}</div>
                </div>
            `;
        }
        
        if (meta.contentPreview) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Content Preview</div>
                    <div class="detail-value" style="font-size: 11px; max-height: 100px; overflow-y: auto; background: #1e1e1e; padding: 8px; border-radius: 4px;">${meta.contentPreview}</div>
                </div>
            `;
        }
        
        if (meta.sourceDocumentsCount) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Source Documents</div>
                    <div class="detail-value">${meta.sourceDocumentsCount} document(s)</div>
                </div>
            `;
        }
        
        if (meta.confidence !== undefined) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Confidence</div>
                    <div class="detail-value">${(meta.confidence * 100).toFixed(1)}%</div>
                </div>
            `;
        }
        
        if (meta.created) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Created</div>
                    <div class="detail-value">${new Date(meta.created).toLocaleString()}</div>
                </div>
            `;
        }
        
        if (meta.tags && meta.tags.length > 0) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Tags</div>
                    <div class="detail-value">
                        ${meta.tags.map(tag => `<span class="detail-badge">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (meta.lineRange) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Line Range</div>
                    <div class="detail-value">${meta.lineRange}</div>
                </div>
            `;
        }
    }

    // Connections
    if (node.connections) {
        html += `
            <div class="detail-row">
                <div class="detail-label">Connections</div>
                <div class="detail-value">
                    <span class="detail-badge" style="background: #10b981;">↓ ${node.connections.incoming || 0} In</span>
                    <span class="detail-badge" style="background: #ef4444;">↑ ${node.connections.outgoing || 0} Out</span>
                </div>
            </div>
        `;
    }

    // Metrics
    if (node.metrics && node.metrics.importance !== undefined) {
        html += `
            <div class="detail-row">
                <div class="detail-label">Importance</div>
                <div class="detail-value">${(node.metrics.importance * 100).toFixed(1)}%</div>
            </div>
        `;
    }

    content.innerHTML = html;
    panel.style.display = 'block';
}

function closeNodeDetails() {
    document.getElementById('node-details-panel').style.display = 'none';
}

// ============ TIMELINE SLIDER ============

let timelineData = {
    dates: [],
    minDate: null,
    maxDate: null,
    monthCounts: {},
    bars: [],
    isDragging: false,
    startX: 0,
    startIndex: 0,
    endIndex: 0
};

function buildTimeline() {
    if (!originalGraphData) return;

    // Extract dates from nodes
    const dates = originalGraphData.nodes
        .filter(n => n.metadata?.created)
        .map(n => ({
            date: new Date(n.metadata.created),
            node: n
        }));

    if (dates.length === 0) {
        document.getElementById('timeline-info').textContent = 'No date information available';
        return;
    }

    dates.sort((a, b) => a.date - b.date);
    const minDate = dates[0].date;
    const maxDate = dates[dates.length - 1].date;

    timelineData.dates = dates;
    timelineData.minDate = minDate;
    timelineData.maxDate = maxDate;

    // Build histogram by month
    const monthCounts = {};
    const monthData = [];
    dates.forEach(item => {
        const monthKey = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthCounts[monthKey]) {
            monthCounts[monthKey] = { count: 0, date: new Date(item.date.getFullYear(), item.date.getMonth(), 1) };
        }
        monthCounts[monthKey].count++;
    });

    // Convert to array and sort
    Object.entries(monthCounts).forEach(([key, value]) => {
        monthData.push({ key, ...value });
    });
    monthData.sort((a, b) => a.date - b.date);

    timelineData.monthCounts = monthData;
    timelineData.startIndex = 0;
    timelineData.endIndex = monthData.length - 1;

    // Create interactive bar chart
    const chartContainer = document.getElementById('timeline-chart');
    chartContainer.innerHTML = '';
    chartContainer.style.display = 'flex';
    chartContainer.style.alignItems = 'flex-end';
    chartContainer.style.gap = '2px';
    chartContainer.style.position = 'relative';

    const maxCount = Math.max(...monthData.map(m => m.count));
    timelineData.bars = [];

    monthData.forEach((month, index) => {
        const bar = document.createElement('div');
        const height = (month.count / maxCount) * 60;
        bar.style.flex = '1';
        bar.style.height = height + 'px';
        bar.style.background = '#0e639c';
        bar.style.borderRadius = '2px';
        bar.style.cursor = 'pointer';
        bar.title = `${month.key}: ${month.count} nodes`;
        bar.className = 'timeline-bar';
        bar.dataset.index = index;
        chartContainer.appendChild(bar);
        timelineData.bars.push(bar);
    });

    // Add drag selection
    let selectionDiv = document.createElement('div');
    selectionDiv.className = 'timeline-selection';
    selectionDiv.style.display = 'none';
    chartContainer.appendChild(selectionDiv);

    // Mouse events for drag selection
    chartContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('timeline-bar')) {
            timelineData.isDragging = true;
            timelineData.startIndex = parseInt(e.target.dataset.index);
            timelineData.endIndex = timelineData.startIndex;
            updateTimelineSelection();
        }
    });

    chartContainer.addEventListener('mousemove', (e) => {
        if (timelineData.isDragging && e.target.classList.contains('timeline-bar')) {
            timelineData.endIndex = parseInt(e.target.dataset.index);
            updateTimelineSelection();
        }
    });

    chartContainer.addEventListener('mouseup', () => {
        if (timelineData.isDragging) {
            timelineData.isDragging = false;
            applyTimelineFilter();
        }
    });

    chartContainer.addEventListener('mouseleave', () => {
        if (timelineData.isDragging) {
            timelineData.isDragging = false;
            applyTimelineFilter();
        }
    });

    // Double click to reset
    chartContainer.addEventListener('dblclick', () => {
        timelineData.startIndex = 0;
        timelineData.endIndex = monthData.length - 1;
        filters.dateFrom = null;
        filters.dateTo = null;
        updateTimelineSelection();
        applyFilters();
    });

    document.getElementById('timeline-info').textContent = 
        `${dates.length} nodes from ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`;
    
    document.getElementById('timeline-range-text').textContent = 'Click and drag to filter • Double-click to reset';
}

function updateTimelineSelection() {
    const container = document.getElementById('timeline-chart');
    const selection = container.querySelector('.timeline-selection');
    
    if (!selection || timelineData.bars.length === 0) return;

    const start = Math.min(timelineData.startIndex, timelineData.endIndex);
    const end = Math.max(timelineData.startIndex, timelineData.endIndex);

    // Highlight selected bars
    timelineData.bars.forEach((bar, index) => {
        if (index >= start && index <= end) {
            bar.style.background = '#1177bb';
        } else {
            bar.style.background = '#0e639c';
        }
    });

    // Show selection overlay
    const firstBar = timelineData.bars[start];
    const lastBar = timelineData.bars[end];
    const containerRect = container.getBoundingClientRect();
    const firstRect = firstBar.getBoundingClientRect();
    const lastRect = lastBar.getBoundingClientRect();

    selection.style.display = 'block';
    selection.style.left = (firstRect.left - containerRect.left) + 'px';
    selection.style.width = (lastRect.right - firstRect.left) + 'px';
}

function applyTimelineFilter() {
    const start = Math.min(timelineData.startIndex, timelineData.endIndex);
    const end = Math.max(timelineData.startIndex, timelineData.endIndex);

    const startMonth = timelineData.monthCounts[start];
    const endMonth = timelineData.monthCounts[end];

    // Set date range
    const fromDate = new Date(startMonth.date);
    const toDate = new Date(endMonth.date);
    toDate.setMonth(toDate.getMonth() + 1); // End of month

    filters.dateFrom = fromDate.toISOString().split('T')[0];
    filters.dateTo = toDate.toISOString().split('T')[0];

    document.getElementById('timeline-range-text').textContent = 
        `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;

    applyFilters();
}

// Window resize
window.addEventListener('resize', () => {
    if (simulation) {
        const width = window.innerWidth - 280;
        const height = window.innerHeight - 48 - 49;
        svg.attr('width', width).attr('height', height);
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
    }
});
