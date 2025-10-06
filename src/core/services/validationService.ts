import { 
    Document, 
    DocumentMetadata, 
    ProcessingOptions, 
    Entity, 
    Relationship
} from '../../models/cappyragTypes';

/**
 * Simple validation service focused on essential checks
 * Uses existing type system without conflicts
 */
export class ValidationService {
    private config = {
        maxDocumentSize: 10 * 1024 * 1024, // 10MB
        maxChunkSize: 8000,
        maxEntities: 1000,
        maxRelationships: 2000,
        minEntityNameLength: 2,
        maxEntityNameLength: 200
    };

    /**
     * Validate document basic requirements
     */
    validateDocument(document: Document): { isValid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check document size
        if (document.content.length > this.config.maxDocumentSize) {
            errors.push(`Document size ${document.content.length} exceeds maximum ${this.config.maxDocumentSize}`);
        }

        // Check content
        if (!document.content || document.content.trim().length === 0) {
            errors.push('Document content cannot be empty');
        }

        // Check for binary data
        if (this.containsBinaryData(document.content)) {
            errors.push('Document appears to contain binary data');
        }

        // Check metadata
        if (!document.metadata.title || document.metadata.title.trim().length === 0) {
            errors.push('Document must have a title');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate processing options
     */
    validateProcessingOptions(options: ProcessingOptions): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check chunk size
        if (options.maxChunkSize && options.maxChunkSize > this.config.maxChunkSize) {
            errors.push(`Chunk size ${options.maxChunkSize} exceeds maximum ${this.config.maxChunkSize}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate entities
     */
    validateEntities(entities: Entity[]): { isValid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (entities.length > this.config.maxEntities) {
            errors.push(`Entity count ${entities.length} exceeds maximum ${this.config.maxEntities}`);
        }

        const uniqueIds = new Set<string>();
        const uniqueNames = new Set<string>();

        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];

            // Check for duplicate IDs
            if (uniqueIds.has(entity.id)) {
                errors.push(`Duplicate entity ID: ${entity.id}`);
            } else {
                uniqueIds.add(entity.id);
            }

            // Check for similar names
            if (uniqueNames.has(entity.name.toLowerCase())) {
                warnings.push(`Potential duplicate entity name: ${entity.name}`);
            } else {
                uniqueNames.add(entity.name.toLowerCase());
            }

            // Validate name length
            if (entity.name.length < this.config.minEntityNameLength) {
                warnings.push(`Entity name '${entity.name}' is very short`);
            }

            if (entity.name.length > this.config.maxEntityNameLength) {
                errors.push(`Entity name '${entity.name}' exceeds maximum length`);
            }

            // Validate confidence score
            if (entity.confidence < 0 || entity.confidence > 1) {
                errors.push(`Invalid confidence score ${entity.confidence} for entity '${entity.name}'`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate relationships
     */
    validateRelationships(relationships: Relationship[], entities: Entity[]): { isValid: boolean; errors: string[]; warnings: string[] } {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (relationships.length > this.config.maxRelationships) {
            errors.push(`Relationship count ${relationships.length} exceeds maximum ${this.config.maxRelationships}`);
        }

        const entityIds = new Set(entities.map(e => e.id));
        const uniqueRelationships = new Set<string>();

        for (const relationship of relationships) {
            // Check if source and target entities exist  
            if (!entityIds.has(relationship.source)) {
                errors.push(`Source entity ${relationship.source} not found`);
            }

            if (!entityIds.has(relationship.target)) {
                errors.push(`Target entity ${relationship.target} not found`);
            }

            // Check for self-references
            if (relationship.source === relationship.target) {
                warnings.push(`Self-referencing relationship detected: ${relationship.type}`);
            }

            // Check for duplicate relationships
            const relationshipKey = `${relationship.source}-${relationship.type}-${relationship.target}`;
            if (uniqueRelationships.has(relationshipKey)) {
                warnings.push(`Duplicate relationship: ${relationship.type} between same entities`);
            } else {
                uniqueRelationships.add(relationshipKey);
            }

            // Validate confidence score
            if (relationship.confidence < 0 || relationship.confidence > 1) {
                errors.push(`Invalid confidence score ${relationship.confidence}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Sanitize text content
     */
    sanitizeText(text: string): string {
        let sanitized = text;

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        // Normalize line endings
        sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Trim excessive whitespace
        sanitized = sanitized.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

        return sanitized.trim();
    }

    /**
     * Sanitize document
     */
    sanitizeDocument(document: Document): Document {
        return {
            ...document,
            content: this.sanitizeText(document.content),
            metadata: {
                ...document.metadata,
                title: document.metadata.title ? this.sanitizeText(document.metadata.title) : ''
            }
        };
    }

    /**
     * Check if content contains binary data
     */
    private containsBinaryData(content: string): boolean {
        // Simple heuristic: check for null bytes or high ratio of non-printable characters
        const nullBytes = (content.match(/\0/g) || []).length;
        if (nullBytes > 0) {
            return true;
        }

        const nonPrintable = content.replace(/[\x20-\x7E\s]/g, '').length;
        const ratio = nonPrintable / content.length;
        
        return ratio > 0.3; // More than 30% non-printable characters
    }
}