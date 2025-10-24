/**
 * @fileoverview Tests for HTML parser
 * @module adapters/secondary/parsers/__tests__/html-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createHTMLParser } from '../html-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('HTMLParser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-parser-test-'));
  });

  describe('parseFile', () => {
    it('should extract HTML comments', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<!DOCTYPE html>
<html>
<!-- This is a HTML comment -->
<body>Content</body>
</html>
      `);

      const chunks = await parser.parseFile(testFile);
      
      const commentChunk = chunks.find(c => c.metadata.elementKind === 'comment');
      expect(commentChunk).toBeDefined();
      expect(commentChunk?.content).toBe('This is a HTML comment');
    });

    it('should extract page title', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<html>
<head>
  <title>My Web Page</title>
</head>
</html>
      `);

      const chunks = await parser.parseFile(testFile);
      
      const titleChunk = chunks.find(c => c.metadata.elementKind === 'title');
      expect(titleChunk).toBeDefined();
      expect(titleChunk?.content).toBe('My Web Page');
    });

    it('should extract meta tags', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<head>
  <meta name="description" content="A test page" />
  <meta property="og:title" content="Test Page" />
</head>
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      const descMeta = chunks.find(c => c.metadata.elementName === 'description');
      expect(descMeta).toBeDefined();
      expect(descMeta?.content).toContain('A test page');
      
      const ogMeta = chunks.find(c => c.metadata.elementName === 'og:title');
      expect(ogMeta).toBeDefined();
    });

    it('should extract headings', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<h1>Main Heading</h1>
<h2>Subheading</h2>
<h3>Section Title</h3>
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      const h1 = chunks.find(c => c.metadata.elementName === 'h1');
      expect(h1).toBeDefined();
      expect(h1?.content).toBe('Main Heading');
      
      const h2 = chunks.find(c => c.metadata.elementName === 'h2');
      expect(h2).toBeDefined();
      expect(h2?.content).toBe('Subheading');
    });

    it('should extract ARIA landmarks', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<header aria-label="Site Header">
  <nav id="main-nav" class="primary-nav">
  </nav>
</header>
<main aria-label="Main Content">
</main>
      `);

      const chunks = await parser.parseFile(testFile);
      
      const headerChunk = chunks.find(c => c.metadata.elementName === 'header');
      expect(headerChunk).toBeDefined();
      expect(headerChunk?.content).toContain('Site Header');
      
      const navChunk = chunks.find(c => c.metadata.elementName === 'nav');
      expect(navChunk).toBeDefined();
    });

    it('should extract multi-line comments', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<!--
  This is a multi-line comment
  with several lines
  of text
-->
      `);

      const chunks = await parser.parseFile(testFile);
      
      const commentChunk = chunks.find(c => c.metadata.elementKind === 'comment');
      expect(commentChunk).toBeDefined();
      expect(commentChunk?.content).toContain('multi-line comment');
      expect(commentChunk?.content).toContain('several lines');
    });

    it('should skip conditional comments', async () => {
      const parser = createHTMLParser();
      const testFile = path.join(tempDir, 'test.html');
      
      fs.writeFileSync(testFile, `
<!--[if IE]>
  <p>Internet Explorer</p>
<![endif]-->
      `);

      const chunks = await parser.parseFile(testFile);
      
      const conditionalComment = chunks.find(c => 
        c.metadata.elementKind === 'comment' && c.content.includes('[if IE]')
      );
      expect(conditionalComment).toBeUndefined();
    });

    it('should return empty array for non-existent files', async () => {
      const parser = createHTMLParser();
      const nonExistentFile = path.join(tempDir, 'does-not-exist.html');
      
      const chunks = await parser.parseFile(nonExistentFile);
      
      expect(chunks).toEqual([]);
    });
  });
});
