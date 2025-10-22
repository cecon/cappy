import * as vscode from 'vscode';
import type {
  ExtractedEntity,
  EntityRelationship,
  EntityExtractionResult,
  EntityType,
  RelationshipType
} from '../../../types/entity';
import type { DocumentChunk } from '../../../types/chunk';
import { ENTITY_EXTRACTION_PROMPT } from '../prompts';

/**
 * Entity extractor using GitHub Copilot LLM
 */
export class EntityExtractor {
  private model: vscode.LanguageModelChat | null = null;
  private modelName: string = 'unknown';

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
      const messages = [
        vscode.LanguageModelChatMessage.User(ENTITY_EXTRACTION_PROMPT),
        vscode.LanguageModelChatMessage.User(
          `DOCUMENTATION CHUNK:\n${chunk.content}\n\nEXTRACT ENTITIES AND RELATIONSHIPS:`
        )
      ];

      const response = await this.model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

      let jsonResponse = '';
      for await (const fragment of response.text) {
        jsonResponse += fragment;
      }

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
          tokenCount: jsonResponse.length
        }
      };
    } catch (error) {
      console.error(`❌ Entity extraction failed for chunk ${chunk.id}:`, error);
      return null;
    }
  }

  async extractFromChunks(chunks: DocumentChunk[]): Promise<EntityExtractionResult[]> {
    const results: EntityExtractionResult[] = [];

    for (const chunk of chunks) {
      const result = await this.extractFromChunk(chunk);
      if (result) {
        results.push(result);
      }
      await this.delay(500);
    }

    return results;
  }

  private parseResponse(response: string): { entities: ExtractedEntity[]; relationships: EntityRelationship[] } {
    try {
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleaned);

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

  private normalizeEntityType(type: string): EntityType {
    const normalized = String(type || 'other').toLowerCase().trim();
    const validTypes: EntityType[] = [
      'class', 'function', 'interface', 'type', 'api', 'library', 'framework',
      'concept', 'pattern', 'technology', 'service', 'component', 'module',
      'package', 'tool', 'other'
    ];

    return validTypes.includes(normalized as EntityType) ? (normalized as EntityType) : 'other';
  }

  private normalizeRelationshipType(type: string): RelationshipType {
    const normalized = String(type || 'related_to').toLowerCase().trim();
    const validTypes: RelationshipType[] = [
      'uses', 'implements', 'extends', 'references', 'depends_on', 'mentions',
      'describes', 'contains', 'part_of', 'related_to', 'configures', 'calls', 'instantiates'
    ];

    return validTypes.includes(normalized as RelationshipType) ? (normalized as RelationshipType) : 'related_to';
  }

  private normalizeConfidence(confidence: unknown): number {
    const score = Number(confidence);
    if (isNaN(score)) return 0.5;
    return Math.max(0, Math.min(1, score));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getModelInfo(): Promise<string> {
    if (!this.model) {
      await this.initialize();
    }
    return this.modelName;
  }
}
