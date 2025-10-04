import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface GraphNode {
    id: string;
    type: 'Document' | 'Section' | 'Keyword' | 'Symbol';
    label: string;
    path?: string;
    lang?: string;
    tags?: string[];
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
}

/**
 * Popula dados de exemplo do Mini-LightRAG para testar visualização do grafo
 * Analisa arquivos .md do workspace e gera nodes/edges
 */
export async function populateSampleData(context: vscode.ExtensionContext): Promise<void> {
    try {
        vscode.window.showInformationMessage('🔨 Mini-LightRAG: Gerando dados de exemplo...');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('Nenhuma pasta de workspace aberta!');
            return;
        }

        // Criar estrutura Mini-LightRAG no globalStorage
        const globalStoragePath = context.globalStorageUri.fsPath;
        const miniLightRagPath = path.join(globalStoragePath, 'mini-lightrag');
        const nodesDir = path.join(miniLightRagPath, 'nodes');
        const edgesDir = path.join(miniLightRagPath, 'edges');
        
        await fs.promises.mkdir(nodesDir, { recursive: true });
        await fs.promises.mkdir(edgesDir, { recursive: true });

        // Buscar arquivos .md no workspace
        const mdFiles = await vscode.workspace.findFiles('**/*.md', '**/node_modules/**', 100);
        
        vscode.window.showInformationMessage(`📄 Encontrados ${mdFiles.length} arquivos Markdown`);

        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        let nodeIdCounter = 0;
        let edgeIdCounter = 0;

        // Mapa de palavras-chave globais
        const globalKeywords = new Map<string, string>(); // keyword -> nodeId

        for (const fileUri of mdFiles) {
            const content = await fs.promises.readFile(fileUri.fsPath, 'utf8');
            const relativePath = path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
            const fileName = path.basename(fileUri.fsPath, '.md');

            // Criar nó do documento
            const docNodeId = `node_${nodeIdCounter++}`;
            nodes.push({
                id: docNodeId,
                type: 'Document',
                label: fileName,
                path: fileUri.fsPath,
                lang: 'markdown',
                tags: ['markdown', 'documentation']
            });

            // Extrair seções (linhas com # heading)
            const headingRegex = /^#+\s+(.+)$/gm;
            let match;
            const sections: string[] = [];
            
            while ((match = headingRegex.exec(content)) !== null) {
                sections.push(match[1]);
            }

            // Criar nós para seções
            const sectionNodeIds: string[] = [];
            for (const sectionTitle of sections.slice(0, 5)) { // Limitar a 5 seções
                const sectionNodeId = `node_${nodeIdCounter++}`;
                nodes.push({
                    id: sectionNodeId,
                    type: 'Section',
                    label: sectionTitle,
                    path: fileUri.fsPath,
                    lang: 'markdown'
                });
                sectionNodeIds.push(sectionNodeId);

                // Edge: Document -> Section
                edges.push({
                    id: `edge_${edgeIdCounter++}`,
                    source: docNodeId,
                    target: sectionNodeId,
                    type: 'CONTAINS',
                    weight: 1.0
                });
            }

            // Extrair palavras-chave importantes (palavras >= 5 caracteres, únicas)
            const words = content
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 5);
            
            const uniqueWords = [...new Set(words)].slice(0, 10); // Top 10 palavras únicas

            for (const keyword of uniqueWords) {
                let keywordNodeId = globalKeywords.get(keyword);
                
                if (!keywordNodeId) {
                    // Criar novo nó de keyword
                    keywordNodeId = `node_${nodeIdCounter++}`;
                    nodes.push({
                        id: keywordNodeId,
                        type: 'Keyword',
                        label: keyword,
                        lang: 'keyword'
                    });
                    globalKeywords.set(keyword, keywordNodeId);
                }

                // Edge: Document -> Keyword
                edges.push({
                    id: `edge_${edgeIdCounter++}`,
                    source: docNodeId,
                    target: keywordNodeId,
                    type: 'MENTIONS',
                    weight: 0.5
                });

                // Edge: Keyword -> Section (se houver seções)
                if (sectionNodeIds.length > 0) {
                    const randomSection = sectionNodeIds[Math.floor(Math.random() * sectionNodeIds.length)];
                    edges.push({
                        id: `edge_${edgeIdCounter++}`,
                        source: keywordNodeId,
                        target: randomSection,
                        type: 'RELATES_TO',
                        weight: 0.3
                    });
                }
            }

            // Criar alguns relacionamentos entre documentos (similaridade simulada)
            if (nodes.length > 5) {
                const randomDoc = nodes[Math.floor(Math.random() * Math.min(nodes.length, 10))];
                if (randomDoc.type === 'Document' && randomDoc.id !== docNodeId) {
                    edges.push({
                        id: `edge_${edgeIdCounter++}`,
                        source: docNodeId,
                        target: randomDoc.id,
                        type: 'SIMILAR_TO',
                        weight: 0.7
                    });
                }
            }
        }

        // Salvar nodes.json
        const nodesPath = path.join(nodesDir, 'nodes.json');
        await fs.promises.writeFile(nodesPath, JSON.stringify(nodes, null, 2), 'utf8');
        
        // Salvar edges.json
        const edgesPath = path.join(edgesDir, 'edges.json');
        await fs.promises.writeFile(edgesPath, JSON.stringify(edges, null, 2), 'utf8');

        vscode.window.showInformationMessage(
            `✅ Mini-LightRAG: Dados gerados! ${nodes.length} nós, ${edges.length} arestas`
        );

        // Oferecer abrir o grafo
        const openGraph = await vscode.window.showInformationMessage(
            '🌐 Dados prontos! Abrir visualização do grafo?',
            'Sim',
            'Não'
        );

        if (openGraph === 'Sim') {
            await vscode.commands.executeCommand('miniRAG.openGraph');
        }

    } catch (error) {
        console.error('Error populating sample data:', error);
        vscode.window.showErrorMessage(`Erro ao gerar dados: ${error}`);
    }
}
