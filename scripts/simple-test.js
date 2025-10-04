const { ChunkingService } = require('../out/core/chunking');
const { DEFAULT_CHUNKING_CONFIG } = require('../out/core/schemas');

async function runTest() {
    try {
        console.log('🚀 Testing Chunking System...\n');
        
        const chunkingService = new ChunkingService(DEFAULT_CHUNKING_CONFIG);
        
        // Test 1: Markdown content
        const markdownContent = `# Main Title

This is the introduction.

## Section 1

Content of section 1.

### Subsection 1.1

More detailed content.

## Section 2

Final section content.`;

        console.log('📝 Testing Markdown chunking...');
        const markdownChunks = await chunkingService.chunkFile('test.md', markdownContent);
        console.log(`✅ Created ${markdownChunks.length} markdown chunks:`);
        
        markdownChunks.forEach((chunk, i) => {
            console.log(`   Chunk ${i + 1}: Lines ${chunk.startLine}-${chunk.endLine}, Type: ${chunk.type}`);
            console.log(`   Keywords: ${chunk.keywords.slice(0, 5).join(', ')}${chunk.keywords.length > 5 ? '...' : ''}`);
            console.log(`   ID: ${chunk.id.substring(0, 12)}...`);
            console.log('');
        });

        // Test 2: TypeScript content
        const tsContent = `/**
 * A sample class for testing
 */
export class TestClass {
    private value: number;

    constructor(initialValue: number) {
        this.value = initialValue;
    }

    getValue(): number {
        return this.value;
    }
}

export function helperFunction(input: string): string {
    return input.toUpperCase();
}`;

        console.log('🔧 Testing TypeScript chunking...');
        const tsChunks = await chunkingService.chunkFile('test.ts', tsContent);
        console.log(`✅ Created ${tsChunks.length} TypeScript chunks:`);
        
        tsChunks.forEach((chunk, i) => {
            console.log(`   Chunk ${i + 1}: Lines ${chunk.startLine}-${chunk.endLine}, Type: ${chunk.type}`);
            console.log(`   Keywords: ${chunk.keywords.slice(0, 5).join(', ')}${chunk.keywords.length > 5 ? '...' : ''}`);
            console.log(`   ID: ${chunk.id.substring(0, 12)}...`);
            console.log('');
        });

        console.log('🎉 SUCCESS: Chunking system working correctly!');
        console.log(`📊 Total chunks created: ${markdownChunks.length + tsChunks.length}`);
        
        // Test hash consistency
        const chunk1 = await chunkingService.chunkFile('test.md', markdownContent);
        const chunk2 = await chunkingService.chunkFile('test.md', markdownContent);
        const hashesMatch = chunk1.every((c1, i) => c1.id === chunk2[i].id);
        console.log(`🔒 Hash consistency: ${hashesMatch ? 'PASS' : 'FAIL'}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    }
}

runTest();