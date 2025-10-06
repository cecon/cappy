import { Entity, Relationship, DocumentChunk } from '../../models/cappyragTypes';

/**
 * Quality scoring configuration
 */
export interface QualityConfig {
    entityWeights: {
        nameLength: number;
        descriptionLength: number;
        uniqueness: number;
        contextRelevance: number;
        crossDocumentFrequency: number;
    };
    relationshipWeights: {
        descriptionQuality: number;
        entityRelevance: number;
        typeSpecificity: number;
        bidirectionalConsistency: number;
        crossDocumentSupport: number;
    };
    chunkWeights: {
        contentLength: number;
        entityDensity: number;
        relationshipDensity: number;
        structuralIntegrity: number;
    };
    thresholds: {
        minEntityScore: number;
        minRelationshipScore: number;
        minChunkScore: number;
        excellentScore: number;
    };
}

/**
 * Quality analysis result
 */
export interface QualityAnalysis {
    score: number;
    confidence: number;
    factors: {
        [key: string]: {
            score: number;
            weight: number;
            contribution: number;
            details: string;
        };
    };
    recommendations: string[];
    category: 'poor' | 'fair' | 'good' | 'excellent';
}

/**
 * Batch quality analysis result
 */
export interface BatchQualityResult {
    averageScore: number;
    distribution: {
        poor: number;
        fair: number;
        good: number;
        excellent: number;
    };
    topEntities: Entity[];
    topRelationships: Relationship[];
    qualityTrends: {
        improvingEntities: Entity[];
        decliningEntities: Entity[];
    };
}

/**
 * Specialized service for quality scoring and analysis
 * Implements advanced algorithms for entity, relationship, and chunk quality assessment
 */
export class QualityService {
    private config: QualityConfig;

    constructor(config: Partial<QualityConfig> = {}) {
        this.config = {
            entityWeights: {
                nameLength: config.entityWeights?.nameLength ?? 0.15,
                descriptionLength: config.entityWeights?.descriptionLength ?? 0.25,
                uniqueness: config.entityWeights?.uniqueness ?? 0.20,
                contextRelevance: config.entityWeights?.contextRelevance ?? 0.25,
                crossDocumentFrequency: config.entityWeights?.crossDocumentFrequency ?? 0.15
            },
            relationshipWeights: {
                descriptionQuality: config.relationshipWeights?.descriptionQuality ?? 0.30,
                entityRelevance: config.relationshipWeights?.entityRelevance ?? 0.25,
                typeSpecificity: config.relationshipWeights?.typeSpecificity ?? 0.15,
                bidirectionalConsistency: config.relationshipWeights?.bidirectionalConsistency ?? 0.15,
                crossDocumentSupport: config.relationshipWeights?.crossDocumentSupport ?? 0.15
            },
            chunkWeights: {
                contentLength: config.chunkWeights?.contentLength ?? 0.20,
                entityDensity: config.chunkWeights?.entityDensity ?? 0.30,
                relationshipDensity: config.chunkWeights?.relationshipDensity ?? 0.25,
                structuralIntegrity: config.chunkWeights?.structuralIntegrity ?? 0.25
            },
            thresholds: {
                minEntityScore: config.thresholds?.minEntityScore ?? 0.3,
                minRelationshipScore: config.thresholds?.minRelationshipScore ?? 0.3,
                minChunkScore: config.thresholds?.minChunkScore ?? 0.4,
                excellentScore: config.thresholds?.excellentScore ?? 0.8
            }
        };
    }

    /**
     * Calculate entity quality score with detailed analysis
     */
    calculateEntityQuality(entity: Entity, context?: {
        allEntities?: Entity[];
        documentContext?: string;
        crossDocumentCount?: number;
    }): QualityAnalysis {
        const factors: QualityAnalysis['factors'] = {};
        
        // Factor 1: Name Length Quality
        const nameLengthScore = this.scoreNameLength(entity.name);
        factors.nameLength = {
            score: nameLengthScore,
            weight: this.config.entityWeights.nameLength,
            contribution: nameLengthScore * this.config.entityWeights.nameLength,
            details: `Name "${entity.name}" has ${entity.name.length} characters`
        };

        // Factor 2: Description Quality
        const descriptionScore = this.scoreDescriptionQuality(entity.description);
        factors.descriptionLength = {
            score: descriptionScore,
            weight: this.config.entityWeights.descriptionLength,
            contribution: descriptionScore * this.config.entityWeights.descriptionLength,
            details: `Description has ${entity.description.length} characters with quality indicators`
        };

        // Factor 3: Uniqueness
        const uniquenessScore = context?.allEntities 
            ? this.scoreEntityUniqueness(entity, context.allEntities)
            : 0.7; // Default if no context
        factors.uniqueness = {
            score: uniquenessScore,
            weight: this.config.entityWeights.uniqueness,
            contribution: uniquenessScore * this.config.entityWeights.uniqueness,
            details: `Entity uniqueness in dataset`
        };

        // Factor 4: Context Relevance
        const contextScore = context?.documentContext
            ? this.scoreContextRelevance(entity, context.documentContext)
            : 0.6; // Default if no context
        factors.contextRelevance = {
            score: contextScore,
            weight: this.config.entityWeights.contextRelevance,
            contribution: contextScore * this.config.entityWeights.contextRelevance,
            details: `Relevance to document context`
        };

        // Factor 5: Cross-Document Frequency
        const crossDocScore = context?.crossDocumentCount
            ? this.scoreCrossDocumentFrequency(context.crossDocumentCount)
            : 0.5; // Default if no context
        factors.crossDocumentFrequency = {
            score: crossDocScore,
            weight: this.config.entityWeights.crossDocumentFrequency,
            contribution: crossDocScore * this.config.entityWeights.crossDocumentFrequency,
            details: `Found in ${context?.crossDocumentCount || 0} documents`
        };

        // Calculate final score
        const totalScore = Object.values(factors).reduce((sum, factor) => sum + factor.contribution, 0);
        const confidence = this.calculateConfidence(factors);
        
        return {
            score: Math.max(0, Math.min(1, totalScore)),
            confidence,
            factors,
            recommendations: this.generateEntityRecommendations(entity, factors),
            category: this.categorizeScore(totalScore)
        };
    }

    /**
     * Calculate relationship quality score
     */
    calculateRelationshipQuality(relationship: Relationship, context?: {
        sourceEntity?: Entity;
        targetEntity?: Entity;
        allRelationships?: Relationship[];
        crossDocumentCount?: number;
    }): QualityAnalysis {
        const factors: QualityAnalysis['factors'] = {};

        // Factor 1: Description Quality
        const descriptionScore = this.scoreDescriptionQuality(relationship.description);
        factors.descriptionQuality = {
            score: descriptionScore,
            weight: this.config.relationshipWeights.descriptionQuality,
            contribution: descriptionScore * this.config.relationshipWeights.descriptionQuality,
            details: `Description quality and informativeness`
        };

        // Factor 2: Entity Relevance
        const entityRelevanceScore = context?.sourceEntity && context?.targetEntity
            ? this.scoreEntityRelevance(relationship, context.sourceEntity, context.targetEntity)
            : 0.6;
        factors.entityRelevance = {
            score: entityRelevanceScore,
            weight: this.config.relationshipWeights.entityRelevance,
            contribution: entityRelevanceScore * this.config.relationshipWeights.entityRelevance,
            details: `Relevance between connected entities`
        };

        // Factor 3: Type Specificity
        const typeScore = this.scoreRelationshipType(relationship.type);
        factors.typeSpecificity = {
            score: typeScore,
            weight: this.config.relationshipWeights.typeSpecificity,
            contribution: typeScore * this.config.relationshipWeights.typeSpecificity,
            details: `Specificity of relationship type "${relationship.type}"`
        };

        // Factor 4: Bidirectional Consistency
        const consistencyScore = context?.allRelationships
            ? this.scoreBidirectionalConsistency(relationship, context.allRelationships)
            : 0.7;
        factors.bidirectionalConsistency = {
            score: consistencyScore,
            weight: this.config.relationshipWeights.bidirectionalConsistency,
            contribution: consistencyScore * this.config.relationshipWeights.bidirectionalConsistency,
            details: `Consistency with reverse relationships`
        };

        // Factor 5: Cross-Document Support
        const crossDocScore = context?.crossDocumentCount
            ? this.scoreCrossDocumentFrequency(context.crossDocumentCount)
            : 0.5;
        factors.crossDocumentSupport = {
            score: crossDocScore,
            weight: this.config.relationshipWeights.crossDocumentSupport,
            contribution: crossDocScore * this.config.relationshipWeights.crossDocumentSupport,
            details: `Cross-document validation and support`
        };

        const totalScore = Object.values(factors).reduce((sum, factor) => sum + factor.contribution, 0);
        const confidence = this.calculateConfidence(factors);

        return {
            score: Math.max(0, Math.min(1, totalScore)),
            confidence,
            factors,
            recommendations: this.generateRelationshipRecommendations(relationship, factors),
            category: this.categorizeScore(totalScore)
        };
    }

    /**
     * Calculate chunk quality score
     */
    calculateChunkQuality(chunk: DocumentChunk, context?: {
        allChunks?: DocumentChunk[];
        expectedLength?: number;
    }): QualityAnalysis {
        const factors: QualityAnalysis['factors'] = {};

        // Factor 1: Content Length
        const lengthScore = this.scoreContentLength(chunk.text, context?.expectedLength);
        factors.contentLength = {
            score: lengthScore,
            weight: this.config.chunkWeights.contentLength,
            contribution: lengthScore * this.config.chunkWeights.contentLength,
            details: `Content length optimization (${chunk.text.length} chars)`
        };

        // Factor 2: Entity Density
        const entityDensityScore = this.scoreEntityDensity(chunk);
        factors.entityDensity = {
            score: entityDensityScore,
            weight: this.config.chunkWeights.entityDensity,
            contribution: entityDensityScore * this.config.chunkWeights.entityDensity,
            details: `Entity extraction potential and density`
        };

        // Factor 3: Relationship Density
        const relationshipDensityScore = this.scoreRelationshipDensity(chunk);
        factors.relationshipDensity = {
            score: relationshipDensityScore,
            weight: this.config.chunkWeights.relationshipDensity,
            contribution: relationshipDensityScore * this.config.chunkWeights.relationshipDensity,
            details: `Relationship extraction potential`
        };

        // Factor 4: Structural Integrity
        const structuralScore = this.scoreStructuralIntegrity(chunk.text);
        factors.structuralIntegrity = {
            score: structuralScore,
            weight: this.config.chunkWeights.structuralIntegrity,
            contribution: structuralScore * this.config.chunkWeights.structuralIntegrity,
            details: `Text coherence and structural completeness`
        };

        const totalScore = Object.values(factors).reduce((sum, factor) => sum + factor.contribution, 0);
        const confidence = this.calculateConfidence(factors);

        return {
            score: Math.max(0, Math.min(1, totalScore)),
            confidence,
            factors,
            recommendations: this.generateChunkRecommendations(chunk, factors),
            category: this.categorizeScore(totalScore)
        };
    }

    /**
     * Batch analyze entities for quality trends
     */
    analyzeBatchQuality(entities: Entity[], relationships: Relationship[]): BatchQualityResult {
        const entityAnalyses = entities.map(e => this.calculateEntityQuality(e, { allEntities: entities }));
        const relationshipAnalyses = relationships.map(r => this.calculateRelationshipQuality(r, { allRelationships: relationships }));
        
        const allScores = [...entityAnalyses, ...relationshipAnalyses].map(a => a.score);
        const averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

        const distribution = {
            poor: allScores.filter(s => s < 0.4).length,
            fair: allScores.filter(s => s >= 0.4 && s < 0.6).length,
            good: allScores.filter(s => s >= 0.6 && s < 0.8).length,
            excellent: allScores.filter(s => s >= 0.8).length
        };

        // Get top entities and relationships
        const entitiesWithScores = entities.map((entity, i) => ({ entity, analysis: entityAnalyses[i] }));
        const relationshipsWithScores = relationships.map((rel, i) => ({ relationship: rel, analysis: relationshipAnalyses[i] }));

        const topEntities = entitiesWithScores
            .sort((a, b) => b.analysis.score - a.analysis.score)
            .slice(0, 10)
            .map(item => item.entity);

        const topRelationships = relationshipsWithScores
            .sort((a, b) => b.analysis.score - a.analysis.score)
            .slice(0, 10)
            .map(item => item.relationship);

        return {
            averageScore,
            distribution,
            topEntities,
            topRelationships,
            qualityTrends: {
                improvingEntities: [], // Would need historical data
                decliningEntities: []  // Would need historical data
            }
        };
    }

    /**
     * Score entity name length
     */
    private scoreNameLength(name: string): number {
        const length = name.trim().length;
        if (length < 2) { return 0.1; }
        if (length < 4) { return 0.4; }
        if (length <= 50) { return 1.0; }
        if (length <= 100) { return 0.8; }
        return 0.6; // Very long names get lower scores
    }

    /**
     * Score description quality
     */
    private scoreDescriptionQuality(description: string): number {
        const length = description.trim().length;
        if (length < 10) { return 0.2; }
        if (length < 20) { return 0.5; }
        if (length <= 200) { return 1.0; }
        if (length <= 500) { return 0.9; }
        return 0.7; // Very long descriptions get slightly lower scores
    }

    /**
     * Score entity uniqueness
     */
    private scoreEntityUniqueness(entity: Entity, allEntities: Entity[]): number {
        const similarNames = allEntities.filter(e => 
            e.id !== entity.id && 
            this.calculateSimilarity(e.name.toLowerCase(), entity.name.toLowerCase()) > 0.8
        ).length;
        
        if (similarNames === 0) { return 1.0; }
        if (similarNames === 1) { return 0.8; }
        if (similarNames <= 3) { return 0.6; }
        return 0.3;
    }

    /**
     * Score context relevance
     */
    private scoreContextRelevance(entity: Entity, documentContext: string): number {
        const entityWords = entity.name.toLowerCase().split(/\s+/);
        const contextWords = documentContext.toLowerCase().split(/\s+/);
        
        const matches = entityWords.filter(word => 
            contextWords.some(contextWord => 
                contextWord.includes(word) || word.includes(contextWord)
            )
        ).length;
        
        return Math.min(1.0, matches / entityWords.length);
    }

    /**
     * Score cross-document frequency
     */
    private scoreCrossDocumentFrequency(count: number): number {
        if (count === 0) { return 0.3; }
        if (count === 1) { return 0.5; }
        if (count <= 3) { return 0.8; }
        if (count <= 10) { return 1.0; }
        return 0.9; // Very frequent entities get slightly lower scores
    }

    /**
     * Score relationship type specificity
     */
    private scoreRelationshipType(type: string): number {
        const genericTypes = ['related', 'connected', 'associated', 'linked'];
        const specificTypes = ['works_for', 'part_of', 'implements', 'extends', 'uses'];
        
        const lowerType = type.toLowerCase();
        
        if (specificTypes.includes(lowerType)) { return 1.0; }
        if (genericTypes.includes(lowerType)) { return 0.4; }
        
        // Score based on specificity indicators
        if (lowerType.includes('_') || lowerType.includes(' ')) { return 0.8; }
        return 0.6;
    }

    /**
     * Score entity relevance in relationship
     */
    private scoreEntityRelevance(relationship: Relationship, sourceEntity: Entity, targetEntity: Entity): number {
        // Check if relationship type makes sense for the entity types
        const typeCompatibility = this.assessTypeCompatibility(relationship.type, sourceEntity.type, targetEntity.type);
        return typeCompatibility;
    }

    /**
     * Score bidirectional consistency
     */
    private scoreBidirectionalConsistency(relationship: Relationship, allRelationships: Relationship[]): number {
        if (!relationship.bidirectional) { return 0.8; } // Unidirectional is fine
        
        // Look for reverse relationship
        const reverse = allRelationships.find(r => 
            r.source === relationship.target && 
            r.target === relationship.source &&
            r.type === relationship.type
        );
        
        return reverse ? 1.0 : 0.5;
    }

    /**
     * Score content length optimization
     */
    private scoreContentLength(text: string, expectedLength?: number): number {
        const length = text.length;
        const target = expectedLength || 4000;
        
        if (length < target * 0.1) { return 0.2; } // Too short
        if (length < target * 0.3) { return 0.6; }
        if (length <= target) { return 1.0; }
        if (length <= target * 1.5) { return 0.8; }
        return 0.5; // Too long
    }

    /**
     * Score entity density in chunk
     */
    private scoreEntityDensity(chunk: DocumentChunk): number {
        const entityCount = chunk.entities.length;
        const textLength = chunk.text.length;
        
        if (textLength === 0) { return 0; }
        
        const density = entityCount / (textLength / 1000); // Entities per 1000 chars
        
        if (density < 0.5) { return 0.3; }
        if (density <= 2) { return 1.0; }
        if (density <= 5) { return 0.8; }
        return 0.5; // Too dense
    }

    /**
     * Score relationship density in chunk
     */
    private scoreRelationshipDensity(chunk: DocumentChunk): number {
        const relationshipCount = chunk.relationships.length;
        const entityCount = chunk.entities.length;
        
        if (entityCount === 0) { return relationshipCount === 0 ? 0.7 : 0.3; }
        
        const ratio = relationshipCount / entityCount;
        
        if (ratio < 0.1) { return 0.4; }
        if (ratio <= 0.5) { return 1.0; }
        if (ratio <= 1.0) { return 0.9; }
        return 0.6; // Too many relationships
    }

    /**
     * Score structural integrity
     */
    private scoreStructuralIntegrity(text: string): number {
        let score = 0.5; // Base score
        
        // Check for complete sentences
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 0) score += 0.2;
        
        // Check for proper capitalization
        if (/^[A-Z]/.test(text.trim())) score += 0.1;
        
        // Check for balanced structure (no truncated words at start/end)
        if (!/^\s*[a-z]/.test(text) && !/[a-z]\s*$/.test(text)) score += 0.2;
        
        return Math.min(1.0, score);
    }

    /**
     * Calculate confidence based on factor consistency
     */
    private calculateConfidence(factors: QualityAnalysis['factors']): number {
        const scores = Object.values(factors).map(f => f.score);
        const variance = this.calculateVariance(scores);
        
        // Higher variance = lower confidence
        return Math.max(0.1, 1 - variance);
    }

    /**
     * Calculate similarity between two strings
     */
    private calculateSimilarity(a: string, b: string): number {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     */
    private levenshteinDistance(a: string, b: string): number {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        
        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[b.length][a.length];
    }

    /**
     * Calculate variance of an array of numbers
     */
    private calculateVariance(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        
        const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
        const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
    }

    /**
     * Assess type compatibility for relationships
     */
    private assessTypeCompatibility(relType: string, sourceType: string, targetType: string): number {
        // This would contain domain-specific logic
        // For now, return a reasonable default
        return 0.7;
    }

    /**
     * Generate recommendations for entity improvement
     */
    private generateEntityRecommendations(entity: Entity, factors: QualityAnalysis['factors']): string[] {
        const recommendations: string[] = [];
        
        if (factors.nameLength.score < 0.5) {
            recommendations.push('Consider using a more descriptive name');
        }
        
        if (factors.descriptionLength.score < 0.5) {
            recommendations.push('Add more detailed description');
        }
        
        if (factors.uniqueness.score < 0.5) {
            recommendations.push('Check for potential duplicates or merge candidates');
        }
        
        return recommendations;
    }

    /**
     * Generate recommendations for relationship improvement
     */
    private generateRelationshipRecommendations(relationship: Relationship, factors: QualityAnalysis['factors']): string[] {
        const recommendations: string[] = [];
        
        if (factors.descriptionQuality.score < 0.5) {
            recommendations.push('Improve relationship description clarity');
        }
        
        if (factors.typeSpecificity.score < 0.5) {
            recommendations.push('Use more specific relationship type');
        }
        
        return recommendations;
    }

    /**
     * Generate recommendations for chunk improvement
     */
    private generateChunkRecommendations(chunk: DocumentChunk, factors: QualityAnalysis['factors']): string[] {
        const recommendations: string[] = [];
        
        if (factors.contentLength.score < 0.5) {
            recommendations.push('Optimize chunk size for better processing');
        }
        
        if (factors.structuralIntegrity.score < 0.5) {
            recommendations.push('Improve text coherence and completeness');
        }
        
        return recommendations;
    }

    /**
     * Categorize score into quality levels
     */
    private categorizeScore(score: number): 'poor' | 'fair' | 'good' | 'excellent' {
        if (score < 0.4) return 'poor';
        if (score < 0.6) return 'fair';
        if (score < 0.8) return 'good';
        return 'excellent';
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<QualityConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): QualityConfig {
        return { ...this.config };
    }
}