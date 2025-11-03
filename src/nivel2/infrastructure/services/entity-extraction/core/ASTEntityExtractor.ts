/**
 * @fileoverview AST-based entity extraction service (Hexagonal Architecture)
 * @module services/entity-extraction/core
 * @author Cappy Team
 * @since 3.2.0
 */

import { parse } from "@typescript-eslint/parser";
import * as fs from "fs";
import * as path from "path";
import type { ASTNode } from "../ast-types/ASTNodeTypes";
import type { ASTEntity } from "../types/ASTEntity";
import type { ExtractionContext } from "../types/ExtractionContext";
import { ExportCollector } from "../traversal/ExportCollector";
import { ImportMapBuilder } from "../traversal/ImportMapBuilder";
import { ASTTraverser } from "../traversal/ASTTraverser";

/**
 * AST Entity Extractor (Hexagonal - Port)
 * Orchestrates specialized extractors to analyze code structure
 */
export class ASTEntityExtractor {
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Extract entities from a TypeScript/JavaScript file
   */
  async extractFromFile(filePath: string): Promise<ASTEntity[]> {
    const absFilePath = path.isAbsolute(filePath) ? filePath : path.join(this.workspaceRoot, filePath);

    if (!fs.existsSync(absFilePath)) {
      console.warn(`⚠️ File not found: ${absFilePath}`);
      return [];
    }

    const supportedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs"]);
    const fileExtension = path.extname(absFilePath).toLowerCase();

    if (!supportedExtensions.has(fileExtension)) {
      console.info(`ℹ️ Skipping AST extraction for unsupported file type: ${filePath}`);
      return [];
    }

    try {
      console.log(`🔍 [ASTEntityExtractor] Starting extraction for: ${filePath}`);
      const content = fs.readFileSync(absFilePath, "utf-8");
      console.log(`📄 [ASTEntityExtractor] File size: ${content.length} chars`);
      
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      }) as unknown as ASTNode;

      console.log(`✅ [ASTEntityExtractor] AST parsed successfully`);

      // Build context
      const context: ExtractionContext = {
        filePath: absFilePath,
        relFilePath: path.relative(this.workspaceRoot, absFilePath),
        exportedNames: ExportCollector.collect(ast),
        importedSymbols: new Map(),
        content,
      };

      console.log(`📊 [ASTEntityExtractor] Context built - Exported names: ${context.exportedNames.size}`);

      // Build import map
      ImportMapBuilder.build(ast, context);
      console.log(`📥 [ASTEntityExtractor] Import map built - Imported symbols: ${context.importedSymbols.size}`);

      // Extract entities
      const entities = ASTTraverser.traverse(ast, context);

      console.log(`✨ [ASTEntityExtractor] Extracted ${entities.length} entities from ${filePath}`);
      if (entities.length > 0) {
        const byType = entities.reduce((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`   Types breakdown:`, byType);
      }
      
      return entities;
    } catch (error) {
      console.error(`❌ AST entity extraction error for ${filePath}:`, error);
      return [];
    }
  }
}
