import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { LanceDBStore } from '../store/lancedb';

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
 * Comando de reindexação com arquitetura CappyRAG
 * Processa arquivos do workspace e cria grafo de conhecimento
 * LIMPA E REGENERA os bancos de dados completamente
 */
export class ReindexCommand {
    private lancedb: LanceDBStore | null = null;

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
                const msg = 'Extension context n�o dispon�vel!';
                vscode.window.showWarningMessage(msg);
                return msg;
            }

            let stats = { files: 0, chunks: 0, nodes: 0, edges: 0 };

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '?? Mini-LightRAG: Reindexando workspace',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: '???  Limpando bancos antigos...' });
                const storagePath = await this.cleanAndSetupStorage();

                // Inicializar LanceDB
                progress.report({ increment: 5, message: '?? Inicializando LanceDB...' });
                this.lancedb = new LanceDBStore({
                    dbPath: storagePath,
                    vectorDimension: 384,
                    writeMode: 'overwrite', // For�a reescrita completa
                    indexConfig: {
                        metric: 'cosine',
                        indexType: 'HNSW',
                        m: 16,
                        efConstruction: 200
                    }
                });
                await this.lancedb.initialize();

                progress.report({ increment: 10, message: '?? Buscando documentos...' });
                const files = await this.findDocuments(workspaceFolder);
                
                progress.report({ increment: 20, message: `??  Processando ${files.length} arquivos...` });
                const chunks: Chunk[] = [];
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileChunks = await this.chunkFile(file, workspaceFolder);
                    chunks.push(...fileChunks);
                    
                    if (i % 10 === 0) {
                        progress.report({ 
                            message: `??  Processando ${i + 1}/${files.length}: ${path.basename(file.fsPath)}` 
                        });
                    }
                }

                progress.report({ increment: 50, message: '???  Construindo grafo...' });
                const { nodes, edges } = await this.buildGraph(chunks, files, workspaceFolder);

                progress.report({ increment: 70, message: '?? Salvando em LanceDB...' });
                await this.saveToLanceDB(chunks, nodes, edges);

                progress.report({ increment: 90, message: '?? Salvando backup JSON...' });
                await this.saveData(storagePath, chunks, nodes, edges);

                stats = { files: files.length, chunks: chunks.length, nodes: nodes.length, edges: edges.length };
                progress.report({ increment: 100, message: '? Conclu�do!' });
            });

            const msg = `? Mini-LightRAG: Reindexa��o completa!
?? ${stats.files} arquivos, ${stats.chunks} chunks, ${stats.nodes} n�s, ${stats.edges} arestas
???  Dados salvos em LanceDB e JSON
?? Use 'miniRAG.openGraph' para visualizar!`;

            vscode.window.showInformationMessage(msg);
            return msg;

        } catch (error) {
            const errorMsg = `? Erro ao reindexar: ${error}`;
            vscode.window.showErrorMessage(errorMsg);
            return errorMsg;
        } finally {
            // Fechar conex�o LanceDB
            if (this.lancedb) {
                await this.lancedb.close();
            }
        }
    }

    /**
     * Limpa completamente os bancos antigos e recria a estrutura
     * IMPORTANTE: Banco de dados � LOCAL ao workspace (.cappy/data/)
     * Apenas modelos LLM podem ser globais
     */
    private async cleanAndSetupStorage(): Promise<string> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('Workspace n�o encontrado');
        }

        // ?? Banco de dados LOCAL ao workspace
        const cappyPath = path.join(workspaceFolder.uri.fsPath, '.cappy');
        const dataPath = path.join(cappyPath, 'data');
        const miniLightRagPath = path.join(dataPath, 'mini-lightrag');
        
        // ??? APAGAR TUDO se j� existir
        if (fs.existsSync(miniLightRagPath)) {
            console.log('???  Removendo bancos antigos do workspace...');
            await fs.promises.rm(miniLightRagPath, { recursive: true, force: true });
        }

        // Criar estrutura limpa
        const directories = [
            cappyPath,
            dataPath,
            miniLightRagPath,
            path.join(miniLightRagPath, 'backup') // Backup JSON
        ];

        for (const dir of directories) {
            await fs.promises.mkdir(dir, { recursive: true });
        }

        console.log(`? Estrutura de storage criada em: ${miniLightRagPath}`);
        return miniLightRagPath;
    }

    /**
     * Salva dados no LanceDB (principal storage)
     */
    private async saveToLanceDB(chunks: Chunk[], nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
        if (!this.lancedb) {
            throw new Error('LanceDB n�o inicializado!');
        }

        console.log(`?? Salvando ${chunks.length} chunks em LanceDB...`);
        
        // Converter chunks para o formato do schema
        const schemaChunks = chunks.map(chunk => ({
            id: chunk.id,
            path: chunk.source,
            language: chunk.metadata.lang || 'unknown',
            type: this.mapChunkType(chunk.metadata.type),
            textHash: chunk.hash,
            text: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            keywords: chunk.metadata.tags || [],
            metadata: {
                heading: chunk.metadata.heading,
                tokens: chunk.tokens,
                complexity: 0
            },
            vector: new Array(384).fill(0), // TODO: Gerar embeddings reais
            updatedAt: new Date().toISOString(),
            version: 1
        }));

        await this.lancedb.upsertChunks(schemaChunks as any[]);
        console.log(`? ${chunks.length} chunks salvos em LanceDB`);

        console.log(`?? Salvando ${nodes.length} nodes em LanceDB...`);
        const schemaNodes = nodes.map(node => ({
            id: node.id,
            type: node.type,
            label: node.label,
            path: node.path,
            lang: node.lang,
            score: 1.0,
            tags: node.tags || [],
            updatedAt: new Date().toISOString()
        }));

        await this.lancedb.upsertNodes(schemaNodes as any[]);
        console.log(`? ${nodes.length} nodes salvos em LanceDB`);

        console.log(`?? Salvando ${edges.length} edges em LanceDB...`);
        const schemaEdges = edges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            weight: edge.weight,
            updatedAt: new Date().toISOString()
        }));

        await this.lancedb.upsertEdges(schemaEdges as any[]);
        console.log(`? ${edges.length} edges salvos em LanceDB`);
    }

    /**
     * Mapeia tipo de chunk para o schema
     */
    private mapChunkType(type: string): 'code-function' | 'code-class' | 'code-interface' | 'markdown-section' | 'markdown-paragraph' | 'documentation' | 'comment' | 'import' | 'export' {
        const mapping: Record<string, any> = {
            'code': 'code-function',
            'markdown': 'markdown-section',
            'documentation': 'documentation'
        };

        return mapping[type] || 'documentation';
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
            if (!docNode) {
                continue;
            }

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
                    const newNode = {
                        id: `node_kw_${nodeIdCounter++}`,
                        type: 'Keyword' as const,
                        label: tag,
                        chunkIds: []
                    };
                    nodes.push(newNode);
                    keywordMap.set(tag, newNode);
                    keywordNode = newNode;
                }

                keywordNode.chunkIds!.push(chunk.id);

                const targetId = keywordNode.id;
                const edgeExists = edges.some(e => e.source === docNode.id && e.target === targetId && e.type === 'MENTIONS');
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

    /**
     * Salva backup em JSON (fallback, n�o � o storage principal)
     */
    private async saveData(storagePath: string, chunks: Chunk[], nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
        const backupPath = path.join(storagePath, 'backup');
        
        await fs.promises.writeFile(path.join(backupPath, 'chunks.json'), JSON.stringify(chunks, null, 2), 'utf8');
        await fs.promises.writeFile(path.join(backupPath, 'nodes.json'), JSON.stringify(nodes, null, 2), 'utf8');
        await fs.promises.writeFile(path.join(backupPath, 'edges.json'), JSON.stringify(edges, null, 2), 'utf8');
        
        await fs.promises.writeFile(path.join(backupPath, 'metadata.json'), JSON.stringify({
            lastIndexed: new Date().toISOString(),
            totalChunks: chunks.length,
            totalNodes: nodes.length,
            totalEdges: edges.length,
            nodesByType: this.countByType(nodes),
            edgesByType: this.countByType(edges)
        }, null, 2), 'utf8');
        
        console.log('?? Backup JSON salvo em:', backupPath);
    }

    private countByType<T extends { type: string }>(items: T[]): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const item of items) {
            counts[item.type] = (counts[item.type] || 0) + 1;
        }
        return counts;
    }
}
