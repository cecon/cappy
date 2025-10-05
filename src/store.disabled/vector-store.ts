import { EmbeddingService, EmbeddingConfig, DEFAULT_EMBEDDING_CONFIG } from '../core/embeddings';
import { LanceDBStore, LanceDBConfig, DEFAULT_LANCEDB_CONFIG } from './lancedb';
import { Chunk } from '../core/schemas';

/**
 * Configuration for vector store service
 */
export interface VectorStoreConfig {
    embedding: EmbeddingConfig;
    lancedb: LanceDBConfig;
}

/**
 * Default vector store configuration
 */
export const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
    embedding: DEFAULT_EMBEDDING_CONFIG,
    lancedb: DEFAULT_LANCEDB_CONFIG
};

/**
 * Search options for vector queries
 */
export interface VectorSearchOptions {
    /** Maximum number of results */
    limit?: number;
    /** Minimum similarity score threshold */
    minScore?: number;
    /** Filters to apply */
    filters?: {
        languages?: string[];
        types?: string[];
        paths?: string[];
    };
}

/**
 * Vector search result with enhanced information
 */
export interface VectorSearchResult {
    /** The chunk data */
    chunk: Chunk;
    /** Similarity score (0-1) */
    score: number;
    /** Distance value from LanceDB */
    distance: number;
    /** Explanation of match */
    explanation?: {
        matchedKeywords: string[];
        textSnippet: string;
    };
}

/**
 * Integrated vector store service that combines embeddings and LanceDB
 */
export class VectorStoreService {
    private readonly embeddingService: EmbeddingService;
    private readonly lancedbStore: LanceDBStore;
    private readonly config: VectorStoreConfig;
    private isInitialized = false;

    constructor(config: VectorStoreConfig = DEFAULT_VECTOR_STORE_CONFIG) {
        this.config = config;
        this.embeddingService = new EmbeddingService(config.embedding);
        this.lancedbStore = new LanceDBStore(config.lancedb);
    }

    /**
     * Set storage paths for VS Code extension context
     */
    setStoragePaths(globalStoragePath: string): void {
        // Set paths for both services
        this.embeddingService.setCacheDir(`${globalStoragePath}/models`);
        this.lancedbStore.setDbPath(`${globalStoragePath}/lancedb`);
    }

    /**
     * Initialize both embedding and database services
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        console.log('Initializing Vector Store Service...');

        try {
            // Initialize embedding service first
            await this.embeddingService.initialize();
            console.log('✅ Embedding service initialized');

            // Initialize LanceDB store
            await this.lancedbStore.initialize();
            console.log('✅ LanceDB store initialized');

            this.isInitialized = true;
            console.log('🎉 Vector Store Service ready!');

        } catch (error) {
            console.error('❌ Failed to initialize Vector Store Service:', error);
            throw error;
        }
    }

    /**
     * Index chunks with embeddings
     */
    async indexChunks(chunks: Chunk[]): Promise<void> {
        await this.initialize();

        if (chunks.length === 0) {
            return;
        }

        console.log(`📊 Indexing ${chunks.length} chunks...`);

        try {
            // Generate embeddings for chunks that don't have them
            const chunksToEmbed = chunks.filter(chunk => !chunk.vector || chunk.vector.length === 0);
            
            if (chunksToEmbed.length > 0) {
                console.log(`🧠 Generating embeddings for ${chunksToEmbed.length} chunks...`);
                
                const texts = chunksToEmbed.map(chunk => chunk.text);
                const embeddings = await this.embeddingService.embedBatch(texts);
                
                // Assign embeddings to chunks
                for (let i = 0; i < chunksToEmbed.length; i++) {
                    chunksToEmbed[i].vector = embeddings[i];
                }
            }

            // Upsert all chunks to LanceDB
            await this.lancedbStore.upsertChunks(chunks);
            
            console.log(`✅ Successfully indexed ${chunks.length} chunks`);

        } catch (error) {
            console.error('❌ Failed to index chunks:', error);
            throw error;
        }
    }

    /**
     * Search for similar chunks using text query
     */
    async search(query: string, options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
        await this.initialize();

        const { limit = 20, minScore = 0.1, filters } = options;

        try {
            const queryEmbedding = await this.embeddingService.embed(query);
            const dbFilters = this.prepareDbFilters(filters);
            
            const rawResults = await this.lancedbStore.vectorSearch(
                queryEmbedding,
                limit * 2, // Get more results to account for filtering
                dbFilters
            );

            const results = this.processSearchResults(rawResults, query, limit, minScore, filters);
            
            console.log(`🔍 Found ${results.length} similar chunks for query: "${query}"`);
            return results;

        } catch (error) {
            console.error('❌ Search failed:', error);
            throw error;
        }
    }

    /**
     * Prepare database filters from search options
     */
    private prepareDbFilters(filters?: VectorSearchOptions['filters']): Record<string, any> {
        const dbFilters: Record<string, any> = {};
        
        if (filters?.languages && filters.languages.length > 0) {
            dbFilters.language = filters.languages;
        }
        if (filters?.types && filters.types.length > 0) {
            dbFilters.type = filters.types;
        }
        
        return dbFilters;
    }

    /**
     * Process raw search results into enhanced results
     */
    private processSearchResults(
        rawResults: any[],
        query: string,
        limit: number,
        minScore: number,
        filters?: VectorSearchOptions['filters']
    ): VectorSearchResult[] {
        const results: VectorSearchResult[] = [];
        const queryKeywords = this.extractQueryKeywords(query);

        for (const rawResult of rawResults) {
            // Apply path filtering
            if (!this.matchesPathFilter(rawResult.chunk.path, filters?.paths)) {
                continue;
            }

            // Calculate and validate score
            const score = Math.max(0, Math.min(1, 1 - rawResult.distance));
            if (score < minScore) {
                continue;
            }

            // Create enhanced result
            const enhancedResult = this.createEnhancedResult(rawResult, score, query, queryKeywords);
            results.push(enhancedResult);

            // Stop when we have enough results
            if (results.length >= limit) {
                break;
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Check if path matches path filter
     */
    private matchesPathFilter(path: string, pathPatterns?: string[]): boolean {
        if (!pathPatterns || pathPatterns.length === 0) {
            return true;
        }
        
        return pathPatterns.some(pattern => path.includes(pattern));
    }

    /**
     * Create enhanced search result from raw result
     */
    private createEnhancedResult(
        rawResult: any,
        score: number,
        query: string,
        queryKeywords: string[]
    ): VectorSearchResult {
        // Parse keywords from stored data (could be JSON string or array)
        const chunkKeywords = this.parseKeywords(rawResult.chunk.keywords);
        
        const matchedKeywords = queryKeywords.filter(qk => 
            chunkKeywords.some((ck: string) => ck.toLowerCase().includes(qk.toLowerCase()))
        );

        // Create text snippet
        const textSnippet = this.createTextSnippet(rawResult.chunk.text, query);

        // Convert chunk record back to Chunk object
        const chunk: Chunk = {
            id: rawResult.chunk.id,
            path: rawResult.chunk.path,
            language: rawResult.chunk.language,
            type: rawResult.chunk.type,
            textHash: rawResult.chunk.textHash,
            text: rawResult.chunk.text,
            startLine: rawResult.chunk.startLine,
            endLine: rawResult.chunk.endLine,
            keywords: chunkKeywords,
            metadata: this.parseMetadata(rawResult.chunk.metadata),
            vector: rawResult.chunk.vector,
            updatedAt: rawResult.chunk.updatedAt,
            version: rawResult.chunk.version
        };

        return {
            chunk,
            score,
            distance: rawResult.distance,
            explanation: {
                matchedKeywords,
                textSnippet
            }
        };
    }

    /**
     * Parse keywords from stored data
     */
    private parseKeywords(keywords: any): string[] {
        try {
            if (typeof keywords === 'string') {
                return JSON.parse(keywords);
            } else if (Array.isArray(keywords)) {
                return keywords;
            }
            return [];
        } catch (error) {
            console.warn('Failed to parse keywords:', keywords, error);
            return [];
        }
    }

    /**
     * Parse metadata from stored data
     */
    private parseMetadata(metadata: any): any {
        try {
            if (typeof metadata === 'string') {
                return JSON.parse(metadata);
            } else if (metadata && typeof metadata === 'object') {
                return metadata;
            }
            return {};
        } catch (error) {
            console.warn('Failed to parse metadata:', metadata, error);
            return {};
        }
    }

    /**
     * Get chunks by IDs
     */
    async getChunksByIds(ids: string[]): Promise<Chunk[]> {
        await this.initialize();

        if (ids.length === 0) {
            return [];
        }

        try {
            const records = await this.lancedbStore.getChunksByIds(ids);
            
            return records.map(record => ({
                id: record.id,
                path: record.path,
                language: record.language,
                type: record.type as any,
                textHash: record.textHash,
                text: record.text,
                startLine: record.startLine,
                endLine: record.endLine,
                keywords: this.parseKeywords(record.keywords),
                metadata: this.parseMetadata(record.metadata),
                vector: record.vector,
                updatedAt: record.updatedAt,
                version: record.version
            }));

        } catch (error) {
            console.error('❌ Failed to get chunks by IDs:', error);
            throw error;
        }
    }

    /**
     * Delete chunks by IDs
     */
    async deleteChunks(ids: string[]): Promise<void> {
        await this.initialize();
        await this.lancedbStore.deleteChunks(ids);
    }

    /**
     * Get service statistics
     */
    async getStats(): Promise<{
        isReady: boolean;
        modelInfo: any;
        dbStats: any;
    }> {
        const isReady = this.isInitialized && this.embeddingService.isReady();
        const modelInfo = this.embeddingService.getModelInfo();
        const dbStats = this.isInitialized ? await this.lancedbStore.getStats() : null;

        return {
            isReady,
            modelInfo,
            dbStats
        };
    }

    /**
     * Extract keywords from query text
     */
    private extractQueryKeywords(query: string): string[] {
        // Simple keyword extraction - split by spaces and filter short words
        return query
            .toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 10); // Limit to 10 keywords
    }

    /**
     * Create a text snippet around query matches
     */
    private createTextSnippet(text: string, query: string, maxLength: number = 200): string {
        const queryWords = query.toLowerCase().split(/\s+/);
        const textLower = text.toLowerCase();
        
        // Find the first occurrence of any query word
        let bestIndex = -1;
        
        for (const word of queryWords) {
            const index = textLower.indexOf(word);
            if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
                bestIndex = index;
            }
        }
        
        if (bestIndex === -1) {
            // No direct match found, return beginning of text
            return text.substring(0, maxLength) + (text.length > maxLength ? '...' : '');
        }
        
        // Create snippet around the match
        const start = Math.max(0, bestIndex - maxLength / 2);
        const end = Math.min(text.length, start + maxLength);
        
        let snippet = text.substring(start, end);
        
        // Add ellipsis if needed
        if (start > 0) {
            snippet = '...' + snippet;
        }
        if (end < text.length) {
            snippet = snippet + '...';
        }
        
        return snippet;
    }

    /**
     * Close all connections
     */
    async close(): Promise<void> {
        await this.lancedbStore.close();
        this.isInitialized = false;
    }
}
