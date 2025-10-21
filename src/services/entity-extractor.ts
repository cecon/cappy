/**
 * @fileoverview Entity extractor using GitHub Copilot LLM
 * @module services/entity-extractor
 * @author Cappy Team
 * @since 3.1.0
 */

import * as vscode from 'vscode';
import type {
  ExtractedEntity,
  EntityRelationship,
  EntityExtractionResult,
  EntityType,
  RelationshipType
} from '../types/entity';
import type { DocumentChunk } from '../types/chunk';

/**
 * System prompt for entity extraction
 */
const ENTITY_EXTRACTION_PROMPT = `You are an expert code documentation analyzer. Your task is to extract structured information from documentation chunks.

INSTRUCTIONS:
1. Identify entities: classes, functions, APIs, libraries, frameworks, concepts, patterns, technologies, services, components
2. Identify relationships between entities: uses, implements, extends, references, depends_on, mentions, describes
3. Return ONLY valid JSON, no additional text
4. Use high confidence (0.8-1.0) for explicit mentions, lower (0.5-0.7) for implicit references
5. Extract entity context (the sentence where it's mentioned)

OUTPUT FORMAT (JSON only):
{
  "entities": [
    {
      "name": "EntityName",
      "type": "class|function|api|library|framework|concept|pattern|technology|service|component|module|package|tool|other",
      "confidence": 0.9,
      "context": "The sentence where this entity is mentioned"
    }
  ],
  "relationships": [
    {
      "from": "EntityA",
      "to": "EntityB",
      "type": "uses|implements|extends|references|depends_on|mentions|describes|contains|part_of|related_to|configures|calls|instantiates",
      "confidence": 0.85,
      "context": "The sentence describing this relationship"
    }
  ]
}

EXAMPLES:
Input: "The UserService class uses JWT tokens for authentication with Express middleware."
Output:
{
  "entities": [
    {"name": "UserService", "type": "class", "confidence": 0.95, "context": "The UserService class uses JWT tokens"},
    {"name": "JWT", "type": "technology", "confidence": 0.9, "context": "uses JWT tokens for authentication"},
    {"name": "Express", "type": "framework", "confidence": 0.9, "context": "authentication with Express middleware"}
  ],
  "relationships": [
    {"from": "UserService", "to": "JWT", "type": "uses", "confidence": 0.9, "context": "uses JWT tokens for authentication"},
    {"from": "UserService", "to": "Express", "type": "uses", "confidence": 0.85, "context": "with Express middleware"}
  ]
}

Now analyze the following documentation chunk and extract entities and relationships:`;

/**
 * Entity extractor using GitHub Copilot LLM
 */
export class EntityExtractor {
  private model: vscode.LanguageModelChat | null = null;
  private modelName: string = 'unknown';

  /**
   * Initializes the entity extractor
   */
  async initialize(): Promise<void> {
    try {
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      });

      if (models.length === 0) {
        console.warn('⚠️ No Copilot models available for entity extraction');
        return;
      }

      this.model = models[0];
      this.modelName = `${this.model.vendor}/${this.model.family}`;
      console.log(`✅ EntityExtractor initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('❌ Failed to initialize EntityExtractor:', error);
    }
  }

  /**
   * Extracts entities and relationships from a document chunk
   */
  async extractFromChunk(chunk: DocumentChunk): Promise<EntityExtractionResult | null> {
    if (!this.model) {
      await this.initialize();
      if (!this.model) {
        console.warn('⚠️ EntityExtractor not available - skipping extraction');
        return null;
      }
    }

    const startTime = Date.now();

    try {
      // Prepare messages
      const messages = [
        vscode.LanguageModelChatMessage.User(ENTITY_EXTRACTION_PROMPT),
        vscode.LanguageModelChatMessage.User(
          `DOCUMENTATION CHUNK:\n${chunk.content}\n\nEXTRACT ENTITIES AND RELATIONSHIPS:`
        )
      ];

      // Call LLM
      const response = await this.model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      // Collect response
      let jsonResponse = '';
      for await (const fragment of response.text) {
        jsonResponse += fragment;
      }

      // Parse JSON response
      const extracted = this.parseResponse(jsonResponse);

      const processingTime = Date.now() - startTime;

      console.log(`✨ Extracted ${extracted.entities.length} entities and ${extracted.relationships.length} relationships from chunk ${chunk.id} (${processingTime}ms)`);

      return {
        entities: extracted.entities,
        relationships: extracted.relationships,
        chunkId: chunk.id,
        metadata: {
          timestamp: new Date().toISOString(),
          model: this.modelName,
          processingTime,
          tokenCount: jsonResponse.length // Approximate
        }
      };
    } catch (error) {
      console.error(`❌ Entity extraction failed for chunk ${chunk.id}:`, error);
      return null;
    }
  }

  /**
   * Extracts entities from multiple chunks in batch
   */
  async extractFromChunks(chunks: DocumentChunk[]): Promise<EntityExtractionResult[]> {
    const results: EntityExtractionResult[] = [];

    for (const chunk of chunks) {
      const result = await this.extractFromChunk(chunk);
      if (result) {
        results.push(result);
      }

      // Rate limiting - avoid overwhelming the LLM
      await this.delay(500);
    }

    return results;
  }

  /**
   * Parses LLM response and validates structure
   */
  private parseResponse(response: string): { entities: ExtractedEntity[]; relationships: EntityRelationship[] } {
    try {
      // Clean response - remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

      // Validate and normalize entities
      const entities: ExtractedEntity[] = (parsed.entities || []).map((e: unknown) => {
        const entity = e as Record<string, unknown>;
        return {
          name: String(entity.name || '').trim(),
          type: this.normalizeEntityType(entity.type as string),
          confidence: this.normalizeConfidence(entity.confidence),
          context: entity.context ? String(entity.context).trim() : undefined,
          metadata: (entity.metadata || {}) as Record<string, unknown>
        };
      }).filter((e: ExtractedEntity) => e.name.length > 0);

      // Validate and normalize relationships
      const relationships: EntityRelationship[] = (parsed.relationships || []).map((r: unknown) => {
        const rel = r as Record<string, unknown>;
        return {
          from: String(rel.from || '').trim(),
          to: String(rel.to || '').trim(),
          type: this.normalizeRelationshipType(rel.type as string),
          confidence: this.normalizeConfidence(rel.confidence),
          context: rel.context ? String(rel.context).trim() : undefined
        };
      }).filter((r: EntityRelationship) => r.from.length > 0 && r.to.length > 0);

      return { entities, relationships };
    } catch (error) {
      console.error('❌ Failed to parse LLM response:', error);
      console.error('Response was:', response.substring(0, 500));
      return { entities: [], relationships: [] };
    }
  }

  /**
   * Normalizes entity type
   */
  private normalizeEntityType(type: string): EntityType {
    const normalized = String(type || 'other').toLowerCase().trim();
    const validTypes: EntityType[] = [
      'class', 'function', 'interface', 'type', 'api', 'library', 'framework',
      'concept', 'pattern', 'technology', 'service', 'component', 'module',
      'package', 'tool', 'other'
    ];

    return validTypes.includes(normalized as EntityType) ? (normalized as EntityType) : 'other';
  }

  /**
   * Normalizes relationship type
   */
  private normalizeRelationshipType(type: string): RelationshipType {
    const normalized = String(type || 'related_to').toLowerCase().trim();
    const validTypes: RelationshipType[] = [
      'uses', 'implements', 'extends', 'references', 'depends_on', 'mentions',
      'describes', 'contains', 'part_of', 'related_to', 'configures', 'calls', 'instantiates'
    ];

    return validTypes.includes(normalized as RelationshipType) ? (normalized as RelationshipType) : 'related_to';
  }

  /**
   * Normalizes confidence score
   */
  private normalizeConfidence(confidence: unknown): number {
    const score = Number(confidence);
    if (isNaN(score)) return 0.5;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Delays execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets available models info
   */
  async getModelInfo(): Promise<string> {
    if (!this.model) {
      await this.initialize();
    }
    return this.modelName;
  }
}

/**
 * Factory function to create entity extractor
 */
export function createEntityExtractor(): EntityExtractor {
  return new EntityExtractor();
}
