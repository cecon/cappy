import { LanceDBStore } from '../store/lancedb';
import { EmbeddingService } from '../core/embeddings';
import { LightGraphService } from '../core/lightgraph';
import { Chunk, GraphNode, GraphEdge } from '../core/schemas';

export interface SearchQuery {
  text: string;
  filters?: {
    paths?: string[];          // Filtrar por caminhos específicos
    languages?: string[];      // Filtrar por linguagens
    dateRange?: {             // Filtrar por data de modificação
      from?: string;
      to?: string;
    };
    symbols?: string[];       // Filtrar por símbolos específicos
    keywords?: string[];      // Filtrar por palavras-chave
  };
  options?: {
    maxResults?: number;      // Máximo de resultados (padrão: 20)
    expandHops?: number;      // Número de hops para expansão (padrão: 1)
    includeGraph?: boolean;   // Incluir informação do grafo
    minScore?: number;        // Pontuação mínima (padrão: 0.1)
    vectorWeight?: number;    // Peso da busca vetorial (padrão: 0.6)
    graphWeight?: number;     // Peso da expansão do grafo (padrão: 0.3)
    freshnessWeight?: number; // Peso do frescor (padrão: 0.1)
  };
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
  explanation: {
    vectorScore: number;      // Pontuação da busca vetorial
    graphScore: number;       // Pontuação da expansão do grafo
    freshnessScore: number;   // Pontuação do frescor
    keywordOverlap: number;   // Sobreposição de palavras-chave
    pathInGraph: GraphNode[];      // Caminho no grafo (se expandido)
    relatedNodes: GraphNode[];     // Nós relacionados encontrados
    whyRelevant: string;      // Explicação textual da relevância
  };
}

export interface SearchResponse {
  results: SearchResult[];
  stats: {
    totalFound: number;
    vectorMatches: number;
    graphExpansions: number;
    processingTime: number;
    query: SearchQuery;
  };
  graph?: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    subgraphStats: {
      totalNodes: number;
      totalEdges: number;
      connectedComponents: number;
    };
  };
}

export interface HybridSearchConfig {
  defaultMaxResults: number;
  defaultExpandHops: number;
  defaultVectorWeight: number;
  defaultGraphWeight: number;
  defaultFreshnessWeight: number;
  minScoreThreshold: number;
  maxGraphExpansionNodes: number;
  vectorSearchTopK: number;
  enableQueryExpansion: boolean;
  cacheResultsMinutes: number;
}

export class HybridSearchPipeline {
  private lancedb: LanceDBStore;
  private embeddings: EmbeddingService;
  private lightgraph: LightGraphService;
  private config: HybridSearchConfig;
  private queryCache: Map<string, { result: SearchResponse; timestamp: number }>;

  constructor(
    lancedb: LanceDBStore,
    embeddings: EmbeddingService,
    lightgraph: LightGraphService,
    config?: Partial<HybridSearchConfig>
  ) {
    this.lancedb = lancedb;
    this.embeddings = embeddings;
    this.lightgraph = lightgraph;
    
    this.config = {
      defaultMaxResults: 20,
      defaultExpandHops: 1,
      defaultVectorWeight: 0.6,
      defaultGraphWeight: 0.3,
      defaultFreshnessWeight: 0.1,
      minScoreThreshold: 0.1,
      maxGraphExpansionNodes: 500,
      vectorSearchTopK: 50,
      enableQueryExpansion: true,
      cacheResultsMinutes: 10,
      ...config
    };

    this.queryCache = new Map();
  }

  /**
   * Executa busca híbrida completa
   */
  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Verificar cache
      const cacheKey = this.generateCacheKey(query);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        console.log('📋 Returning cached search result');
        return cached;
      }

      console.log(`🔍 Starting hybrid search for: "${query.text}"`);

      // 2. Fase 1: Busca Vetorial
      const vectorResults = await this.vectorSearch(query);
      console.log(`📊 Vector search found ${vectorResults.length} results`);

      // 3. Fase 2: Expansão do Grafo (se habilitada)
      let expandedResults = vectorResults;
      if (query.options?.expandHops && query.options.expandHops > 0) {
        expandedResults = await this.expandWithGraph(vectorResults, query);
        console.log(`🕸️  Graph expansion added ${expandedResults.length - vectorResults.length} new results`);
      }

      // 4. Fase 3: Ranking Híbrido
      const rankedResults = await this.hybridRanking(expandedResults, query);
      console.log(`🏆 Hybrid ranking processed ${rankedResults.length} results`);

      // 5. Fase 4: Formatação e Limitação
      const finalResults = this.formatAndLimit(rankedResults, query);

      // 6. Construir resposta
      const response: SearchResponse = {
        results: finalResults,
        stats: {
          totalFound: expandedResults.length,
          vectorMatches: vectorResults.length,
          graphExpansions: expandedResults.length - vectorResults.length,
          processingTime: Date.now() - startTime,
          query
        }
      };

      // 7. Adicionar informação do grafo se solicitada
      if (query.options?.includeGraph) {
        response.graph = await this.buildSubgraph(finalResults);
      }

      // 8. Cache do resultado
      this.cacheResult(cacheKey, response);

      console.log(`✅ Search completed in ${response.stats.processingTime}ms`);
      return response;

    } catch (error) {
      console.error('❌ Search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fase 1: Busca vetorial usando embeddings
   */
  private async vectorSearch(query: SearchQuery): Promise<SearchResult[]> {
    // 1. Gerar embedding da query
    const queryEmbedding = await this.embeddings.embed(query.text);
    
    // 2. Buscar chunks similares no LanceDB
    const topK = this.config.vectorSearchTopK;
    const similarChunks = await this.lancedb.searchSimilar(queryEmbedding, topK);

    // 3. Aplicar filtros
    const filteredChunks = this.applyFilters(similarChunks, query.filters);

    // 4. Converter para SearchResults
    const results: SearchResult[] = filteredChunks.map((chunk, index) => ({
      chunk,
      score: this.calculateVectorScore(chunk, queryEmbedding),
      explanation: {
        vectorScore: this.calculateVectorScore(chunk, queryEmbedding),
        graphScore: 0, // Será calculado na expansão
        freshnessScore: this.calculateFreshnessScore(chunk),
        keywordOverlap: this.calculateKeywordOverlap(query.text, chunk),
        pathInGraph: [],
        relatedNodes: [],
        whyRelevant: `Vector similarity: ${this.calculateVectorScore(chunk, queryEmbedding).toFixed(3)}`
      }
    }));

    return results.filter(r => r.score >= (query.options?.minScore || this.config.minScoreThreshold));
  }

  /**
   * Fase 2: Expansão usando o grafo de conhecimento
   */
  private async expandWithGraph(vectorResults: SearchResult[], query: SearchQuery): Promise<SearchResult[]> {
    if (!query.options?.expandHops || query.options.expandHops === 0) {
      return vectorResults;
    }

    const expandedResults = [...vectorResults];
    const processedChunks = new Set(vectorResults.map(r => r.chunk.id));

    for (const result of vectorResults) {
      try {
        // 1. Encontrar nós relacionados no grafo
        const relatedNodes = await this.lightgraph.findRelatedNodes(
          `chunk:${result.chunk.id}`,
          query.options.expandHops
        );

        // 2. Para cada nó relacionado, buscar chunks correspondentes
        for (const node of relatedNodes) {
          if (expandedResults.length >= this.config.maxGraphExpansionNodes) {
            break;
          }

          // Se for um chunk, adicionar aos resultados
          if (node.id.startsWith('chunk:')) {
            const chunkId = node.id.replace('chunk:', '');
            
            if (!processedChunks.has(chunkId)) {
              const chunk = await this.lancedb.getChunkById(chunkId);
              if (chunk) {
                const graphScore = this.calculateGraphScore(result, node);
                const expandedResult: SearchResult = {
                  chunk,
                  score: 0, // Será recalculado no ranking híbrido
                  explanation: {
                    vectorScore: 0,
                    graphScore,
                    freshnessScore: this.calculateFreshnessScore(chunk),
                    keywordOverlap: this.calculateKeywordOverlap(query.text, chunk),
                    pathInGraph: await this.findPathInGraph(result.chunk.id, chunkId),
                    relatedNodes: [node],
                    whyRelevant: `Found via graph expansion from "${result.chunk.path}"`
                  }
                };

                expandedResults.push(expandedResult);
                processedChunks.add(chunkId);
              }
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Failed to expand chunk ${result.chunk.id}:`, error);
      }
    }

    return expandedResults;
  }

  /**
   * Fase 3: Ranking híbrido combinando diferentes sinais
   */
  private async hybridRanking(results: SearchResult[], query: SearchQuery): Promise<SearchResult[]> {
    const vectorWeight = query.options?.vectorWeight || this.config.defaultVectorWeight;
    const graphWeight = query.options?.graphWeight || this.config.defaultGraphWeight;
    const freshnessWeight = query.options?.freshnessWeight || this.config.defaultFreshnessWeight;

    // Normalizar scores para combinação
    const maxVectorScore = Math.max(...results.map(r => r.explanation.vectorScore));
    const maxGraphScore = Math.max(...results.map(r => r.explanation.graphScore));
    const maxFreshnessScore = Math.max(...results.map(r => r.explanation.freshnessScore));

    for (const result of results) {
      const normalizedVector = maxVectorScore > 0 ? result.explanation.vectorScore / maxVectorScore : 0;
      const normalizedGraph = maxGraphScore > 0 ? result.explanation.graphScore / maxGraphScore : 0;
      const normalizedFreshness = maxFreshnessScore > 0 ? result.explanation.freshnessScore / maxFreshnessScore : 0;

      // Calcular score híbrido
      result.score = (
        normalizedVector * vectorWeight +
        normalizedGraph * graphWeight +
        normalizedFreshness * freshnessWeight +
        result.explanation.keywordOverlap * 0.1 // Bonus para overlap de keywords
      );

      // Atualizar explicação
      result.explanation.whyRelevant = this.generateRelevanceExplanation(result, query);
    }

    // Ordenar por score decrescente
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Fase 4: Formatação final e limitação de resultados
   */
  private formatAndLimit(results: SearchResult[], query: SearchQuery): SearchResult[] {
    const maxResults = query.options?.maxResults || this.config.defaultMaxResults;
    const minScore = query.options?.minScore || this.config.minScoreThreshold;

    return results
      .filter(r => r.score >= minScore)
      .slice(0, maxResults);
  }

  private applyFilters(chunks: Chunk[], filters?: SearchQuery['filters']): Chunk[] {
    if (!filters) {
      return chunks;
    }

    return chunks.filter(chunk => {
      return this.passesPathFilter(chunk, filters) &&
             this.passesLanguageFilter(chunk, filters) &&
             this.passesDateFilter(chunk, filters);
    });
  }

  private passesPathFilter(chunk: Chunk, filters: SearchQuery['filters']): boolean {
    if (!filters?.paths || filters.paths.length === 0) {
      return true;
    }
    return filters.paths.some(path => chunk.path.includes(path));
  }

  private passesLanguageFilter(chunk: Chunk, filters: SearchQuery['filters']): boolean {
    if (!filters?.languages || filters.languages.length === 0) {
      return true;
    }
    return filters.languages.includes(chunk.language);
  }

  private passesDateFilter(chunk: Chunk, filters: SearchQuery['filters']): boolean {
    if (!filters?.dateRange || !chunk.updatedAt) {
      return true;
    }
    
    const chunkDate = new Date(chunk.updatedAt);
    
    if (filters.dateRange.from && chunkDate < new Date(filters.dateRange.from)) {
      return false;
    }
    
    if (filters.dateRange.to && chunkDate > new Date(filters.dateRange.to)) {
      return false;
    }
    
    return true;
  }

  private calculateVectorScore(chunk: Chunk, queryEmbedding: number[]): number {
    if (!chunk.vector) {
      return 0;
    }
    // Calcular similaridade cosine
    return this.cosineSimilarity(chunk.vector, queryEmbedding);
  }

  private calculateGraphScore(sourceResult: SearchResult, relatedNode: GraphNode): number {
    // Score baseado no tipo e peso das conexões
    const baseScore = 0.5; // Score base para conexão do grafo
    
    // Bonus baseado no tipo do nó
    const typeBonus = {
      symbol: 0.3,
      document: 0.2,
      section: 0.25,
      keyword: 0.1
    };

    return baseScore + (typeBonus[relatedNode.type as keyof typeof typeBonus] || 0);
  }

  private calculateFreshnessScore(chunk: Chunk): number {
    if (!chunk.updatedAt) {
      return 0.5; // Score neutro se não houver data
    }
    
    const now = new Date().getTime();
    const chunkTime = new Date(chunk.updatedAt).getTime();
    const daysSinceIndexed = (now - chunkTime) / (1000 * 60 * 60 * 24);
    
    // Score decai exponencialmente: 1.0 para hoje, 0.5 para 30 dias atrás
    return Math.exp(-daysSinceIndexed / 30);
  }

  private calculateKeywordOverlap(queryText: string, chunk: Chunk): number {
    if (!chunk.keywords) {
      return 0;
    }

    const queryWords = this.extractKeywords(queryText.toLowerCase());
    const chunkKeywords = chunk.keywords.map(k => k.toLowerCase());
    
    const overlap = queryWords.filter(word => 
      chunkKeywords.some(keyword => keyword.includes(word) || word.includes(keyword))
    ).length;

    return queryWords.length > 0 ? overlap / queryWords.length : 0;
  }

  private async findPathInGraph(sourceChunkId: string, targetChunkId: string): Promise<GraphNode[]> {
    // Simplificado - retornar caminho vazio por enquanto
    return [];
  }

  /**
   * Gerar explicação de relevância
   */
  private generateRelevanceExplanation(result: SearchResult, query: SearchQuery): string {
    const explanations: string[] = [];

    if (result.explanation.vectorScore > 0.5) {
      explanations.push(`High vector similarity (${result.explanation.vectorScore.toFixed(3)})`);
    }

    if (result.explanation.graphScore > 0) {
      explanations.push(`Connected via graph (score: ${result.explanation.graphScore.toFixed(3)})`);
    }

    if (result.explanation.keywordOverlap > 0.3) {
      explanations.push(`Strong keyword match (${(result.explanation.keywordOverlap * 100).toFixed(1)}%)`);
    }

    if (result.explanation.freshnessScore > 0.8) {
      explanations.push('Recently updated');
    }

    return explanations.length > 0 ? explanations.join('; ') : 'Relevant match found';
  }

  private async buildSubgraph(results: SearchResult[]): Promise<SearchResponse['graph']> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Coletar nós dos resultados
    for (const result of results) {
      // Adicionar nó do chunk
      const chunkNodeId = `chunk:${result.chunk.id}`;
      if (!nodeIds.has(chunkNodeId)) {
        nodes.push({
          id: chunkNodeId,
          type: 'section',
          label: `${result.chunk.path}:${result.chunk.startLine}`,
          properties: {
            path: result.chunk.path,
            language: result.chunk.language
          },
          chunkIds: [result.chunk.id],
          updatedAt: result.chunk.updatedAt || new Date().toISOString()
        });
        nodeIds.add(chunkNodeId);
      }

      // Adicionar nós relacionados
      for (const relatedNode of result.explanation.relatedNodes) {
        if (!nodeIds.has(relatedNode.id)) {
          nodes.push(relatedNode);
          nodeIds.add(relatedNode.id);
        }
      }
    }

    // Simplificado - edges serão implementados futuramente
    return {
      nodes,
      edges,
      subgraphStats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        connectedComponents: this.calculateConnectedComponents(nodes, edges)
      }
    };
  }

  /**
   * Utilitários auxiliares
   */
  private generateCacheKey(query: SearchQuery): string {
    return JSON.stringify(query);
  }

  private getCachedResult(cacheKey: string): SearchResponse | null {
    const cached = this.queryCache.get(cacheKey);
    if (cached) {
      const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
      if (ageMinutes < this.config.cacheResultsMinutes) {
        return cached.result;
      } else {
        this.queryCache.delete(cacheKey);
      }
    }
    return null;
  }

  private cacheResult(cacheKey: string, result: SearchResponse): void {
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Limpar cache antigo
    if (this.queryCache.size > 100) {
      const oldestEntry = this.queryCache.entries().next().value;
      if (oldestEntry) {
        this.queryCache.delete(oldestEntry[0]);
      }
    }
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): number {
    // Implementação simplificada - assumir 1 componente conectado
    return nodes.length > 0 ? 1 : 0;
  }

  /**
   * Limpar cache manualmente
   */
  clearCache(): void {
    this.queryCache.clear();
    console.log('🧹 Search cache cleared');
  }

  /**
   * Obter estatísticas do cache
   */
  getCacheStats(): { size: number; oldestAge: number } {
    const now = Date.now();
    let oldestAge = 0;

    for (const cached of this.queryCache.values()) {
      const age = (now - cached.timestamp) / (1000 * 60);
      oldestAge = Math.max(oldestAge, age);
    }

    return {
      size: this.queryCache.size,
      oldestAge
    };
  }
}