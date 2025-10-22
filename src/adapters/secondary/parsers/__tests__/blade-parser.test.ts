/**
 * @fileoverview Tests for Blade template parser
 * @module adapters/secondary/parsers/__tests__/blade-parser.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createBladeParser } from '../blade-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('BladeParser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blade-parser-test-'));
  });

  describe('parseFile', () => {
    it('should extract Blade comments', async () => {
      const parser = createBladeParser();
      const testFile = path.join(tempDir, 'test.blade.php');
      
      fs.writeFileSync(testFile, `
{{-- This is a Blade comment --}}
<div>Content</div>
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('This is a Blade comment');
      expect(chunks[0].metadata.chunkType).toBe('blade');
      expect(chunks[0].metadata.elementKind).toBe('comment');
    });

    it('should extract Blade sections', async () => {
      const parser = createBladeParser();
      const testFile = path.join(tempDir, 'test.blade.php');
      
      fs.writeFileSync(testFile, `
/**
 * Main content section
 */
@section('content')
    <h1>Hello</h1>
@endsection
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      const sectionChunk = chunks.find(c => c.metadata.elementKind === 'section');
      expect(sectionChunk).toBeDefined();
      expect(sectionChunk?.metadata.elementName).toBe('content');
    });

    it('should extract Blade components', async () => {
      const parser = createBladeParser();
      const testFile = path.join(tempDir, 'test.blade.php');
      
      fs.writeFileSync(testFile, `
<x-alert type="error" message="Something went wrong" />
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      const componentChunk = chunks.find(c => c.metadata.elementKind === 'component');
      expect(componentChunk).toBeDefined();
      expect(componentChunk?.metadata.elementName).toBe('alert');
      expect(componentChunk?.metadata.attributes).toMatchObject({
        type: 'error',
        message: 'Something went wrong'
      });
    });

    it('should extract Blade directives', async () => {
      const parser = createBladeParser();
      const testFile = path.join(tempDir, 'test.blade.php');
      
      fs.writeFileSync(testFile, `
@if($user->isAdmin())
    <p>Admin panel</p>
@endif

@foreach($items as $item)
    <li>{{ $item }}</li>
@endforeach
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      
      const ifDirective = chunks.find(c => c.metadata.elementName === 'if');
      expect(ifDirective).toBeDefined();
      expect(ifDirective?.metadata.elementKind).toBe('directive');
      
      const foreachDirective = chunks.find(c => c.metadata.elementName === 'foreach');
      expect(foreachDirective).toBeDefined();
    });

    it('should extract multi-line Blade comments', async () => {
      const parser = createBladeParser();
      const testFile = path.join(tempDir, 'test.blade.php');
      
      fs.writeFileSync(testFile, `
{{--
  This is a multi-line
  Blade comment
--}}
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('multi-line');
      expect(chunks[0].content).toContain('Blade comment');
    });

    it('should handle PHPDoc before Blade elements', async () => {
      const parser = createBladeParser();
      const testFile = path.join(tempDir, 'test.blade.php');
      
      fs.writeFileSync(testFile, `
/**
 * User profile component
 * @param User $user
 */
<x-profile user="{{ $user }}" />
      `);

      const chunks = await parser.parseFile(testFile);
      
      expect(chunks.length).toBeGreaterThan(0);
      const componentChunk = chunks.find(c => c.metadata.elementKind === 'component');
      expect(componentChunk).toBeDefined();
      expect(componentChunk?.content).toContain('User profile component');
      expect(componentChunk?.content).toContain('@param User $user');
    });

    it('should return empty array for non-existent files', async () => {
      const parser = createBladeParser();
      const nonExistentFile = path.join(tempDir, 'does-not-exist.blade.php');
      
      const chunks = await parser.parseFile(nonExistentFile);
      
      expect(chunks).toEqual([]);
    });
  });
});
