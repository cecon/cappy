import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { writeOutputForced } from '../utils/outputWriter';
import * as crypto from 'crypto';

interface Chunk {
    id: string;
    content: string;
    source: string;
    startLine: number;
    endLine: number;
    tokens: number;
    hash: string;
    metadata: {
        type: 'markdown' | 'code' | 'documentation';
        lang?: string;
        heading?: string;
        tags?: string[];
    };
}

interface GraphNode {
    id: string;
    type: 'Document' | 'Section' | 'Keyword' | 'Symbol';
    label: string;
    path?: string;
    lang?: string;
    tags?: string[];
    chunkIds?: string[];
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
    metadata?: Record<string, any>;
}

/**
 * Comando de reindexação com arquitetura Mini-LightRAG
 * Processa arquivos do workspace e cria grafo de conhecimento
 */
export class ReindexCommand {
    constructor(private readonly extensionContext?: vscode.ExtensionContext) {}

    async execute(): Promise<string> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const msg = 'Nenhuma pasta de workspace aberta!';
                vscode.window.showWarningMessage(msg);
                return msg;
            }

            if (!this.extensionContext) {
                const msg = 'Extension context não disponível!';
                vscode.window.showWarningMessage(msg);
                return msg;
            }

            let stats = { files: 0, chunks: 0, nodes: 0, edges: 0 };

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔄 Mini-LightRAG: Reindexando workspace',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Configurando storage...' });
                const storagePath = await this.setupStorage();

                progress.report({ increment: 10, message: 'Buscando documentos...' });
                const files = await this.findDocuments(workspaceFolder);
                
                progress.report({ increment: 20, message: `Processando ${files.length} arquivos...` });
                const chunks: Chunk[] = [];
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileChunks = await this.chunkFile(file, workspaceFolder);
                    chunks.push(...fileChunks);
                    
                    if (i % 10 === 0) {
                        progress.report({ 
                            message: `Processando ${i + 1}/${files.length}: ${path.basename(file.fsPath)}` 
                        });
                    }
                }

                progress.report({ increment: 50, message: 'Construindo grafo...' });
                const { nodes, edges } = await this.buildGraph(chunks, files, workspaceFolder);

                progress.report({ increment: 80, message: 'Salvando dados...' });
                await this.saveData(storagePath, chunks, nodes, edges);

                stats = { files: files.length, chunks: chunks.length, nodes: nodes.length, edges: edges.length };
                progress.report({ increment: 100, message: 'Concluído!' });
            });

            const msg = `✅ Mini-LightRAG: Indexação concluída!
📊 ${stats.files} arquivos, ${stats.chunks} chunks, ${stats.nodes} nós, ${stats.edges} arestas
🌐 Use 'miniRAG.openGraph' para visualizar!`;

            vscode.window.showInformationMessage(msg);
            writeOutputForced(msg);
            return msg;

        } catch (error) {
            const errorMsg = `Erro ao reindexar: ${error}`;
            vscode.window.showErrorMessage(errorMsg);
            writeOutputForced(errorMsg);
            return errorMsg;
        }
    }

    private async setupStorage(): Promise<string> {
        const globalStoragePath = this.extensionContext!.globalStorageUri.fsPath;
        const miniLightRagPath = path.join(globalStoragePath, 'mini-lightrag');
        
        const directories = [
            miniLightRagPath,
            path.join(miniLightRagPath, 'chunks'),
            path.join(miniLightRagPath, 'nodes'),
            path.join(miniLightRagPath, 'edges')
        ];

        for (const dir of directories) {
            await fs.promises.mkdir(dir, { recursive: true });
        }

        return miniLightRagPath;
    }

    private async findDocuments(workspaceFolder: vscode.WorkspaceFolder): Promise<vscode.Uri[]> {
        const patterns = ['**/*.md', '**/*.txt', '**/*.ts', '**/*.js'];
        const excludePattern = '**/node_modules/**';
        const files: vscode.Uri[] = [];

        for (const pattern of patterns) {
            const found = await vscode.workspace.findFiles(pattern, excludePattern, 500);
            files.push(...found);
        }

        return files;
    }

    private async chunkFile(file: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): Promise<Chunk[]> {
        const content = await fs.promises.readFile(file.fsPath, 'utf8');
        const lines = content.split('\n');
        const chunks: Chunk[] = [];
        
        const ext = path.extname(file.fsPath);
        const isMarkdown = ext === '.md';
        const chunkSize = 500;
        
        if (isMarkdown) {
            let currentChunk: string[] = [];
            let startLine = 0;
            let currentHeading = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.match(/^#{1,6}\s+/)) {
                    if (currentChunk.length > 0) {
                        chunks.push(this.createChunk(currentChunk.join('\n'), file, workspaceFolder, startLine, i - 1, 'markdown', currentHeading));
                    }
                    
                    currentHeading = line.replace(/^#+\s+/, '').trim();
                    currentChunk = [line];
                    startLine = i;
                } else {
                    currentChunk.push(line);
                }

                const words = currentChunk.join(' ').split(/\s+/).length;
                if (words > chunkSize) {
                    chunks.push(this.createChunk(currentChunk.join('\n'), file, workspaceFolder, startLine, i, 'markdown', currentHeading));
                    currentChunk = [];
                    startLine = i + 1;
                }
            }

            if (currentChunk.length > 0) {
                chunks.push(this.createChunk(currentChunk.join('\n'), file, workspaceFolder, startLine, lines.length - 1, 'markdown', currentHeading));
            }
        } else {
            let currentChunk: string[] = [];
            let startLine = 0;

            for (let i = 0; i < lines.length; i++) {
                currentChunk.push(lines[i]);
                
                const words = currentChunk.join(' ').split(/\s+/).length;
                if (words >= chunkSize || i === lines.length - 1) {
                    chunks.push(this.createChunk(currentChunk.join('\n'), file, workspaceFolder, startLine, i, 'code'));
                    currentChunk = [];
                    startLine = i + 1;
                }
            }
        }

        return chunks;
    }

    private createChunk(content: string, file: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder, startLine: number, endLine: number, type: 'markdown' | 'code' | 'documentation', heading?: string): Chunk {
        const words = content.split(/\s+/).length;
        const tokens = Math.ceil(words * 1.3);
        const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

        return {
            id: `chunk_${hash}`,
            content,
            source: file.fsPath,
            startLine,
            endLine,
            tokens,
            hash,
            metadata: {
                type,
                lang: path.extname(file.fsPath).substring(1),
                heading,
                tags: this.extractTags(content)
            }
        };
    }

    private extractTags(content: string): string[] {
        const tags = new Set<string>();
        const words = content.match(/\b[A-Z][a-z]{4,}\b|\b(?:function|class|interface|type|const|async)\b/g);
        
        if (words) {
            words.slice(0, 10).forEach(w => tags.add(w.toLowerCase()));
        }

        return Array.from(tags);
    }

    private async buildGraph(chunks: Chunk[], files: vscode.Uri[], workspaceFolder: vscode.WorkspaceFolder): Promise<{ nodes: GraphNode[], edges: GraphEdge[] }> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeMap = new Map<string, GraphNode>();
        const keywordMap = new Map<string, GraphNode>();

        let nodeIdCounter = 0;
        let edgeIdCounter = 0;

        for (const file of files) {
            const fileName = path.basename(file.fsPath);
            const nodeId = `node_doc_${nodeIdCounter++}`;
            
            const docNode: GraphNode = {
                id: nodeId,
                type: 'Document',
                label: fileName,
                path: file.fsPath,
                lang: path.extname(file.fsPath).substring(1),
                tags: [],
                chunkIds: []
            };

            nodes.push(docNode);
            nodeMap.set(file.fsPath, docNode);
        }

        for (const chunk of chunks) {
            const docNode = nodeMap.get(chunk.source);
            if (!docNode) continue;

            docNode.chunkIds!.push(chunk.id);

            if (chunk.metadata.heading) {
                const sectionId = `node_sec_${nodeIdCounter++}`;
                nodes.push({
                    id: sectionId,
                    type: 'Section',
                    label: chunk.metadata.heading,
                    path: chunk.source,
                    lang: chunk.metadata.lang,
                    chunkIds: [chunk.id]
                });

                edges.push({
                    id: `edge_${edgeIdCounter++}`,
                    source: docNode.id,
                    target: sectionId,
                    type: 'CONTAINS',
                    weight: 1.0
                });
            }

            for (const tag of chunk.metadata.tags || []) {
                let keywordNode = keywordMap.get(tag);
                
                if (!keywordNode) {
                    keywordNode = {
                        id: `node_kw_${nodeIdCounter++}`,
                        type: 'Keyword',
                        label: tag,
                        chunkIds: []
                    };
                    nodes.push(keywordNode);
                    keywordMap.set(tag, keywordNode);
                }

                keywordNode.chunkIds!.push(chunk.id);

                const edgeExists = edges.some(e => e.source === docNode.id && e.target === keywordNode!.id && e.type === 'MENTIONS');
                if (!edgeExists) {
                    edges.push({
                        id: `edge_${edgeIdCounter++}`,
                        source: docNode.id,
                        target: keywordNode.id,
                        type: 'MENTIONS',
                        weight: 0.5
                    });
                }
            }
        }

        const docNodes = nodes.filter(n => n.type === 'Document');
        for (let i = 0; i < docNodes.length; i++) {
            for (let j = i + 1; j < docNodes.length && j < i + 10; j++) {
                const doc1 = docNodes[i];
                const doc2 = docNodes[j];

                const keywords1 = edges.filter(e => e.source === doc1.id && e.type === 'MENTIONS').map(e => e.target);
                const keywords2 = edges.filter(e => e.source === doc2.id && e.type === 'MENTIONS').map(e => e.target);
                const sharedKeywords = keywords1.filter(k => keywords2.includes(k));

                if (sharedKeywords.length >= 2) {
                    edges.push({
                        id: `edge_${edgeIdCounter++}`,
                        source: doc1.id,
                        target: doc2.id,
                        type: 'SIMILAR_TO',
                        weight: sharedKeywords.length / Math.max(keywords1.length, keywords2.length),
                        metadata: { sharedKeywords: sharedKeywords.length }
                    });
                }
            }
        }

        return { nodes, edges };
    }

    private async saveData(storagePath: string, chunks: Chunk[], nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
        await fs.promises.writeFile(path.join(storagePath, 'chunks', 'chunks.json'), JSON.stringify(chunks, null, 2), 'utf8');
        await fs.promises.writeFile(path.join(storagePath, 'nodes', 'nodes.json'), JSON.stringify(nodes, null, 2), 'utf8');
        await fs.promises.writeFile(path.join(storagePath, 'edges', 'edges.json'), JSON.stringify(edges, null, 2), 'utf8');
        
        await fs.promises.writeFile(path.join(storagePath, 'metadata.json'), JSON.stringify({
            lastIndexed: new Date().toISOString(),
            totalChunks: chunks.length,
            totalNodes: nodes.length,
            totalEdges: edges.length,
            nodesByType: this.countByType(nodes),
            edgesByType: this.countByType(edges)
        }, null, 2), 'utf8');
    }

    private countByType<T extends { type: string }>(items: T[]): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const item of items) {
            counts[item.type] = (counts[item.type] || 0) + 1;
        }
        return counts;
    }
}
