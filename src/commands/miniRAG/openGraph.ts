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
        
        const config = vscode.workspace.getConfiguration('miniRAG');
        const maxNodes = config.get<number>('maxNodes', 1000);
        console.log('[openGraph] Max nodes:', maxNodes);
        
        panel.webview.html = getGraphHTML();
        console.log('[openGraph] HTML set');
        
        panel.webview.onDidReceiveMessage(async (msg) => {
            console.log('[openGraph] Message received:', msg.command);
            if (msg.command === 'ready') {
                console.log('[openGraph] Webview ready, loading data...');
                const data = await loadGraphData(context, maxNodes, 5000);
                console.log('[openGraph] Data loaded:', data.nodes.length, 'nodes,', data.edges.length, 'edges');
                console.log('[openGraph] Sending to webview...');
                panel.webview.postMessage({ command: 'loadGraph', data });
                console.log('[openGraph] Data sent!');
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

async function loadGraphData(context: vscode.ExtensionContext | undefined, maxNodes: number, maxEdges: number): Promise<GraphData> {
    const empty: GraphData = { nodes: [], edges: [], stats: { totalNodes: 0, totalEdges: 0, nodesByType: {}, edgesByType: {} } };
    
    console.log('[loadGraphData] Starting...');
    if (!context) {
        console.log('[loadGraphData] No context provided');
        return empty;
    }
    
    try {
        const base = path.join(context.globalStorageUri.fsPath, 'mini-lightrag');
        console.log('[loadGraphData] Base path:', base);
        console.log('[loadGraphData] Directory exists:', fs.existsSync(base));
        
        if (!fs.existsSync(base)) {
            console.log('[loadGraphData] Directory does not exist');
            return empty;
        }
        
        let nodes: GraphNode[] = [];
        let edges: GraphEdge[] = [];
        const np = path.join(base, 'nodes', 'nodes.json');
        const ep = path.join(base, 'edges', 'edges.json');
        
        console.log('[loadGraphData] Nodes file:', np);
        console.log('[loadGraphData] Nodes exists:', fs.existsSync(np));
        console.log('[loadGraphData] Edges file:', ep);
        console.log('[loadGraphData] Edges exists:', fs.existsSync(ep));
        
        if (fs.existsSync(np)) {
            console.log('[loadGraphData] Reading nodes...');
            const content = await fs.promises.readFile(np, 'utf8');
            console.log('[loadGraphData] Nodes file size:', content.length);
            nodes = JSON.parse(content);
            console.log('[loadGraphData] Parsed', nodes.length, 'nodes');
        }
        
        if (fs.existsSync(ep)) {
            console.log('[loadGraphData] Reading edges...');
            const content = await fs.promises.readFile(ep, 'utf8');
            console.log('[loadGraphData] Edges file size:', content.length);
            edges = JSON.parse(content);
            console.log('[loadGraphData] Parsed', edges.length, 'edges');
        }
        
        console.log('[loadGraphData] Limiting to', maxNodes, 'nodes and', maxEdges, 'edges');
        nodes = nodes.slice(0, maxNodes);
        edges = edges.slice(0, maxEdges);
        console.log('[loadGraphData] After limit:', nodes.length, 'nodes,', edges.length, 'edges');
        
        const nbt: Record<string, number> = {};
        const ebt: Record<string, number> = {};
        nodes.forEach(n => { nbt[n.type] = (nbt[n.type] || 0) + 1; });
        edges.forEach(e => { ebt[e.type] = (ebt[e.type] || 0) + 1; });
        
        console.log('[loadGraphData] Stats calculated:', nbt);
        return { nodes, edges, stats: { totalNodes: nodes.length, totalEdges: edges.length, nodesByType: nbt, edgesByType: ebt } };
    } catch (e) {
        console.error('[loadGraphData] Error:', e);
        vscode.window.showErrorMessage('Failed to load graph data. See console for details.');
        return empty;
    }
}

function getGraphHTML(): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js"></script><style>*{margin:0;padding:0}body{background:#1e1e1e;color:#fff;overflow:hidden}#cy{position:fixed;top:50px;left:0;right:0;bottom:40px}#toolbar{position:fixed;top:0;left:0;right:0;height:50px;background:#252526;border-bottom:1px solid #3e3e42;padding:0 15px;display:flex;align-items:center;gap:10px}#stats{position:fixed;bottom:0;left:0;right:0;height:40px;background:#007acc;padding:0 15px;display:flex;align-items:center}.button{background:#0e639c;color:#fff;border:none;padding:6px 12px;border-radius:3px;cursor:pointer}#loading{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}</style></head><body><div id="toolbar"><button class="button" onclick="fit()">🔍 Fit</button><button class="button" onclick="reset()">↺ Reset</button><span style="margin-left:auto;font-weight:bold">🌐 Graph</span></div><div id="cy"></div><div id="loading"><h2>⏳ Loading...</h2></div><div id="stats"><span id="st">Loading...</span></div><script>console.log('[webview] Starting...');const vscode=acquireVsCodeApi();let cy=null;console.log('[webview] Sending ready...');vscode.postMessage({command:'ready'});console.log('[webview] Ready sent');window.addEventListener('message',e=>{console.log('[webview] Message received:',e.data.command);if(e.data.command==='loadGraph'){const d=e.data.data;console.log('[webview] Loading graph:',d.nodes.length,'nodes',d.edges.length,'edges');if(d.nodes.length===0){console.log('[webview] No data');document.getElementById('loading').innerHTML='<h2>⚠️ No Data</h2>';return}console.log('[webview] Hiding loading...');document.getElementById('loading').style.display='none';console.log('[webview] Initializing Cytoscape...');cy=cytoscape({container:document.getElementById('cy'),elements:{nodes:d.nodes.map(n=>({data:{id:n.id,label:n.label,type:n.type,path:n.path}})),edges:d.edges.map(e=>({data:{id:e.id,source:e.source,target:e.target}}))},style:[{selector:'node',style:{'label':'data(label)','font-size':'10px','width':30,'height':30,'background-color':function(ele){const t=ele.data('type');return t==='Document'?'#4A90E2':t==='Section'?'#7ED321':'#F5A623'},'color':'#fff'}},{selector:'edge',style:{'width':2,'line-color':'#666','target-arrow-shape':'triangle'}}],layout:{name:'cose',fit:true}});console.log('[webview] Cytoscape initialized');cy.on('tap','node',evt=>{const p=evt.target.data('path');if(p)vscode.postMessage({command:'openFile',filePath:p})});document.getElementById('st').innerHTML='Nodes: <b>'+d.stats.totalNodes+'</b> | Edges: <b>'+d.stats.totalEdges+'</b>';console.log('[webview] Done!')}});function fit(){if(cy)cy.fit()}function reset(){if(cy)cy.reset()}</script></body></html>`;
}
