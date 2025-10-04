import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
        console.log('[openGraph] Starting...');
        console.log('[openGraph] Context available:', !!context);
        
        const panel = vscode.window.createWebviewPanel('miniRAGGraph', 'Mini-LightRAG Graph', vscode.ViewColumn.One, { enableScripts: true });
        console.log('[openGraph] Panel created');
        
        // 🎯 Limites mais agressivos para melhor performance
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
 * Carrega APENAS os nós raiz (tipo Document) inicialmente
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
            vscode.window.showWarningMessage('Dados não encontrados. Execute "CAPPY: Reindex Workspace" primeiro!');
            return empty;
        }
        
        const np = path.join(base, 'nodes.json');
        if (!fs.existsSync(np)) {
            return empty;
        }
        
        const allNodes: GraphNode[] = JSON.parse(await fs.promises.readFile(np, 'utf8'));
        
        // 🎯 Carregar APENAS nós tipo Document (raiz)
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
 * Expande um nó específico, carregando seus filhos (Sections, Keywords)
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
        
        // Encontrar edges que saem do nó clicado
        const relatedEdges = allEdges.filter(e => e.source === nodeId).slice(0, 10); // Max 10 edges
        
        // Encontrar nós conectados
        const targetIds = new Set(relatedEdges.map(e => e.target));
        const relatedNodes = allNodes.filter(n => targetIds.has(n.id));
        
        console.log('[expandNode]', nodeId, '→', relatedNodes.length, 'children');
        
        return { nodes: relatedNodes, edges: relatedEdges };
    } catch (e) {
        console.error('[expandNode] Error:', e);
        return empty;
    }
}

function getGraphHTML(): string {
    // Lê o HTML do arquivo (ou inline por enquanto)
    return fs.readFileSync(path.join(__dirname, '..', '..', 'webview', 'graph-progressive.html'), 'utf8');
}
