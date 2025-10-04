/**
 * Test graph visualization directly in browser
 * Usage: node test-graph-viewer.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// Path to Mini-LightRAG data
const storageBase = path.join(
    process.env.APPDATA,
    'Code',
    'User',
    'globalStorage',
    'eduardocecon.cappy'
);

const miniLightRagPath = path.join(storageBase, 'mini-lightrag');
const nodesPath = path.join(miniLightRagPath, 'nodes', 'nodes.json');
const edgesPath = path.join(miniLightRagPath, 'edges', 'edges.json');
const metadataPath = path.join(miniLightRagPath, 'metadata.json');

console.log('📊 Mini-LightRAG Test Viewer');
console.log('============================');
console.log('Storage path:', storageBase);
console.log('Mini-LightRAG:', miniLightRagPath);
console.log('');

// Check if data exists
if (!fs.existsSync(miniLightRagPath)) {
    console.error('❌ Mini-LightRAG directory not found!');
    console.error('   Run "Cappy: Reindex Files" first in VS Code');
    process.exit(1);
}

// Load metadata
let metadata = null;
if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log('📈 Metadata:');
    console.log('   Total Nodes:', metadata.totalNodes);
    console.log('   Total Edges:', metadata.totalEdges);
    console.log('   Nodes by Type:', metadata.nodesByType);
    console.log('');
}

// Check files
console.log('📁 Files:');
console.log('   Nodes:', fs.existsSync(nodesPath) ? '✅' : '❌', nodesPath);
console.log('   Edges:', fs.existsSync(edgesPath) ? '✅' : '❌', edgesPath);
console.log('');

if (!fs.existsSync(nodesPath) || !fs.existsSync(edgesPath)) {
    console.error('❌ Data files not found!');
    process.exit(1);
}

// Load data
console.log('📥 Loading data...');
const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
const edges = JSON.parse(fs.readFileSync(edgesPath, 'utf8'));

console.log('   Loaded:', nodes.length, 'nodes');
console.log('   Loaded:', edges.length, 'edges');
console.log('');

// Limit for performance
const MAX_NODES = 500;
const MAX_EDGES = 1000;

const limitedNodes = nodes.slice(0, MAX_NODES);
const limitedEdges = edges.slice(0, MAX_EDGES);

// Filter edges to only include nodes we have
const nodeIds = new Set(limitedNodes.map(n => n.id));
const validEdges = limitedEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

console.log('✂️  Limited to:', limitedNodes.length, 'nodes,', validEdges.length, 'edges');
console.log('');

// Calculate stats
const nodesByType = {};
limitedNodes.forEach(node => {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
});

const edgesByType = {};
validEdges.forEach(edge => {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
});

console.log('📊 Stats:');
console.log('   Nodes by type:', nodesByType);
console.log('   Edges by type:', edgesByType);
console.log('');

// Convert to Cytoscape format
const cytoscapeElements = {
    nodes: limitedNodes.map(node => ({
        data: {
            id: node.id,
            label: node.label,
            type: node.type,
            path: node.path,
            lang: node.lang
        }
    })),
    edges: validEdges.map(edge => ({
        data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            weight: edge.weight
        }
    }))
};

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini-LightRAG Graph Test</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #1e1e1e; color: #fff; }
        #toolbar {
            position: fixed; top: 0; left: 0; right: 0; height: 50px;
            background: #252526; border-bottom: 1px solid #3e3e42;
            display: flex; align-items: center; padding: 0 15px; gap: 10px; z-index: 1000;
        }
        #cy {
            position: fixed; top: 50px; left: 0; right: 0; bottom: 40px;
            background: #1e1e1e;
        }
        #stats {
            position: fixed; bottom: 0; left: 0; right: 0; height: 40px;
            background: #007acc; color: #fff;
            display: flex; align-items: center; padding: 0 15px; gap: 20px; font-size: 12px;
        }
        .button {
            background: #0e639c; color: #fff; border: none;
            padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 13px;
        }
        .button:hover { background: #1177bb; }
        .stat-item { display: flex; align-items: center; gap: 5px; }
        .stat-value { font-weight: bold; }
        #legend {
            position: fixed; top: 60px; right: 10px;
            background: #252526; border: 1px solid #3e3e42;
            border-radius: 4px; padding: 10px; font-size: 11px; max-width: 200px;
        }
        .legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .legend-color { width: 12px; height: 12px; border-radius: 2px; }
    </style>
</head>
<body>
    <div id="toolbar">
        <button class="button" onclick="fitGraph()">🔍 Fit</button>
        <button class="button" onclick="resetZoom()">↺ Reset</button>
        <button class="button" onclick="changeLayout('cose')">🌐 Force</button>
        <button class="button" onclick="changeLayout('circle')">⭕ Circle</button>
        <button class="button" onclick="changeLayout('grid')">▦ Grid</button>
        <span style="margin-left: auto; font-size: 14px; font-weight: bold;">
            🌐 Mini-LightRAG Graph Test
        </span>
    </div>

    <div id="cy"></div>

    <div id="legend">
        <div style="font-weight: bold; margin-bottom: 8px;">Node Types</div>
        <div class="legend-item">
            <div class="legend-color" style="background-color: #4A90E2;"></div>
            <span>Document</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background-color: #7ED321;"></div>
            <span>Section</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background-color: #F5A623;"></div>
            <span>Keyword</span>
        </div>
        <div class="legend-item">
            <div class="legend-color" style="background-color: #BD10E0;"></div>
            <span>Symbol</span>
        </div>
    </div>

    <div id="stats">
        <div class="stat-item">
            <span>Nodes:</span>
            <span class="stat-value">${limitedNodes.length}</span>
        </div>
        <div class="stat-item">
            <span>Edges:</span>
            <span class="stat-value">${validEdges.length}</span>
        </div>
        ${Object.entries(nodesByType).map(([type, count]) => `
        <div class="stat-item">
            <span>${type}:</span>
            <span class="stat-value">${count}</span>
        </div>
        `).join('')}
    </div>

    <script>
        console.log('Initializing Cytoscape...');
        
        const cy = cytoscape({
            container: document.getElementById('cy'),
            
            elements: ${JSON.stringify(cytoscapeElements)},
            
            style: [
                {
                    selector: 'node',
                    style: {
                        'label': 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': '10px',
                        'width': 30,
                        'height': 30,
                        'background-color': function(ele) {
                            const type = ele.data('type');
                            switch(type) {
                                case 'Document': return '#4A90E2';
                                case 'Section': return '#7ED321';
                                case 'Keyword': return '#F5A623';
                                case 'Symbol': return '#BD10E0';
                                default: return '#888';
                            }
                        },
                        'color': '#fff',
                        'text-outline-color': '#000',
                        'text-outline-width': 1
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': function(ele) {
                            return Math.max(1, ele.data('weight') * 3);
                        },
                        'line-color': '#666',
                        'target-arrow-color': '#666',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'opacity': 0.6
                    }
                },
                {
                    selector: 'node:selected',
                    style: {
                        'border-width': 3,
                        'border-color': '#FFF'
                    }
                }
            ],
            
            layout: {
                name: 'cose',
                animate: true,
                animationDuration: 500,
                fit: true,
                padding: 30,
                nodeRepulsion: 400000,
                idealEdgeLength: 100,
                edgeElasticity: 100,
                nestingFactor: 5,
                gravity: 80,
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0
            }
        });

        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const data = node.data();
            console.log('Node clicked:', data);
            
            if (data.path) {
                alert('File: ' + data.path + '\\nType: ' + data.type + '\\nLabel: ' + data.label);
            }
        });

        cy.on('dbltap', 'node', function(evt) {
            const node = evt.target;
            cy.fit(node.neighborhood(), 100);
        });

        function fitGraph() {
            cy.fit();
        }

        function resetZoom() {
            cy.reset();
        }

        function changeLayout(name) {
            cy.layout({
                name: name,
                animate: true,
                animationDuration: 500,
                fit: true
            }).run();
        }

        console.log('Graph initialized!');
        console.log('Nodes:', cy.nodes().length);
        console.log('Edges:', cy.edges().length);
    </script>
</body>
</html>`;

// Create HTTP server
const PORT = 3456;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
});

server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log('🚀 Server started!');
    console.log('   URL:', url);
    console.log('');
    console.log('🌐 Opening browser...');
    
    // Open browser
    const openCommand = process.platform === 'win32' ? 'start' :
                       process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    exec(`${openCommand} ${url}`, (error) => {
        if (error) {
            console.error('❌ Could not open browser automatically');
            console.log('   Please open:', url);
        } else {
            console.log('✅ Browser opened!');
        }
    });
    
    console.log('');
    console.log('Press Ctrl+C to stop server');
});
