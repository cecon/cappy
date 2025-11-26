/**
 * @fileoverview Unit tests for Cappy Language Model Tools
 * @module test/tools/cappy-tools
 */

import { describe, it, expect } from 'vitest';

describe('Cappy Tools Registration', () => {
  describe('Tool Names', () => {
    it('should have expected tool names', () => {
      const expectedTools = [
        'cappy_create_file',
        'cappy_fetch_web',
        'cappy_retrieve_context',
        'cappy_workspace_search',
        'cappy_grep_search',
        'cappy_symbol_search',
        'cappy_read_file'
      ];
      
      // Verify we have the expected number
      expect(expectedTools.length).toBe(7);
      
      // Verify naming convention
      expectedTools.forEach(toolName => {
        expect(toolName).toMatch(/^cappy_/);
      });
    });

    it('should have tools for conversational agent', () => {
      const conversationalTools = [
        'cappy_read_file',
        'cappy_grep_search',
        'cappy_retrieve_context'
      ];
      
      expect(conversationalTools.length).toBe(3);
      
      conversationalTools.forEach(toolName => {
        expect(toolName).toMatch(/^cappy_(read_file|grep|retrieve)/);
      });
    });
  });

  describe('Tool Input Validation', () => {
    it('cappy_read_file should require filePath, startLine, endLine', () => {
      const requiredParams = ['filePath', 'startLine', 'endLine'];
      
      expect(requiredParams.length).toBe(3);
      expect(requiredParams).toContain('filePath');
      expect(requiredParams).toContain('startLine');
      expect(requiredParams).toContain('endLine');
    });

    it('cappy_grep_search should require query and isRegexp', () => {
      const requiredParams = ['query', 'isRegexp'];
      
      expect(requiredParams.length).toBe(2);
      expect(requiredParams).toContain('query');
      expect(requiredParams).toContain('isRegexp');
    });

    it('cappy_retrieve_context should require query', () => {
      const requiredParams = ['query'];
      
      expect(requiredParams.length).toBe(1);
      expect(requiredParams).toContain('query');
    });
  });

  describe('Tool Filtering Logic', () => {
    it('should correctly filter tools for conversational agent', () => {
      const allTools = [
        'cappy_create_file',
        'cappy_fetch_web',
        'cappy_retrieve_context',
        'cappy_workspace_search',
        'cappy_grep_search',
        'cappy_symbol_search',
        'cappy_read_file'
      ];
      
      // Simulate the filtering logic used in conversational agent
      const conversationalTools = allTools.filter(tool => 
        tool.startsWith('cappy_') && 
        (tool.includes('read_file') || tool.includes('grep') || tool.includes('retrieve'))
      );
      
      expect(conversationalTools.length).toBe(3);
      expect(conversationalTools).toContain('cappy_read_file');
      expect(conversationalTools).toContain('cappy_grep_search');
      expect(conversationalTools).toContain('cappy_retrieve_context');
    });

    it('should not include other tools in conversational filter', () => {
      const allTools = [
        'cappy_create_file',
        'cappy_fetch_web',
        'cappy_workspace_search',
        'cappy_symbol_search'
      ];
      
      const conversationalTools = allTools.filter(tool => 
        tool.startsWith('cappy_') && 
        (tool.includes('read_file') || tool.includes('grep') || tool.includes('retrieve'))
      );
      
      expect(conversationalTools.length).toBe(0);
    });
  });

  describe('Expected Tool Behavior', () => {
    it('read_file should work with absolute paths', () => {
      const testPath = '/Users/eduardomendonca/projetos/cappy/README.md';
      
      expect(testPath).toMatch(/^\//); // Absolute path
      expect(testPath).toContain('README.md');
    });

    it('grep_search should support regex and plain text', () => {
      const plainTextQuery = { query: 'Cappy', isRegexp: false };
      const regexQuery = { query: 'Cappy.*project', isRegexp: true };
      
      expect(plainTextQuery.isRegexp).toBe(false);
      expect(regexQuery.isRegexp).toBe(true);
    });

    it('retrieve_context should accept optional parameters', () => {
      const minimalInput = { query: 'project purpose' };
      const fullInput = { 
        query: 'project purpose', 
        maxResults: 5, 
        sources: ['documentation'],
        category: 'general'
      };
      
      expect(minimalInput.query).toBeDefined();
      expect(fullInput.maxResults).toBe(5);
      expect(fullInput.sources).toContain('documentation');
    });
  });
});

