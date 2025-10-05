/**
 * Core schemas for Mini-CappyRAG system
 * Defines the contract for chunks, nodes, edges and related types
 */

// ========== Chunk Schema ==========

export interface Chunk {
    /** Unique identifier for the chunk (BLAKE3 hash) */
    id: string;
    /** File path where this chunk originated */
    path: string;
    /** Programming language or file type */
    language: string;
    /** Type of chunk content */
    type: ChunkType;
    /** Hash of the text content (for change detection) */
    textHash: string;
    /** Raw text content of the chunk */
    text: string;
    /** Start line number (1-indexed) */
    startLine: number;
    /** End line number (1-indexed) */
    endLine: number;
    /** Optional start character offset */
    startOffset?: number;
    /** Optional end character offset */
    endOffset?: number;
    /** Embedding vector (384d for MiniLM-L6-v2) */
    vector?: number[];
    /** Keywords extracted from chunk */
    keywords: string[];
    /** Metadata specific to chunk type */
    metadata: ChunkMetadata;
    /** Timestamp when chunk was created/updated */
    updatedAt: string;
    /** Version for incremental updates */
    version: number;
}

export type ChunkType = 
    | 'markdown-section'    // Markdown heading section
    | 'code-function'       // Function/method definition
    | 'code-class'          // Class definition  
    | 'code-interface'      // Interface definition
    | 'code-enum'           // Enum definition
    | 'code-type'           // Type alias
    | 'jsdoc-symbol'        // JSDoc/TypeDoc symbol
    | 'code-block'          // Generic code block
    | 'text-block';         // Generic text block

export interface ChunkMetadata {
    /** Heading level for markdown (1-6) */
    headingLevel?: number;
    /** Symbol name for code chunks */
    symbolName?: string;
    /** Symbol kind (function, class, etc.) */
    symbolKind?: string;
    /** Parent symbol (class for method, etc.) */
    parentSymbol?: string;
    /** JSDoc tags and descriptions */
    jsdocTags?: Record<string, string>;
    /** Complexity metrics */
    complexity?: number;
    /** Lines of code (for code chunks) */
    loc?: number;
}

// ========== Graph Schema ==========

export interface GraphNode {
    /** Unique identifier */
    id: string;
    /** Type of node */
    type: NodeType;
    /** Display label */
    label: string;
    /** Properties specific to node type */
    properties: NodeProperties;
    /** Associated chunk IDs */
    chunkIds: string[];
    /** Timestamp when node was created/updated */
    updatedAt: string;
}

export type NodeType = 
    | 'document'    // File or document
    | 'section'     // Section within document
    | 'keyword'     // Extracted keyword/tag
    | 'symbol';     // Code symbol (function, class, etc.)

export interface NodeProperties {
    /** File path for document nodes */
    path?: string;
    /** Language/file type */
    language?: string;
    /** Symbol information for symbol nodes */
    symbolInfo?: {
        name: string;
        kind: string;
        signature?: string;
        parameters?: string[];
        returnType?: string;
    };
    /** Keyword frequency and relevance */
    keywordInfo?: {
        frequency: number;
        relevance: number;
        contexts: string[];
    };
}

export interface GraphEdge {
    /** Unique identifier */
    id: string;
    /** Source node ID */
    sourceId: string;
    /** Target node ID */
    targetId: string;
    /** Type of relationship */
    type: EdgeType;
    /** Weight/strength of relationship */
    weight: number;
    /** Additional properties */
    properties: EdgeProperties;
    /** Timestamp when edge was created/updated */
    updatedAt: string;
}

export type EdgeType = 
    | 'CONTAINS'        // document contains section, class contains method
    | 'HAS_KEYWORD'     // section/document has keyword
    | 'REFERS_TO'       // links/@see references
    | 'MENTIONS_SYMBOL' // text mentions a symbol
    | 'MEMBER_OF'       // method is member of class
    | 'SIMILAR_TO';     // semantic similarity

export interface EdgeProperties {
    /** Context where relationship was found */
    context?: string;
    /** Confidence score */
    confidence?: number;
    /** Source location (line number, etc.) */
    sourceLocation?: {
        line: number;
        column?: number;
    };
}

// ========== Query & Results Schema ==========

export interface SearchQuery {
    /** Query text */
    query: string;
    /** Maximum results to return */
    topK?: number;
    /** Filters to apply */
    filters?: SearchFilters;
    /** Include graph expansion */
    expandGraph?: boolean;
    /** Maximum graph nodes to return */
    maxGraphNodes?: number;
}

export interface SearchFilters {
    /** Filter by file paths (glob patterns) */
    paths?: string[];
    /** Filter by languages */
    languages?: string[];
    /** Filter by chunk types */
    chunkTypes?: ChunkType[];
    /** Filter by node types */
    nodeTypes?: NodeType[];
    /** Filter by date range */
    dateRange?: {
        from?: string;
        to?: string;
    };
}

export interface SearchResult {
    /** Matching chunks */
    chunks: ChunkResult[];
    /** Related graph nodes */
    graphNodes: GraphNode[];
    /** Related graph edges */
    graphEdges: GraphEdge[];
    /** Query execution metadata */
    metadata: {
        totalResults: number;
        executionTimeMs: number;
        rankingScores: {
            vectorial: number;
            graph: number;
            keywords: number;
            freshness: number;
        };
    };
}

export interface ChunkResult {
    /** The chunk itself */
    chunk: Chunk;
    /** Overall relevance score */
    score: number;
    /** Score breakdown */
    scoreBreakdown: {
        cosine: number;
        keywordOverlap: number;
        graphWeight: number;
        freshness: number;
    };
    /** Explanation of why this result appeared */
    explanation: {
        matchedKeywords: string[];
        graphPath?: string[];
        similarityReason?: string;
    };
    /** Text snippet with highlights */
    snippet: string;
}

// ========== Configuration Schema ==========

export interface ChunkingConfig {
    /** Maximum lines per chunk */
    maxLinesPerChunk: number;
    /** Maximum tokens per chunk */
    maxTokensPerChunk: number;
    /** Overlap lines between adjacent chunks */
    overlapLines: number;
    /** Include docstring lines for code chunks */
    includeDocstringLines: number;
    /** Language-specific configurations */
    languageConfigs: Record<string, LanguageChunkingConfig>;
}

export interface LanguageChunkingConfig {
    /** File extensions for this language */
    extensions: string[];
    /** Chunking strategy */
    strategy: 'ast' | 'regex' | 'line-based';
    /** Language-specific settings */
    settings: Record<string, any>;
}

// ========== Default Values ==========

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
    maxLinesPerChunk: 100,
    maxTokensPerChunk: 2000,
    overlapLines: 3,
    includeDocstringLines: 5,
    languageConfigs: {
        'typescript': {
            extensions: ['.ts', '.tsx'],
            strategy: 'ast',
            settings: {
                includeImports: true,
                includeExports: true,
                minFunctionLines: 3
            }
        },
        'javascript': {
            extensions: ['.js', '.jsx'],
            strategy: 'ast',
            settings: {
                includeImports: true,
                includeExports: true,
                minFunctionLines: 3
            }
        },
        'markdown': {
            extensions: ['.md', '.mdx'],
            strategy: 'regex',
            settings: {
                headingLevels: [1, 2, 3, 4, 5, 6],
                includeCodeBlocks: true
            }
        }
    }
};

export const EDGE_WEIGHTS: Record<EdgeType, number> = {
    'REFERS_TO': 1.0,
    'MENTIONS_SYMBOL': 0.8,
    'MEMBER_OF': 0.6,
    'CONTAINS': 0.4,
    'HAS_KEYWORD': 0.3,
    'SIMILAR_TO': 0.2
};

export const RANKING_WEIGHTS = {
    cosine: 0.6,
    keywordOverlap: 0.2,
    graphWeight: 0.15,
    freshness: 0.05
};
