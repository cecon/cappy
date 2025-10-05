import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { openDocumentUploadUI } from '../cappyrag';

interface GraphNode {
    id: string;
    type: 'Document' | 'Section' | 'Keyword' | 'Symbol';
    label: string;
    path?: string;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
}

interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stats: {
        totalNodes: number;
        totalEdges: number;
        nodesByType: Record<string, number>;
        edgesByType: Record<string, number>;
    };
}

export async function openGraph(context?: vscode.ExtensionContext): Promise<void> {
    try {
        console.log('[openGraph] Opening LightRAG Dashboard with Knowledge Graph tab...');
        
        // Open the new unified dashboard directly on the Knowledge Graph tab
        if (context) {
            await openDocumentUploadUI(context, 'knowledge-graph');
        } else {
            vscode.window.showWarningMessage('Context not available for openGraph');
        }
        
        return;
        
        // OLD CODE BELOW - kept for reference but not executed
        console.log('[openGraph] Starting...');
        console.log('[openGraph] Context available:', !!context);
        
        const panel = vscode.window.createWebviewPanel('miniRAGGraph', 'Mini-LightRAG Graph', vscode.ViewColumn.One, { enableScripts: true });
        console.log('[openGraph] Panel created');
        
        // ?? Limites mais agressivos para melhor performance
        const config = vscode.workspace.getConfiguration('miniRAG');
        const maxNodes = config.get<number>('maxNodes', 100); // Reduzido de 1000 para 100
        const maxEdges = config.get<number>('maxEdges', 200); // Reduzido de 5000 para 200
        console.log('[openGraph] Limits: nodes=', maxNodes, ', edges=', maxEdges);
        
        panel.webview.html = getGraphHTML();
        console.log('[openGraph] HTML set');
        
        panel.webview.onDidReceiveMessage(async (msg) => {
            console.log('[openGraph] Message received:', msg.command);
            if (msg.command === 'ready') {
                console.log('[openGraph] Webview ready, loading initial nodes...');
                const data = await loadInitialNodes(context);
                console.log('[openGraph] Initial data loaded:', data.nodes.length, 'root nodes');
                panel.webview.postMessage({ command: 'loadGraph', data });
            } else if (msg.command === 'expandNode' && msg.nodeId) {
                console.log('[openGraph] Expanding node:', msg.nodeId);
                const expanded = await expandNode(context, msg.nodeId);
                console.log('[openGraph] Expanded:', expanded.nodes.length, 'nodes,', expanded.edges.length, 'edges');
                panel.webview.postMessage({ command: 'addNodes', data: expanded });
            } else if (msg.command === 'openFile' && msg.filePath) {
                await vscode.window.showTextDocument(vscode.Uri.file(msg.filePath));
            }
        });
        
        console.log('[openGraph] Setup complete');
    } catch (error) {
        console.error('[openGraph] Error:', error);
        vscode.window.showErrorMessage(`Error: ${error}`);
    }
}

/**
 * Carrega APENAS os n�s raiz (tipo Document) inicialmente
 */
async function loadInitialNodes(context: vscode.ExtensionContext | undefined): Promise<GraphData> {
    const empty: GraphData = { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, nodesByType: {}, edgesByType: {} } };
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Nenhum workspace aberto!');
        return empty;
    }
    
    try {
        const base = path.join(workspaceFolder.uri.fsPath, '.cappy', 'data', 'mini-lightrag', 'backup');
        
        if (!fs.existsSync(base)) {
            vscode.window.showWarningMessage('Dados n�o encontrados. Execute "CAPPY: Reindex Workspace" primeiro!');
            return empty;
        }
        
        const np = path.join(base, 'nodes.json');
        if (!fs.existsSync(np)) {
            return empty;
        }
        
        const allNodes: GraphNode[] = JSON.parse(await fs.promises.readFile(np, 'utf8'));
        
        // ?? Carregar APENAS n�s tipo Document (raiz)
        const rootNodes = allNodes.filter(n => n.type === 'Document').slice(0, 20); // Max 20 documentos iniciais
        
        console.log('[loadInitialNodes] Loaded', rootNodes.length, 'root nodes (Documents)');
        
        const nbt: Record<string, number> = {};
        nbt['Document'] = rootNodes.length;
        return { 
            nodes: rootNodes, 
            edges: [], // SEM edges inicialmente
            stats: { totalNodes: rootNodes.length, totalEdges: 0, nodesByType: nbt, edgesByType: {} } 
        };
    } catch (e) {
        console.error('[loadInitialNodes] Error:', e);
        return empty;
    }
}

/**
 * Expande um n� espec�fico, carregando seus filhos (Sections, Keywords)
 */
async function expandNode(context: vscode.ExtensionContext | undefined, nodeId: string): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
    const empty = { nodes: [], edges: [] };
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return empty;
    }
    
    try {
        const base = path.join(workspaceFolder.uri.fsPath, '.cappy', 'data', 'mini-lightrag', 'backup');
        const np = path.join(base, 'nodes.json');
        const ep = path.join(base, 'edges.json');
        
        if (!fs.existsSync(np) || !fs.existsSync(ep)) {
            return empty;
        }
        
        const allNodes: GraphNode[] = JSON.parse(await fs.promises.readFile(np, 'utf8'));
        const allEdges: GraphEdge[] = JSON.parse(await fs.promises.readFile(ep, 'utf8'));
        
        // Encontrar edges que saem do n� clicado
        const relatedEdges = allEdges.filter(e => e.source === nodeId).slice(0, 10); // Max 10 edges
        
        // Encontrar n�s conectados
        const targetIds = new Set(relatedEdges.map(e => e.target));
        const relatedNodes = allNodes.filter(n => targetIds.has(n.id));
        
        console.log('[expandNode]', nodeId, '?', relatedNodes.length, 'children');
        
        return { nodes: relatedNodes, edges: relatedEdges };
    } catch (e) {
        console.error('[expandNode] Error:', e);
        return empty;
    }
}

function getGraphHTML(): string {
    // HTML inline para evitar problemas de path
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Mini-LightRAG Graph</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1e1e1e; color: #fff; overflow: hidden; font-family: 'Segoe UI', sans-serif; }
        #cy { position: fixed; top: 50px; left: 0; right: 0; bottom: 40px; }
        #toolbar { position: fixed; top: 0; left: 0; right: 0; height: 50px; background: #252526; border-bottom: 1px solid #3e3e42; padding: 0 15px; display: flex; align-items: center; gap: 10px; }
        #stats { position: fixed; bottom: 0; left: 0; right: 0; height: 40px; background: #007acc; padding: 0 15px; display: flex; align-items: center; gap: 15px; }
        .button { background: #0e639c; color: #fff; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; font-size: 13px; }
        .button:hover { background: #1177bb; }
        #loading { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
        #help { position: fixed; top: 60px; right: 20px; background: #252526; border: 1px solid #3e3e42; border-radius: 5px; padding: 15px; max-width: 300px; display: none; }
        #help.show { display: block; }
        .help-title { margin-bottom: 10px; }
        .help-list { margin-left: 20px; margin-top: 10px; line-height: 1.8; }
        .toolbar-title { margin-left: auto; font-weight: bold; }
        .stats-right { margin-left: auto; }
    </style>
</head>
<body>
    <div id="toolbar">
        <button class="button" onclick="fit()">?? Fit</button>
        <button class="button" onclick="reset()">? Reset</button>
        <button class="button" onclick="toggleHelp()">? Ajuda</button>
        <span class="toolbar-title">?? Mini-LightRAG Graph (Progressive)</span>
    </div>
    
    <div id="help">
        <h3 class="help-title">?? Como usar:</h3>
        <ul class="help-list">
            <li><strong>Clique simples:</strong> Expande o n� (carrega filhos)</li>
            <li><strong>Clique duplo:</strong> Abre arquivo (se for Document)</li>
            <li><strong>Verde:</strong> N� j� expandido</li>
            <li><strong>Azul:</strong> Document (raiz)</li>
            <li><strong>Laranja:</strong> Section/Keyword</li>
        </ul>
    </div>
    
    <div id="cy"></div>
    <div id="loading"><h2>? Carregando n�s raiz...</h2></div>
    
    <div id="stats">
        <span id="st">Aguardando...</span>
        <span class="stats-right">
            <strong>Vis�veis:</strong> <span id="visibleNodes">0</span> n�s, <span id="visibleEdges">0</span> edges
        </span>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let cy = null;
        const expandedNodes = new Set();
        
        vscode.postMessage({ command: 'ready' });
        
        window.addEventListener('message', e => {
            if (e.data.command === 'loadGraph') {
                const d = e.data.data;
                if (d.nodes.length === 0) {
                    document.getElementById('loading').innerHTML = '<h2>?? Nenhum dado. Execute CAPPY: Reindex Workspace</h2>';
                    return;
                }
                document.getElementById('loading').style.display = 'none';
                initializeGraph(d);
                updateStats();
            }
            else if (e.data.command === 'addNodes') {
                addNodesToGraph(e.data.data);
                updateStats();
            }
        });
        
        function initializeGraph(data) {
            cy = cytoscape({
                container: document.getElementById('cy'),
                elements: {
                    nodes: data.nodes.map(n => ({ data: { id: n.id, label: n.label, type: n.type, path: n.path, expanded: false } })),
                    edges: []
                },
                style: [
                    {
                        selector: 'node',
                        style: {
                            'label': 'data(label)',
                            'font-size': '12px',
                            'width': 40,
                            'height': 40,
                            'background-color': function(ele) {
                                const t = ele.data('type');
                                if (t === 'Document') return '#4A90E2';
                                if (t === 'Section') return '#7ED321';
                                return '#F5A623';
                            },
                            'color': '#fff',
                            'text-valign': 'center',
                            'text-halign': 'center',
                            'border-width': function(ele) { return ele.data('expanded') ? 3 : 0; },
                            'border-color': '#7ED321'
                        }
                    },
                    {
                        selector: 'edge',
                        style: { 'width': 2, 'line-color': '#666', 'target-arrow-shape': 'triangle', 'target-arrow-color': '#666', 'curve-style': 'bezier' }
                    }
                ],
                layout: { name: 'cose', fit: true, padding: 50, animate: true, animationDuration: 500 }
            });
            
            cy.on('tap', 'node', function(evt) {
                const node = evt.target;
                const nodeId = node.data('id');
                if (expandedNodes.has(nodeId)) return;
                expandedNodes.add(nodeId);
                node.data('expanded', true);
                vscode.postMessage({ command: 'expandNode', nodeId: nodeId });
            });
            
            cy.on('dbltap', 'node', function(evt) {
                const path = evt.target.data('path');
                if (path) vscode.postMessage({ command: 'openFile', filePath: path });
            });
        }
        
        function addNodesToGraph(data) {
            if (!cy) return;
            data.nodes.forEach(n => {
                if (cy.getElementById(n.id).length === 0) {
                    cy.add({ data: { id: n.id, label: n.label, type: n.type, path: n.path, expanded: false } });
                }
            });
            data.edges.forEach(e => {
                if (cy.getElementById(e.id).length === 0) {
                    cy.add({ data: { id: e.id, source: e.source, target: e.target } });
                }
            });
            cy.layout({ name: 'cose', fit: false, animate: true, animationDuration: 500, randomize: false }).run();
        }
        
        function updateStats() {
            if (!cy) return;
            const nodeCount = cy.nodes().length;
            const edgeCount = cy.edges().length;
            document.getElementById('visibleNodes').textContent = nodeCount;
            document.getElementById('visibleEdges').textContent = edgeCount;
            document.getElementById('st').innerHTML = '<strong>' + expandedNodes.size + '</strong> n�s expandidos | <strong>' + (nodeCount - expandedNodes.size) + '</strong> podem ser expandidos';
        }
        
        function fit() { if (cy) cy.fit(null, 50); }
        function reset() { if (cy) { cy.zoom(1); cy.center(); } }
        function toggleHelp() { document.getElementById('help').classList.toggle('show'); }
    </script>
</body>
</html>`;
}
