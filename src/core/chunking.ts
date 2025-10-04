import * as fs from 'fs';
import * as path from 'path';
import { 
    Chunk, 
    ChunkType, 
    ChunkMetadata, 
    ChunkingConfig, 
    DEFAULT_CHUNKING_CONFIG 
} from './schemas';
import { hashChunk, hashText } from './hashing';

/**
 * Main chunking orchestrator that handles different file types
 */
export class ChunkingService {
    private config: ChunkingConfig;

    constructor(config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG) {
        this.config = config;
    }

    /**
     * Chunk a file based on its type and content
     */
    async chunkFile(filePath: string, content?: string): Promise<Chunk[]> {
        const fileContent = content || await fs.promises.readFile(filePath, 'utf8');
        const language = this.detectLanguage(filePath);
        const strategy = this.getChunkingStrategy(language);

        switch (strategy) {
            case 'markdown':
                return this.chunkMarkdown(filePath, fileContent, language);
            case 'ast':
                return this.chunkCodeSimple(filePath, fileContent, language);
            case 'line-based':
            default:
                return this.chunkByLines(filePath, fileContent, language);
        }
    }

    /**
     * Detect programming language from file extension
     */
    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        
        const languageMap = new Map([
            ['.ts', 'typescript'],
            ['.tsx', 'typescript'],
            ['.js', 'javascript'], 
            ['.jsx', 'javascript'],
            ['.md', 'markdown'],
            ['.mdx', 'markdown'],
            ['.py', 'python'],
            ['.java', 'java'],
            ['.cpp', 'cpp'],
            ['.c', 'c'],
            ['.cs', 'csharp'],
            ['.php', 'php'],
            ['.rb', 'ruby'],
            ['.go', 'go'],
            ['.rs', 'rust'],
            ['.json', 'json'],
            ['.yaml', 'yaml'],
            ['.yml', 'yaml'],
            ['.xml', 'xml'],
            ['.html', 'html'],
            ['.css', 'css'],
            ['.scss', 'scss'],
            ['.sql', 'sql']
        ]);

        return languageMap.get(ext) || 'text';
    }

    /**
     * Get chunking strategy for a language
     */
    private getChunkingStrategy(language: string): 'markdown' | 'ast' | 'line-based' {
        if (language === 'markdown') {
            return 'markdown';
        }
        if (['typescript', 'javascript'].includes(language)) {
            return 'ast';
        }
        return 'line-based';
    }

    /**
     * Chunk Markdown content by headings
     */
    private chunkMarkdown(filePath: string, content: string, language: string): Chunk[] {
        const lines = content.split('\n');
        const chunks: Chunk[] = [];
        
        let currentChunk: {
            startLine: number;
            endLine: number;
            text: string[];
            headingLevel?: number;
            title?: string;
        } | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            
            // Check for heading
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            
            if (headingMatch) {
                // Save previous chunk if exists
                if (currentChunk) {
                    chunks.push(this.createChunk(
                        filePath, 
                        currentChunk.text.join('\n'),
                        currentChunk.startLine,
                        currentChunk.endLine,
                        'markdown-section',
                        language,
                        {
                            headingLevel: currentChunk.headingLevel,
                            symbolName: currentChunk.title
                        }
                    ));
                }

                // Start new chunk
                const headingLevel = headingMatch[1].length;
                const title = headingMatch[2].trim();
                
                currentChunk = {
                    startLine: lineNumber,
                    endLine: lineNumber,
                    text: [line],
                    headingLevel,
                    title
                };
            } else if (currentChunk) {
                // Add line to current chunk
                currentChunk.text.push(line);
                currentChunk.endLine = lineNumber;
            } else {
                // Create initial chunk for content before first heading
                currentChunk = {
                    startLine: lineNumber,
                    endLine: lineNumber,
                    text: [line]
                };
            }

            // Check if chunk is getting too large
            if (currentChunk && 
                (currentChunk.text.length >= this.config.maxLinesPerChunk ||
                 this.estimateTokens(currentChunk.text.join('\n')) >= this.config.maxTokensPerChunk)) {
                
                chunks.push(this.createChunk(
                    filePath,
                    currentChunk.text.join('\n'),
                    currentChunk.startLine,
                    currentChunk.endLine,
                    'markdown-section',
                    language,
                    {
                        headingLevel: currentChunk.headingLevel,
                        symbolName: currentChunk.title
                    }
                ));
                
                currentChunk = null;
            }
        }

        // Save last chunk
        if (currentChunk) {
            chunks.push(this.createChunk(
                filePath,
                currentChunk.text.join('\n'),
                currentChunk.startLine,
                currentChunk.endLine,
                'markdown-section',
                language,
                {
                    headingLevel: currentChunk.headingLevel,
                    symbolName: currentChunk.title
                }
            ));
        }

        return this.addOverlap(chunks, content);
    }

    /**
     * Simple code chunking using basic patterns
     */
    private chunkCodeSimple(filePath: string, content: string, language: string): Chunk[] {
        const lines = content.split('\n');
        const chunks: Chunk[] = [];
        
        let currentChunk: string[] = [];
        let chunkStart = 1;
        let inFunction = false;
        let braceCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            
            // Simple detection of function/class starts
            const isFunctionStart = /^\s*(export\s+)?(async\s+)?(function|class|interface|enum|type)\s+/.test(line);
            
            if (isFunctionStart && currentChunk.length > 0) {
                // Save previous chunk
                chunks.push(this.createChunk(
                    filePath,
                    currentChunk.join('\n'),
                    chunkStart,
                    lineNumber - 1,
                    'code-block',
                    language,
                    {}
                ));
                
                currentChunk = [];
                chunkStart = lineNumber;
            }

            currentChunk.push(line);
            
            if (isFunctionStart) {
                inFunction = true;
                braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            } else if (inFunction) {
                braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
                
                if (braceCount <= 0) {
                    inFunction = false;
                    
                    // End of function - create chunk
                    chunks.push(this.createChunk(
                        filePath,
                        currentChunk.join('\n'),
                        chunkStart,
                        lineNumber,
                        'code-function',
                        language,
                        {}
                    ));
                    
                    currentChunk = [];
                    chunkStart = lineNumber + 1;
                }
            }

            // Force chunk if getting too large
            if (currentChunk.length >= this.config.maxLinesPerChunk) {
                chunks.push(this.createChunk(
                    filePath,
                    currentChunk.join('\n'),
                    chunkStart,
                    lineNumber,
                    'code-block',
                    language,
                    {}
                ));
                
                currentChunk = [];
                chunkStart = lineNumber + 1;
            }
        }

        // Save last chunk
        if (currentChunk.length > 0) {
            chunks.push(this.createChunk(
                filePath,
                currentChunk.join('\n'),
                chunkStart,
                lines.length,
                'code-block',
                language,
                {}
            ));
        }

        return this.addOverlap(chunks, content);
    }

    /**
     * Simple line-based chunking for unsupported file types
     */
    private chunkByLines(filePath: string, content: string, language: string): Chunk[] {
        const lines = content.split('\n');
        const chunks: Chunk[] = [];
        
        for (let i = 0; i < lines.length; i += this.config.maxLinesPerChunk) {
            const endIndex = Math.min(i + this.config.maxLinesPerChunk, lines.length);
            const chunkLines = lines.slice(i, endIndex);
            const chunkText = chunkLines.join('\n');
            
            if (chunkText.trim()) {
                chunks.push(this.createChunk(
                    filePath,
                    chunkText,
                    i + 1,
                    endIndex,
                    'text-block',
                    language,
                    {}
                ));
            }
        }

        return this.addOverlap(chunks, content);
    }

    /**
     * Helper to create a chunk from line information
     */
    private createChunk(
        filePath: string,
        text: string,
        startLine: number,
        endLine: number,
        type: ChunkType,
        language: string,
        metadata: Partial<ChunkMetadata>
    ): Chunk {
        const textHash = hashText(text);
        const chunkHash = hashChunk(text, filePath, startLine, endLine);
        const keywords = this.extractKeywords(text);

        return {
            id: chunkHash.hash,
            path: filePath,
            language,
            type,
            textHash,
            text,
            startLine,
            endLine,
            keywords,
            metadata: {
                loc: endLine - startLine + 1,
                ...metadata
            },
            updatedAt: new Date().toISOString(),
            version: 1
        };
    }

    /**
     * Add overlap between adjacent chunks
     */
    private addOverlap(chunks: Chunk[], originalContent: string): Chunk[] {
        if (chunks.length <= 1 || this.config.overlapLines === 0) {
            return chunks;
        }

        const lines = originalContent.split('\n');
        
        return chunks.map((chunk, i) => {
            if (i === 0) {
                return chunk; // First chunk doesn't need overlap
            }
            
            const overlapStart = Math.max(0, chunk.startLine - this.config.overlapLines - 1);
            const overlapEnd = chunk.startLine - 1;
            
            if (overlapStart < overlapEnd) {
                const overlapLines = lines.slice(overlapStart, overlapEnd);
                return {
                    ...chunk,
                    text: overlapLines.join('\n') + '\n' + chunk.text,
                    startLine: overlapStart + 1
                };
            }
            
            return chunk;
        });
    }

    /**
     * Extract keywords from text content
     */
    private extractKeywords(text: string): string[] {
        const keywords: Set<string> = new Set();
        
        // Extract programming keywords
        const programmingKeywords = text.match(/\b(function|class|interface|enum|type|const|let|var|import|export|async|await|return|if|else|for|while|try|catch)\b/g);
        if (programmingKeywords) {
            programmingKeywords.forEach(kw => keywords.add(kw.toLowerCase()));
        }

        // Extract identifiers (camelCase, PascalCase, snake_case)
        const identifiers = text.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g);
        if (identifiers) {
            identifiers
                .filter(id => id.length > 2 && !/^\d+$/.test(id))
                .slice(0, 20) // Limit keywords
                .forEach(id => keywords.add(id.toLowerCase()));
        }

        // Extract quoted strings (potential important terms)
        const strings = text.match(/["'`]([^"'`]+)["'`]/g);
        if (strings) {
            strings
                .map(s => s.slice(1, -1))
                .filter(s => s.length > 2 && s.length < 50)
                .slice(0, 10)
                .forEach(s => keywords.add(s.toLowerCase()));
        }

        return Array.from(keywords);
    }

    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens(text: string): number {
        // Rough estimate: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }
}