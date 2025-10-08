import * as vscode from 'vscode';
import { CappyRAGDocument } from '../../../store/cappyragLanceDb';
import { getDatabase } from '../utils/databaseHelper';

/**
 * Mapping of file extensions to categories
 */
const fileExtensionToCategory: Record<string, string> = {
    // Documentation
    'md': 'markdown', 'mdx': 'markdown', 'markdown': 'markdown',
    'rst': 'documentation', 'txt': 'text', 'doc': 'documentation', 'docx': 'documentation',
    
    // Backend
    'cs': 'csharp', 'csx': 'csharp',
    'java': 'java',
    'py': 'python', 'pyc': 'python', 'pyw': 'python',
    'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'php': 'php',
    
    // Frontend
    'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
    'ts': 'typescript', 'tsx': 'react', 'jsx': 'react',
    'vue': 'vue', 'svelte': 'svelte',
    
    // Style
    'css': 'css', 'scss': 'scss', 'sass': 'scss', 'less': 'less', 'styl': 'stylus',
    
    // Markup
    'html': 'html', 'htm': 'html',
    'xml': 'xml', 'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'toml': 'toml',
    
    // Database
    'sql': 'sql', 'mongodb': 'mongodb', 'graphql': 'graphql', 'gql': 'graphql',
    
    // Shell
    'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell',
    'ps1': 'powershell', 'psm1': 'powershell', 'bat': 'batch', 'cmd': 'batch',
    
    // Build
    'gradle': 'gradle',
    
    // Data
    'csv': 'csv', 'tsv': 'csv', 'xlsx': 'excel', 'xls': 'excel',
    'parquet': 'parquet', 'arrow': 'arrow',
    
    // Others
    'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 'svg': 'image', 'webp': 'image',
    'mp4': 'video', 'avi': 'video', 'mov': 'video',
    'mp3': 'audio', 'wav': 'audio',
    'zip': 'archive', 'tar': 'archive', 'gz': 'archive', 'sevenZ': 'archive',
    'pdf': 'pdf', 'dll': 'binary', 'so': 'binary', 'exe': 'binary'
};

/**
 * Get file category from filename
 */
function getFileCategory(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) {
        return 'unknown';
    }
    return fileExtensionToCategory[ext] || 'unknown';
}

/**
 * Color scheme for file categories
 */
const categoryColors: Record<string, string> = {
    'markdown': '#10b981', 'documentation': '#10b981', 'text': '#6b7280',
    'csharp': '#68217a', 'dotnet': '#512bd4', 'java': '#b07219',
    'python': '#3572A5', 'ruby': '#701516', 'go': '#00ADD8', 'rust': '#dea584', 'php': '#4F5D95',
    'javascript': '#f1e05a', 'typescript': '#2b7489', 'react': '#61dafb', 'vue': '#41b883',
    'angular': '#dd0031', 'svelte': '#ff3e00',
    'css': '#563d7c', 'scss': '#c6538c', 'less': '#1d365d', 'stylus': '#ff6347', 'tailwind': '#06b6d4',
    'html': '#e34c26', 'xml': '#0060ac', 'json': '#292929', 'yaml': '#cb171e', 'toml': '#9c4221',
    'sql': '#e38c00', 'database': '#003b57', 'mongodb': '#4db33d', 'postgresql': '#336791',
    'mysql': '#4479a1', 'graphql': '#e10098',
    'shell': '#89e051', 'powershell': '#012456', 'batch': '#c1f12e',
    'dockerfile': '#384d54', 'makefile': '#427819', 'cmake': '#da3434', 'gradle': '#02303a', 'maven': '#c71a36',
    'csv': '#6b7280', 'excel': '#217346', 'parquet': '#00c8ff', 'arrow': '#d22128',
    'binary': '#1f2937', 'image': '#f59e0b', 'video': '#ef4444', 'audio': '#8b5cf6',
    'archive': '#6b7280', 'pdf': '#f40f02',
    'unknown': '#9ca3af', 'default': '#6366f1'
};

/**
 * Get color for file category
 */
function getCategoryColor(category: string): string {
    return categoryColors[category] || categoryColors.default;
}

/**
 * Generate intelligent chunk title from content
 * Inspired by CappyRAG's semantic chunking approach
 */
function generateChunkTitle(content: string, chunkIndex: number): string {
    if (!content || content.trim().length === 0) {
        return `Chunk ${chunkIndex}`;
    }
    
    // Try to extract first sentence (up to ., !, ? or newline)
    const firstSentenceMatch = content.match(/^[^.!?\n]+[.!?]?/);
    if (firstSentenceMatch && firstSentenceMatch[0].length > 0) {
        const sentence = firstSentenceMatch[0].trim();
        // Limit to 60 characters for display
        if (sentence.length <= 60) {
            return sentence;
        }
        return sentence.substring(0, 57) + '...';
    }
    
    // Fallback: first 50 chars
    const preview = content.trim().substring(0, 50);
    return preview + (content.length > 50 ? '...' : '');
}

/**
 * Calculate importance score for a node (0-1)
 */
function calculateImportance(connections: number, confidence: number, created: string, sourcesCount: number): number {
    const weights = {
        connections: 0.4,
        confidence: 0.3,
        recency: 0.2,
        sources: 0.1
    };
    
    // Normalize connections (0-1) assuming max 50
    const maxConnections = 50;
    const connectionsScore = Math.min(connections / maxConnections, 1);
    
    // Confidence is already 0-1
    const confidenceScore = confidence;
    
    // Recency (more recent = higher score, decays over 1 year)
    const daysSinceCreation = (Date.now() - new Date(created).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(1 - (daysSinceCreation / 365), 0);
    
    // Sources (normalize to max 10)
    const sourcesScore = Math.min(sourcesCount / 10, 1);
    
    return (
        connectionsScore * weights.connections +
        confidenceScore * weights.confidence +
        recencyScore * weights.recency +
        sourcesScore * weights.sources
    );
}

/**
 * Handle getting graph data for visualization
 */
export async function handleGetGraphData(panel: vscode.WebviewPanel): Promise<void> {
    try {
        console.log('[Backend] Getting graph data...');
        const db = getDatabase();
        await db.initialize();
        const documents = await db.getDocumentsAsync();
        const entities = await db.getEntitiesAsync();
        const relationships = await db.getRelationshipsAsync();
        const chunks = await db.getChunksAsync();
        
        console.log(`[Backend] Found: ${documents.length} docs, ${entities.length} entities, ${relationships.length} rels, ${chunks.length} chunks`);

        // Build graph data structure
        const nodes: any[] = [];
        const edges: any[] = [];
        
        // Create connection maps for calculating connections per node
        const connectionCounts = new Map<string, {incoming: number, outgoing: number}>();
        
        // Initialize connection counts
        documents.forEach((doc: CappyRAGDocument) => {
            connectionCounts.set(doc.id, {incoming: 0, outgoing: 0});
        });
        entities.forEach((entity: any) => {
            connectionCounts.set(entity.id, {incoming: 0, outgoing: 0});
        });
        chunks.slice(0, 50).forEach((chunk: any) => {
            connectionCounts.set(chunk.id, {incoming: 0, outgoing: 0});
        });

        // Add document nodes with enriched metadata
        documents.forEach((doc: CappyRAGDocument) => {
            const fileCategory = getFileCategory(doc.fileName);
            const categoryColor = getCategoryColor(fileCategory);
            const connections = connectionCounts.get(doc.id) || {incoming: 0, outgoing: 0};
            const totalConnections = connections.incoming + connections.outgoing;
            
            // Calculate importance
            const importance = calculateImportance(
                totalConnections,
                1.0, // Documents have 100% confidence by default
                doc.created,
                1 // Single source (the file itself)
            );
            
            // Dynamic size based on connections and importance
            const baseSize = 15;
            const sizeMultiplier = 1 + (totalConnections * 0.1) + (importance * 0.5);
            const size = Math.min(baseSize * sizeMultiplier, 40); // Cap at 40
            
            nodes.push({
                id: doc.id,
                label: doc.title || doc.fileName,
                type: 'Document',
                size: size,
                color: categoryColor,
                shape: 'circle',
                opacity: 0.85,
                metadata: {
                    fileName: doc.fileName,
                    filePath: doc.filePath,
                    fileSize: doc.fileSize,
                    category: doc.category,
                    fileCategory: fileCategory,
                    tags: doc.tags || [],
                    status: doc.status,
                    description: doc.description,
                    processingResults: doc.processingResults,
                    created: doc.created,
                    updated: doc.updated,
                    confidence: 1.0
                },
                connections: {
                    incoming: connections.incoming,
                    outgoing: connections.outgoing,
                    total: totalConnections
                },
                metrics: {
                    importance: importance,
                    pageRank: 0 // Will be calculated in frontend
                },
                state: {
                    highlighted: false,
                    selected: false,
                    hovered: false,
                    visible: true,
                    expanded: false
                }
            });
        });

        // Add entity nodes with enriched metadata
        entities.forEach((entity: any) => {
            // Convert Apache Arrow array to JS array if needed
            let documentIds: string[] = [];
            if (entity.documentIds) {
                if (Array.isArray(entity.documentIds)) {
                    documentIds = entity.documentIds;
                } else if (typeof entity.documentIds.toArray === 'function') {
                    documentIds = entity.documentIds.toArray();
                } else if (typeof entity.documentIds === 'object' && entity.documentIds.length !== undefined) {
                    // Apache Arrow Vector - convert to array manually
                    documentIds = Array.from({ length: entity.documentIds.length }, (_, i) => entity.documentIds[i]);
                }
            }
            
            const connections = connectionCounts.get(entity.id) || {incoming: 0, outgoing: 0};
            const totalConnections = connections.incoming + connections.outgoing;
            const confidence = entity.confidence || 0.8;
            
            // Calculate importance
            const importance = calculateImportance(
                totalConnections,
                confidence,
                entity.created,
                documentIds.length
            );
            
            // Dynamic size
            const baseSize = 10;
            const sizeMultiplier = 1 + (totalConnections * 0.1) + (importance * 0.5);
            const size = Math.min(baseSize * sizeMultiplier, 35);
            
            // Entity type colors
            const entityTypeColors: Record<string, string> = {
                person: '#3b82f6',
                technology: '#8b5cf6',
                concept: '#06b6d4',
                organization: '#f59e0b',
                location: '#14b8a6',
                default: '#6366f1'
            };
            const color = entityTypeColors[(entity.type || '').toLowerCase()] || entityTypeColors.default;
            
            nodes.push({
                id: entity.id,
                label: entity.name,
                type: 'Entity',
                size: size,
                color: color,
                shape: 'circle',
                opacity: 0.85,
                metadata: {
                    entityType: entity.type,
                    description: entity.description || '',
                    properties: entity.properties || {},
                    sourceDocumentsCount: documentIds.length,
                    sourceDocuments: documentIds,
                    sourceChunks: entity.sourceChunks || [],
                    sourceChunksCount: (entity.sourceChunks || []).length,
                    confidence: confidence,
                    created: entity.created,
                    updated: entity.updated,
                    mergedFrom: entity.mergedFrom || [],
                    mergedCount: (entity.mergedFrom || []).length
                },
                connections: {
                    incoming: connections.incoming,
                    outgoing: connections.outgoing,
                    total: totalConnections
                },
                metrics: {
                    importance: importance,
                    pageRank: 0
                },
                state: {
                    highlighted: false,
                    selected: false,
                    hovered: false,
                    visible: true,
                    expanded: false
                }
            });

            // Connect entity to its documents
            if (documentIds && documentIds.length > 0) {
                documentIds.forEach((docId: string) => {
                    if (docId && connectionCounts.has(docId)) {
                        const edgeId = `${docId}-contains-${entity.id}`;
                        edges.push({
                            id: edgeId,
                            source: docId,
                            target: entity.id,
                            label: 'contains',
                            type: 'line',
                            size: 2,
                            color: '#999',
                            opacity: 0.6,
                            metadata: {
                                relationshipType: 'CONTAINS',
                                description: 'Document contains entity',
                                weight: 0.5,
                                confidence: 1.0,
                                bidirectional: false,
                                created: entity.created
                            },
                            state: {
                                highlighted: false,
                                selected: false,
                                visible: true
                            }
                        });
                        
                        // Update connection counts
                        const docConn = connectionCounts.get(docId)!;
                        docConn.outgoing++;
                        const entConn = connectionCounts.get(entity.id)!;
                        entConn.incoming++;
                    }
                });
            }
        });

        // Add relationship edges with enriched metadata
        relationships.forEach((rel: any) => {
            const weight = rel.weight || 0.5;
            const confidence = rel.confidence || 0.7;
            
            // Update connection counts
            if (connectionCounts.has(rel.source) && connectionCounts.has(rel.target)) {
                const sourceConn = connectionCounts.get(rel.source)!;
                sourceConn.outgoing++;
                const targetConn = connectionCounts.get(rel.target)!;
                targetConn.incoming++;
                
                edges.push({
                    id: rel.id || `${rel.source}-${rel.type}-${rel.target}`,
                    source: rel.source,
                    target: rel.target,
                    label: rel.type,
                    type: rel.bidirectional ? 'line' : 'line', // Could use 'arrow' for directed
                    size: Math.max(1, weight * 4), // Scale size by weight
                    color: '#f97316',
                    opacity: 0.6 + (confidence * 0.3),
                    metadata: {
                        relationshipType: rel.type,
                        description: rel.description || '',
                        weight: weight,
                        confidence: confidence,
                        bidirectional: rel.bidirectional || false,
                        properties: rel.properties || {},
                        sourceDocuments: rel.sourceDocuments || [],
                        sourceChunks: rel.sourceChunks || [],
                        created: rel.created,
                        updated: rel.updated
                    },
                    state: {
                        highlighted: false,
                        selected: false,
                        visible: true
                    }
                });
            }
        });

        // Add chunk nodes with enriched metadata (smaller, connected to documents)
        chunks.slice(0, 50).forEach((chunk: any) => { // Limit to 50 chunks for performance
            // Generate intelligent chunk title from content (first sentence or first 50 chars)
            const chunkTitle = generateChunkTitle(chunk.content, chunk.chunkIndex);
            
            // Convert Apache Arrow arrays to JS arrays if needed
            let chunkEntities: string[] = [];
            if (chunk.entities) {
                if (Array.isArray(chunk.entities)) {
                    chunkEntities = chunk.entities;
                } else if (typeof chunk.entities.toArray === 'function') {
                    chunkEntities = chunk.entities.toArray();
                } else if (typeof chunk.entities === 'object' && chunk.entities.length !== undefined) {
                    chunkEntities = Array.from({ length: chunk.entities.length }, (_, i) => chunk.entities[i]);
                }
            }
            
            let chunkRelationships: string[] = [];
            if (chunk.relationships) {
                if (Array.isArray(chunk.relationships)) {
                    chunkRelationships = chunk.relationships;
                } else if (typeof chunk.relationships.toArray === 'function') {
                    chunkRelationships = chunk.relationships.toArray();
                } else if (typeof chunk.relationships === 'object' && chunk.relationships.length !== undefined) {
                    chunkRelationships = Array.from({ length: chunk.relationships.length }, (_, i) => chunk.relationships[i]);
                }
            }
            
            const connections = connectionCounts.get(chunk.id) || {incoming: 0, outgoing: 0};
            const totalConnections = connections.incoming + connections.outgoing;
            
            // Calculate importance
            const importance = calculateImportance(
                totalConnections,
                0.9, // Chunks have high confidence (processed data)
                chunk.created,
                1 // Single document source
            );
            
            // Line range string
            const lineRange = chunk.startLine && chunk.endLine 
                ? `L${chunk.startLine}-L${chunk.endLine}` 
                : undefined;
            
            nodes.push({
                id: chunk.id,
                label: chunkTitle,
                type: 'chunk',
                size: 5,
                color: '#8b5cf6',
                shape: 'rect',
                opacity: 0.7,
                metadata: {
                    chunkIndex: chunk.chunkIndex,
                    contentLength: chunk.content.length,
                    documentId: chunk.documentId,
                    entitiesCount: chunkEntities.length,
                    relationshipsCount: chunkRelationships.length,
                    entities: chunkEntities,
                    relationships: chunkRelationships,
                    startLine: chunk.startLine,
                    endLine: chunk.endLine,
                    lineRange: lineRange,
                    startPosition: chunk.startPosition,
                    endPosition: chunk.endPosition,
                    contentPreview: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
                    fullContent: chunk.content,
                    created: chunk.created,
                    confidence: 0.9
                },
                connections: {
                    incoming: connections.incoming,
                    outgoing: connections.outgoing,
                    total: totalConnections
                },
                metrics: {
                    importance: importance,
                    pageRank: 0
                },
                state: {
                    highlighted: false,
                    selected: false,
                    hovered: false,
                    visible: true,
                    expanded: false
                }
            });

            // Connect chunk to its document
            if (chunk.documentId && connectionCounts.has(chunk.documentId)) {
                const edgeId = `${chunk.documentId}-chunk-${chunk.id}`;
                edges.push({
                    id: edgeId,
                    source: chunk.documentId,
                    target: chunk.id,
                    label: 'chunk',
                    type: 'line',
                    size: 1,
                    color: '#999',
                    opacity: 0.4,
                    metadata: {
                        relationshipType: 'HAS_CHUNK',
                        description: 'Document chunk',
                        weight: 0.3,
                        confidence: 1.0,
                        bidirectional: false,
                        created: chunk.created
                    },
                    state: {
                        highlighted: false,
                        selected: false,
                        visible: true
                    }
                });
                
                // Update connection counts
                const docConn = connectionCounts.get(chunk.documentId)!;
                docConn.outgoing++;
                const chunkConn = connectionCounts.get(chunk.id)!;
                chunkConn.incoming++;
            }
        });

        // Update all nodes with final connection counts
        nodes.forEach(node => {
            const counts = connectionCounts.get(node.id);
            if (counts) {
                node.connections.incoming = counts.incoming;
                node.connections.outgoing = counts.outgoing;
                node.connections.total = counts.incoming + counts.outgoing;
                
                // Recalculate size based on final connections
                const importance = calculateImportance(
                    node.connections.total,
                    node.metadata.confidence || 0.8,
                    node.metadata.created,
                    node.metadata.sourceDocumentsCount || 1
                );
                node.metrics.importance = importance;
                
                // Update size
                if (node.type === 'document') {
                    const baseSize = 15;
                    const sizeMultiplier = 1 + (node.connections.total * 0.1) + (importance * 0.5);
                    node.size = Math.min(baseSize * sizeMultiplier, 40);
                } else if (node.type === 'entity') {
                    const baseSize = 10;
                    const sizeMultiplier = 1 + (node.connections.total * 0.1) + (importance * 0.5);
                    node.size = Math.min(baseSize * sizeMultiplier, 35);
                }
            }
        });
        
        // Calculate statistics
        const nodesByType = nodes.reduce((acc: Record<string, number>, node: any) => {
            acc[node.type] = (acc[node.type] || 0) + 1;
            return acc;
        }, {});
        
        const edgesByType = edges.reduce((acc: Record<string, number>, edge: any) => {
            const type = edge.metadata?.relationshipType || 'unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        
        const avgConfidence = nodes.reduce((sum: number, node: any) => 
            sum + (node.metadata.confidence || 0), 0) / nodes.length;
        
        const dates = nodes
            .map((n: any) => n.metadata.created)
            .filter((d: string) => d)
            .map((d: string) => new Date(d).getTime());
        
        const dateRange = dates.length > 0 ? {
            min: new Date(Math.min(...dates)).toISOString(),
            max: new Date(Math.max(...dates)).toISOString()
        } : null;
        
        console.log(`[Backend] Sending graph data: ${nodes.length} nodes, ${edges.length} edges`);
        panel.webview.postMessage({
            command: 'graphData',
            data: {
                nodes,
                edges,
                statistics: {
                    totalNodes: nodes.length,
                    totalEdges: edges.length,
                    nodesByType,
                    edgesByType,
                    avgConfidence,
                    dateRange
                }
            }
        });

    } catch (error) {
        console.error('[Backend] Error loading graph data:', error);
        panel.webview.postMessage({
            command: 'graphDataError',
            data: { message: error instanceof Error ? error.message : 'Failed to load graph data' }
        });
    }
}
