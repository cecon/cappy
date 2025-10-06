import { DocumentChunk, Document } from '../../models/cappyragTypes';

/**
 * Chunking strategy configuration
 */
export interface ChunkingConfig {
    maxChunkSize: number;
    chunkOverlap: number;
    preserveCodeBlocks: boolean;
    preserveMarkdown: boolean;
    respectSentenceBoundaries: boolean;
    minChunkSize: number;
}

/**
 * Chunking result with metadata
 */
export interface ChunkingResult {
    chunks: DocumentChunk[];
    metadata: {
        totalChunks: number;
        averageChunkSize: number;
        largestChunk: number;
        smallestChunk: number;
        overlapCount: number;
    };
    warnings: string[];
}

/**
 * Specialized service for intelligent document chunking
 * Handles various content types and preserves structure
 */
export class ChunkService {
    private config: ChunkingConfig;

    constructor(config: Partial<ChunkingConfig> = {}) {
        this.config = {
            maxChunkSize: config.maxChunkSize ?? 8000,
            chunkOverlap: config.chunkOverlap ?? 200,
            preserveCodeBlocks: config.preserveCodeBlocks ?? true,
            preserveMarkdown: config.preserveMarkdown ?? true,
            respectSentenceBoundaries: config.respectSentenceBoundaries ?? true,
            minChunkSize: config.minChunkSize ?? 100
        };
    }

    /**
     * Main chunking method - automatically detects content type
     */
    chunkDocument(document: Document): ChunkingResult {
        const contentType = this.detectContentType(document);
        const warnings: string[] = [];

        let chunks: DocumentChunk[];

        switch (contentType) {
            case 'markdown':
                chunks = this.chunkMarkdown(document);
                break;
            case 'code':
                chunks = this.chunkCode(document);
                break;
            case 'json':
                chunks = this.chunkJSON(document);
                break;
            case 'xml':
                chunks = this.chunkXML(document);
                break;
            default:
                chunks = this.chunkPlainText(document);
        }

        // Filter out chunks that are too small
        const filteredChunks = chunks.filter(chunk => {
            if (chunk.text.length < this.config.minChunkSize) {
                warnings.push(`Chunk ${chunk.id} is smaller than minimum size and was filtered out`);
                return false;
            }
            return true;
        });

        // Calculate metadata
        const sizes = filteredChunks.map(c => c.text.length);
        const metadata = {
            totalChunks: filteredChunks.length,
            averageChunkSize: sizes.length ? Math.round(sizes.reduce((a, b) => a + b) / sizes.length) : 0,
            largestChunk: sizes.length ? Math.max(...sizes) : 0,
            smallestChunk: sizes.length ? Math.min(...sizes) : 0,
            overlapCount: this.countOverlaps(filteredChunks)
        };

        return {
            chunks: filteredChunks,
            metadata,
            warnings
        };
    }

    /**
     * Detect document content type
     */
    private detectContentType(document: Document): 'markdown' | 'code' | 'json' | 'xml' | 'plain' {
        const content = document.content.trim();
        const extension = this.getFileExtension(document.metadata.title);

        // Check file extension first
        if (['.md', '.markdown'].includes(extension)) {
            return 'markdown';
        }
        
        if (['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.css', '.sql'].includes(extension)) {
            return 'code';
        }

        if (extension === '.json') {
            return 'json';
        }

        if (['.xml', '.html', '.xhtml'].includes(extension)) {
            return 'xml';
        }

        // Check content patterns
        if (content.startsWith('{') || content.startsWith('[')) {
            try {
                JSON.parse(content);
                return 'json';
            } catch {
                // Not valid JSON
            }
        }

        if (content.startsWith('<') && content.includes('>')) {
            return 'xml';
        }

        // Check for markdown patterns
        if (this.hasMarkdownPatterns(content)) {
            return 'markdown';
        }

        // Check for code patterns
        if (this.hasCodePatterns(content)) {
            return 'code';
        }

        return 'plain';
    }

    /**
     * Chunk markdown content preserving structure
     */
    private chunkMarkdown(document: Document): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        const lines = document.content.split('\n');
        let currentChunk = '';
        let currentHeading = '';
        let chunkIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect headings
            if (line.match(/^#{1,6}\s/)) {
                // If we have content, save current chunk
                if (currentChunk.trim()) {
                    chunks.push(this.createChunk(
                        document,
                        currentChunk.trim(),
                        chunkIndex++,
                        currentHeading
                    ));
                }
                
                currentHeading = line;
                currentChunk = line + '\n';
            } else {
                currentChunk += line + '\n';
                
                // Check if chunk is getting too large
                if (currentChunk.length > this.config.maxChunkSize) {
                    // Try to find a good break point
                    const breakPoint = this.findMarkdownBreakPoint(currentChunk);
                    
                    if (breakPoint > 0) {
                        const chunkContent = currentChunk.substring(0, breakPoint);
                        chunks.push(this.createChunk(
                            document,
                            chunkContent.trim(),
                            chunkIndex++,
                            currentHeading
                        ));
                        
                        // Start new chunk with overlap
                        const overlap = this.createOverlap(chunkContent);
                        currentChunk = overlap + currentChunk.substring(breakPoint);
                    }
                }
            }
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push(this.createChunk(
                document,
                currentChunk.trim(),
                chunkIndex,
                currentHeading
            ));
        }

        return chunks;
    }

    /**
     * Chunk code content preserving functions and classes
     */
    private chunkCode(document: Document): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        const content = document.content;
        
        // Try to detect functions, classes, and other code blocks
        const codeBlocks = this.findCodeBlocks(content);
        
        if (codeBlocks.length > 0) {
            // Use structure-aware chunking
            return this.chunkByCodeBlocks(document, codeBlocks);
        } else {
            // Fall back to line-based chunking
            return this.chunkByLines(document);
        }
    }

    /**
     * Chunk JSON content preserving structure
     */
    private chunkJSON(document: Document): DocumentChunk[] {
        try {
            const parsed = JSON.parse(document.content);
            
            if (Array.isArray(parsed)) {
                return this.chunkJSONArray(document, parsed);
            } else {
                return this.chunkJSONObject(document, parsed);
            }
        } catch {
            // If parsing fails, treat as plain text
            return this.chunkPlainText(document);
        }
    }

    /**
     * Chunk XML/HTML content preserving structure
     */
    private chunkXML(document: Document): DocumentChunk[] {
        // Simple XML chunking based on top-level elements
        const chunks: DocumentChunk[] = [];
        const content = document.content;
        
        // Find top-level elements
        const elementRegex = /<(\w+)[^>]*>[\s\S]*?<\/\1>/g;
        let match: RegExpExecArray | null;
        let lastIndex = 0;
        let chunkIndex = 0;

        while ((match = elementRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                // Add content between elements
                const betweenContent = content.substring(lastIndex, match.index).trim();
                if (betweenContent) {
                    chunks.push(this.createChunk(
                        document,
                        betweenContent,
                        chunkIndex++,
                        'XML Fragment'
                    ));
                }
            }

            // Add the element itself
            const elementContent = match[0];
            if (elementContent.length <= this.config.maxChunkSize) {
                chunks.push(this.createChunk(
                    document,
                    elementContent,
                    chunkIndex++,
                    `<${match[1]}> Element`
                ));
            } else {
                // Element is too large, chunk it further
                const subChunks = this.chunkLargeText(elementContent);
                const elementName = match[1] || 'Unknown';
                subChunks.forEach(subChunk => {
                    chunks.push(this.createChunk(
                        document,
                        subChunk,
                        chunkIndex++,
                        `<${elementName}> Element (Part)`
                    ));
                });
            }

            lastIndex = elementRegex.lastIndex;
        }

        // Add remaining content
        if (lastIndex < content.length) {
            const remaining = content.substring(lastIndex).trim();
            if (remaining) {
                chunks.push(this.createChunk(
                    document,
                    remaining,
                    chunkIndex,
                    'XML Fragment'
                ));
            }
        }

        return chunks.length > 0 ? chunks : this.chunkPlainText(document);
    }

    /**
     * Chunk plain text respecting sentence boundaries
     */
    private chunkPlainText(document: Document): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        const sentences = this.config.respectSentenceBoundaries 
            ? this.splitIntoSentences(document.content)
            : document.content.split('\n');
        
        let currentChunk = '';
        let chunkIndex = 0;

        for (const sentence of sentences) {
            const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
            
            if (potentialChunk.length > this.config.maxChunkSize && currentChunk) {
                // Save current chunk
                chunks.push(this.createChunk(
                    document,
                    currentChunk.trim(),
                    chunkIndex++
                ));
                
                // Start new chunk with overlap
                const overlap = this.createOverlap(currentChunk);
                currentChunk = overlap + sentence;
            } else {
                currentChunk = potentialChunk;
            }
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push(this.createChunk(
                document,
                currentChunk.trim(),
                chunkIndex
            ));
        }

        return chunks;
    }

    /**
     * Create a document chunk with metadata
     */
    private createChunk(
        document: Document, 
        content: string, 
        index: number, 
        heading?: string
    ): DocumentChunk {
        return {
            id: `${document.id}_chunk_${index}`,
            documentId: document.id,
            text: content,
            startChar: 0, // Would need more sophisticated tracking
            endChar: content.length,
            entities: [],
            relationships: [],
            processingStatus: 'pending'
        };
    }

    /**
     * Find appropriate break points in markdown
     */
    private findMarkdownBreakPoint(content: string): number {
        const lines = content.split('\n');
        let bestBreak = 0;
        let currentLength = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1; // +1 for newline
            
            if (currentLength + lineLength > this.config.maxChunkSize - this.config.chunkOverlap) {
                break;
            }
            
            currentLength += lineLength;
            
            // Prefer breaks after paragraphs, headings, or list items
            if (lines[i].trim() === '' || 
                lines[i].match(/^#{1,6}\s/) || 
                lines[i].match(/^[-*+]\s/) ||
                lines[i].match(/^\d+\.\s/)) {
                bestBreak = currentLength;
            }
        }
        
        return bestBreak || Math.min(content.length, this.config.maxChunkSize - this.config.chunkOverlap);
    }

    /**
     * Create overlap text from the end of a chunk
     */
    private createOverlap(content: string): string {
        if (content.length <= this.config.chunkOverlap) {
            return content;
        }
        
        const overlapText = content.substring(content.length - this.config.chunkOverlap);
        
        // Try to start at a word boundary
        const firstSpace = overlapText.indexOf(' ');
        if (firstSpace > 0 && firstSpace < this.config.chunkOverlap / 2) {
            return overlapText.substring(firstSpace + 1);
        }
        
        return overlapText;
    }

    /**
     * Detect markdown patterns
     */
    private hasMarkdownPatterns(content: string): boolean {
        const patterns = [
            /^#{1,6}\s/m,     // Headers
            /\*\*.*\*\*/,     // Bold
            /\*.*\*/,         // Italic
            /\[.*\]\(.*\)/,   // Links
            /^[-*+]\s/m,      // Lists
            /^>\s/m,          // Blockquotes
            /```[\s\S]*```/   // Code blocks
        ];
        
        return patterns.some(pattern => pattern.test(content));
    }

    /**
     * Detect code patterns
     */
    private hasCodePatterns(content: string): boolean {
        const patterns = [
            /function\s+\w+\s*\(/,        // Function definitions
            /class\s+\w+/,                // Class definitions
            /import\s+.*from/,            // Import statements
            /def\s+\w+\s*\(/,            // Python functions
            /public\s+class\s+\w+/,       // Java classes
            /\{[\s\S]*\}/,               // Code blocks
            /;[\s]*$/m                    // Semicolon endings
        ];
        
        return patterns.some(pattern => pattern.test(content));
    }

    /**
     * Split text into sentences
     */
    private splitIntoSentences(text: string): string[] {
        // Simple sentence splitting - could be enhanced
        return text.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
    }

    /**
     * Find code blocks in content
     */
    private findCodeBlocks(content: string): Array<{start: number, end: number, type: string}> {
        const blocks: Array<{start: number, end: number, type: string}> = [];
        
        // This is a simplified implementation
        // In practice, you'd want more sophisticated parsing
        const functionRegex = /function\s+\w+\s*\([^)]*\)\s*\{[^}]*\}/g;
        let match;
        
        while ((match = functionRegex.exec(content)) !== null) {
            blocks.push({
                start: match.index,
                end: match.index + match[0].length,
                type: 'function'
            });
        }
        
        return blocks;
    }

    /**
     * Chunk by code blocks
     */
    private chunkByCodeBlocks(document: Document, blocks: Array<{start: number, end: number, type: string}>): DocumentChunk[] {
        // Simplified implementation - would need more sophisticated logic
        return this.chunkByLines(document);
    }

    /**
     * Chunk by lines
     */
    private chunkByLines(document: Document): DocumentChunk[] {
        const lines = document.content.split('\n');
        const chunks: DocumentChunk[] = [];
        let currentChunk = '';
        let chunkIndex = 0;

        for (const line of lines) {
            const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line;
            
            if (potentialChunk.length > this.config.maxChunkSize && currentChunk) {
                chunks.push(this.createChunk(
                    document,
                    currentChunk,
                    chunkIndex++
                ));
                currentChunk = line;
            } else {
                currentChunk = potentialChunk;
            }
        }

        if (currentChunk.trim()) {
            chunks.push(this.createChunk(
                document,
                currentChunk,
                chunkIndex
            ));
        }

        return chunks;
    }

    /**
     * Chunk JSON array
     */
    private chunkJSONArray(document: Document, array: any[]): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        let currentItems: any[] = [];
        let chunkIndex = 0;

        for (const item of array) {
            const testChunk = [...currentItems, item];
            const testContent = JSON.stringify(testChunk, null, 2);
            
            if (testContent.length > this.config.maxChunkSize && currentItems.length > 0) {
                // Save current chunk
                const chunkContent = JSON.stringify(currentItems, null, 2);
                chunks.push(this.createChunk(document, chunkContent, chunkIndex++, 'JSON Array'));
                currentItems = [item];
            } else {
                currentItems = testChunk;
            }
        }

        if (currentItems.length > 0) {
            const chunkContent = JSON.stringify(currentItems, null, 2);
            chunks.push(this.createChunk(document, chunkContent, chunkIndex, 'JSON Array'));
        }

        return chunks;
    }

    /**
     * Chunk JSON object
     */
    private chunkJSONObject(document: Document, obj: any): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];
        const keys = Object.keys(obj);
        let currentObj: any = {};
        let chunkIndex = 0;

        for (const key of keys) {
            const testObj = { ...currentObj, [key]: obj[key] };
            const testContent = JSON.stringify(testObj, null, 2);
            
            if (testContent.length > this.config.maxChunkSize && Object.keys(currentObj).length > 0) {
                // Save current chunk
                const chunkContent = JSON.stringify(currentObj, null, 2);
                chunks.push(this.createChunk(document, chunkContent, chunkIndex++, 'JSON Object'));
                currentObj = { [key]: obj[key] };
            } else {
                currentObj = testObj;
            }
        }

        if (Object.keys(currentObj).length > 0) {
            const chunkContent = JSON.stringify(currentObj, null, 2);
            chunks.push(this.createChunk(document, chunkContent, chunkIndex, 'JSON Object'));
        }

        return chunks;
    }

    /**
     * Chunk large text into smaller pieces
     */
    private chunkLargeText(text: string): string[] {
        const chunks: string[] = [];
        let start = 0;
        
        while (start < text.length) {
            const end = Math.min(start + this.config.maxChunkSize, text.length);
            let chunkEnd = end;
            
            // Try to break at word boundary
            if (end < text.length) {
                const lastSpace = text.lastIndexOf(' ', end);
                if (lastSpace > start + this.config.maxChunkSize / 2) {
                    chunkEnd = lastSpace;
                }
            }
            
            chunks.push(text.substring(start, chunkEnd));
            start = chunkEnd - this.config.chunkOverlap;
        }
        
        return chunks;
    }

    /**
     * Get file extension from title
     */
    private getFileExtension(title: string): string {
        const lastDot = title.lastIndexOf('.');
        return lastDot >= 0 ? title.substring(lastDot).toLowerCase() : '';
    }

    /**
     * Count overlaps between chunks
     */
    private countOverlaps(chunks: DocumentChunk[]): number {
        // Simplified - would need more sophisticated overlap detection
        return Math.max(0, chunks.length - 1);
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ChunkingConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): ChunkingConfig {
        return { ...this.config };
    }
}