/**
 * @fileoverview Unit tests for Markdown Parser
 * @module adapters/secondary/parsers/__tests__/markdown-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMarkdownParser, MarkdownParser } from '../markdown-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;
  let tempDir: string;

  beforeEach(() => {
    parser = createMarkdownParser();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md-parser-test-'));
  });

  describe('Heading Parsing', () => {
    it('should extract sections by headings', async () => {
      const mdContent = `# Main Title

This is the introduction.

## Section One

Content of section one.

## Section Two

Content of section two.`;
      
      const testFile = path.join(tempDir, 'headings.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      
      // Should have chunks for each section
      const mainTitle = chunks.find(c => c.metadata.heading === 'Main Title');
      const sectionOne = chunks.find(c => c.metadata.heading === 'Section One');
      const sectionTwo = chunks.find(c => c.metadata.heading === 'Section Two');

      expect(mainTitle).toBeDefined();
      expect(sectionOne).toBeDefined();
      expect(sectionTwo).toBeDefined();
    });

    it('should track heading levels', async () => {
      const mdContent = `# Level 1

## Level 2

### Level 3

#### Level 4`;
      
      const testFile = path.join(tempDir, 'levels.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const level1 = chunks.find(c => c.metadata.headingLevel === 1);
      const level2 = chunks.find(c => c.metadata.headingLevel === 2);
      const level3 = chunks.find(c => c.metadata.headingLevel === 3);
      const level4 = chunks.find(c => c.metadata.headingLevel === 4);

      expect(level1).toBeDefined();
      expect(level2).toBeDefined();
      expect(level3).toBeDefined();
      expect(level4).toBeDefined();
    });
  });

  describe('Content Extraction', () => {
    it('should extract section content', async () => {
      const mdContent = `## Introduction

This is a detailed introduction with multiple paragraphs.

It explains the purpose of the document.

## Features

- Feature one
- Feature two
- Feature three`;
      
      const testFile = path.join(tempDir, 'content.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const intro = chunks.find(c => c.metadata.heading === 'Introduction');
      const features = chunks.find(c => c.metadata.heading === 'Features');

      expect(intro?.content).toContain('detailed introduction');
      expect(intro?.content).toContain('multiple paragraphs');
      expect(features?.content).toContain('Feature one');
      expect(features?.content).toContain('Feature three');
    });

    it('should handle code blocks', async () => {
      const mdContent = `## Code Example

Here is some code:

\`\`\`typescript
function hello() {
  console.log('Hello, World!');
}
\`\`\`

The code above shows a simple function.`;
      
      const testFile = path.join(tempDir, 'code.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const codeSection = chunks.find(c => c.metadata.heading === 'Code Example');
      expect(codeSection?.content).toContain('function hello()');
      expect(codeSection?.content).toContain('console.log');
    });

    it('should handle inline code', async () => {
      const mdContent = `## Usage

Use the \`parseFile\` method to parse a file.`;
      
      const testFile = path.join(tempDir, 'inline.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
      const usage = chunks.find(c => c.metadata.heading === 'Usage');
      expect(usage?.content).toContain('parseFile');
    });
  });

  describe('Lists', () => {
    it('should extract unordered lists', async () => {
      const mdContent = `## Features

- First feature
- Second feature
- Third feature`;
      
      const testFile = path.join(tempDir, 'unordered.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const features = chunks.find(c => c.metadata.heading === 'Features');
      expect(features?.content).toContain('First feature');
      expect(features?.content).toContain('Second feature');
      expect(features?.content).toContain('Third feature');
    });

    it('should extract ordered lists', async () => {
      const mdContent = `## Steps

1. First step
2. Second step
3. Third step`;
      
      const testFile = path.join(tempDir, 'ordered.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const steps = chunks.find(c => c.metadata.heading === 'Steps');
      expect(steps?.content).toContain('First step');
      expect(steps?.content).toContain('Second step');
    });
  });

  describe('Links and Images', () => {
    it('should preserve links', async () => {
      const mdContent = `## Resources

Check out [this link](https://example.com) for more information.`;
      
      const testFile = path.join(tempDir, 'links.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const resources = chunks.find(c => c.metadata.heading === 'Resources');
      expect(resources?.content).toContain('link');
      expect(resources?.content).toContain('example.com');
    });

    it('should handle images', async () => {
      const mdContent = `## Diagram

![Architecture Diagram](./diagram.png)`;
      
      const testFile = path.join(tempDir, 'images.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const diagram = chunks.find(c => c.metadata.heading === 'Diagram');
      expect(diagram?.content).toContain('Architecture Diagram');
    });
  });

  describe('Overlap Chunking', () => {
    it('should create overlapping chunks', async () => {
      const mdContent = `## Long Section

${'This is a sentence. '.repeat(100)}`;
      
      const testFile = path.join(tempDir, 'overlap.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFileWithOverlap(testFile, 200, 50);

      expect(chunks.length).toBeGreaterThan(1);
      
      // Check that chunks have overlap metadata
      const hasOverlap = chunks.some(c => c.metadata.hasOverlap === true);
      expect(hasOverlap).toBe(true);
    });

    it('should track chunk numbers', async () => {
      const mdContent = `## Section

${'Word '.repeat(200)}`;
      
      const testFile = path.join(tempDir, 'chunks.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFileWithOverlap(testFile, 100, 20);

      const hasChunkNumbers = chunks.some(c => 
        c.metadata.chunkNumber !== undefined && c.metadata.chunkNumber > 0
      );
      expect(hasChunkNumbers).toBe(true);
    });
  });

  describe('Empty Content', () => {
    it('should handle empty files', async () => {
      const mdContent = ``;
      
      const testFile = path.join(tempDir, 'empty.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });

    it('should handle files with only whitespace', async () => {
      const mdContent = `\n\n   \n\n`;
      
      const testFile = path.join(tempDir, 'whitespace.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks).toHaveLength(0);
    });

    it('should handle sections with no content', async () => {
      const mdContent = `## Empty Section

## Another Section

Some content here.`;
      
      const testFile = path.join(tempDir, 'empty-section.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      // Should still create chunks for all sections
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Chunk Metadata', () => {
    it('should include correct file path', async () => {
      const mdContent = `## Test\n\nContent`;
      
      const testFile = path.join(tempDir, 'metadata.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].metadata.filePath).toBe(testFile);
    });

    it('should include line numbers', async () => {
      const mdContent = `## Test\n\nContent`;
      
      const testFile = path.join(tempDir, 'lines.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].metadata.lineStart).toBeGreaterThan(0);
      expect(chunks[0].metadata.lineEnd).toBeGreaterThanOrEqual(chunks[0].metadata.lineStart);
    });

    it('should set chunk type to markdown_section', async () => {
      const mdContent = `## Test\n\nContent`;
      
      const testFile = path.join(tempDir, 'chunktype.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks[0].metadata.chunkType).toBe('markdown_section');
    });

    it('should generate unique chunk IDs', async () => {
      const mdContent = `## Section 1

Content 1

## Section 2

Content 2`;
      
      const testFile = path.join(tempDir, 'unique.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(1);
      const ids = chunks.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Special Markdown Features', () => {
    it('should handle tables', async () => {
      const mdContent = `## Table Example

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |`;
      
      const testFile = path.join(tempDir, 'table.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const table = chunks.find(c => c.metadata.heading === 'Table Example');
      expect(table?.content).toContain('Column 1');
      expect(table?.content).toContain('Data 1');
    });

    it('should handle blockquotes', async () => {
      const mdContent = `## Quote

> This is a blockquote
> spanning multiple lines`;
      
      const testFile = path.join(tempDir, 'quote.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const quote = chunks.find(c => c.metadata.heading === 'Quote');
      expect(quote?.content).toContain('blockquote');
    });

    it('should handle horizontal rules', async () => {
      const mdContent = `## Section

Content before

---

Content after`;
      
      const testFile = path.join(tempDir, 'hr.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files gracefully', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.md');

      const chunks = await parser.parseFile(nonExistentFile);
      
      expect(chunks).toHaveLength(0);
    });

    it('should handle invalid markdown gracefully', async () => {
      const mdContent = `## [[[Invalid markdown structure`;
      
      const testFile = path.join(tempDir, 'invalid.md');
      fs.writeFileSync(testFile, mdContent);

      // Should not throw
      const chunks = await parser.parseFile(testFile);
      
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Complex Documents', () => {
    it('should handle nested headings correctly', async () => {
      const mdContent = `# Main Title

Introduction text

## Chapter 1

Chapter 1 content

### Section 1.1

Section 1.1 content

### Section 1.2

Section 1.2 content

## Chapter 2

Chapter 2 content`;
      
      const testFile = path.join(tempDir, 'nested.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      expect(chunks.length).toBeGreaterThan(3);
      
      const chapter1 = chunks.find(c => c.metadata.heading === 'Chapter 1');
      const section11 = chunks.find(c => c.metadata.heading === 'Section 1.1');
      
      expect(chapter1).toBeDefined();
      expect(section11).toBeDefined();
      expect(chapter1?.metadata.headingLevel).toBe(2);
      expect(section11?.metadata.headingLevel).toBe(3);
    });

    it('should handle mixed content types', async () => {
      const mdContent = `## Mixed Content

Regular paragraph.

- List item
- Another item

\`\`\`javascript
const code = true;
\`\`\`

> A quote

[A link](https://example.com)

![An image](image.png)`;
      
      const testFile = path.join(tempDir, 'mixed.md');
      fs.writeFileSync(testFile, mdContent);

      const chunks = await parser.parseFile(testFile);

      const mixed = chunks.find(c => c.metadata.heading === 'Mixed Content');
      expect(mixed?.content).toBeTruthy();
      expect(mixed?.content.length).toBeGreaterThan(50);
    });
  });
});
