import { ChunkingService } from './chunking';
import { DEFAULT_CHUNKING_CONFIG } from './schemas';

/**
 * Simple test for the chunking system
 */
export async function testChunking() {
    const chunkingService = new ChunkingService(DEFAULT_CHUNKING_CONFIG);
    
    // Test markdown chunking
    const markdownContent = `# Main Title

This is the introduction.

## Section 1

Content of section 1.

### Subsection 1.1

More detailed content.

## Section 2

Final section content.`;

    console.log('Testing Markdown chunking...');
    const markdownChunks = await chunkingService.chunkFile('test.md', markdownContent);
    console.log(`Created ${markdownChunks.length} markdown chunks:`);
    markdownChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: Lines ${chunk.startLine}-${chunk.endLine}, Type: ${chunk.type}`);
        console.log(`    Keywords: ${chunk.keywords.slice(0, 5).join(', ')}...`);
        console.log(`    ID: ${chunk.id.substring(0, 8)}...`);
    });

    // Test TypeScript chunking
    const tsContent = `/**
 * A sample class for testing
 */
export class TestClass {
    private value: number;

    /**
     * Constructor for TestClass
     * @param initialValue - The initial value
     */
    constructor(initialValue: number) {
        this.value = initialValue;
    }

    /**
     * Get the current value
     * @returns The current value
     */
    getValue(): number {
        return this.value;
    }

    /**
     * Set a new value
     * @param newValue - The new value to set
     */
    setValue(newValue: number): void {
        this.value = newValue;
    }
}

/**
 * A standalone function
 */
export function helperFunction(input: string): string {
    return input.toUpperCase();
}`;

    console.log('\nTesting TypeScript chunking...');
    const tsChunks = await chunkingService.chunkFile('test.ts', tsContent);
    console.log(`Created ${tsChunks.length} TypeScript chunks:`);
    tsChunks.forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: Lines ${chunk.startLine}-${chunk.endLine}, Type: ${chunk.type}`);
        console.log(`    Keywords: ${chunk.keywords.slice(0, 5).join(', ')}...`);
        console.log(`    ID: ${chunk.id.substring(0, 8)}...`);
    });

    return {
        markdownChunks,
        tsChunks,
        totalChunks: markdownChunks.length + tsChunks.length
    };
}
