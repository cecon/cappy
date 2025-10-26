/**
 * @fileoverview AST-based relationship extraction service
 * @module services/ast-relationship-extractor
 * @author Cappy Team
 * @since 3.0.0
 * 
 * This service extracts relationships between code entities using AST analysis.
 * It now uses ASTEntityExtractor + EntityFilterPipeline for comprehensive code analysis.
 * 
 * @see ASTEntityExtractor - For entity extraction
 * @see EntityFilterPipeline - For entity filtering
 * @see ASTEntityAdapter - For type conversion
 * @see ExternalPackageResolver - For package dependency resolution
 */

import type { DocumentChunk, GraphRelationship } from '../../../shared/types/chunk';
import { ExternalPackageResolver, type PackageResolution } from './external-package-resolver';
import { ASTEntityExtractor } from './entity-extraction/core/ASTEntityExtractor';
import type { ASTEntity } from './entity-extraction/types/ASTEntity';
import * as path from 'path';

/**
 * Extended import info with external package resolution
 */
export interface ImportInfo {
  source: string;
  specifiers: string[];
  isExternal: boolean;
  packageResolution?: PackageResolution;
}

/**
 * Service for extracting relationships from AST
 * Now delegates entity extraction to ASTEntityExtractor
 */
export class ASTRelationshipExtractor {
  private readonly packageResolver: ExternalPackageResolver;
  private readonly workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.packageResolver = new ExternalPackageResolver(workspaceRoot);
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Analyzes a file and returns import/export/call/type reference info
   * Now uses ASTEntityExtractor for extraction
   */
  async analyze(filePath: string): Promise<{
    imports: ImportInfo[];
    exports: string[];
    calls: string[];
    typeRefs: string[];
  }> {
    const absFilePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(this.workspaceRoot, filePath);
    
    // Use ASTEntityExtractor for entity extraction
    const extractor = new ASTEntityExtractor(this.workspaceRoot);
    const astEntities = await extractor.extractFromFile(absFilePath);
    
    // Process entities
    const { importMap, exports, calls, typeRefs } = this.processEntities(astEntities);
    
    // Convert import map to array and resolve packages
    const imports = await this.resolveImports(importMap, absFilePath);
    
    return { imports, exports, calls, typeRefs };
  }

  /**
   * Process entities and categorize them
   */
  private processEntities(astEntities: ASTEntity[]) {
    const importMap = new Map<string, { specifiers: string[]; isExternal: boolean }>();
    const exports: string[] = [];
    const calls: string[] = [];
    const typeRefs: string[] = [];

    for (const entity of astEntities) {
      this.categorizeEntity(entity, importMap, exports, calls, typeRefs);
    }

    return { importMap, exports, calls, typeRefs };
  }

  /**
   * Categorize a single entity
   */
  private categorizeEntity(
    entity: ASTEntity,
    importMap: Map<string, { specifiers: string[]; isExternal: boolean }>,
    exports: string[],
    calls: string[],
    typeRefs: string[]
  ) {
    // Handle imports
    if (entity.kind === 'import' && entity.originalModule) {
      const source = entity.originalModule;
      const isExternal = entity.category === 'external' || entity.category === 'builtin';
      
      if (!importMap.has(source)) {
        importMap.set(source, { specifiers: [], isExternal });
      }
      importMap.get(source)!.specifiers.push(entity.name);
    }
    // Handle exports
    else if (entity.isExported) {
      exports.push(entity.name);
    }
    // Handle calls
    else if (entity.kind === 'call') {
      calls.push(entity.name);
    }
    // Handle type references
    else if (entity.type === 'interface' || entity.type === 'type') {
      typeRefs.push(entity.name);
    }
  }

  /**
   * Convert import map to array and resolve external packages
   */
  private async resolveImports(
    importMap: Map<string, { specifiers: string[]; isExternal: boolean }>,
    absFilePath: string
  ): Promise<ImportInfo[]> {
    const imports: Array<{ source: string; specifiers: string[]; isExternal: boolean }> = [];
    
    // Convert import map to array
    for (const [source, data] of importMap.entries()) {
      imports.push({
        source,
        specifiers: data.specifiers,
        isExternal: data.isExternal
      });
    }
    
    // Resolve package info for external imports
    const importsWithResolution: ImportInfo[] = [];
    for (const imp of imports) {
      const importInfo: ImportInfo = { ...imp };
      if (imp.isExternal) {
        importInfo.packageResolution = await this.tryResolvePackage(imp.source, absFilePath);
      }
      importsWithResolution.push(importInfo);
    }
    
    return importsWithResolution;
  }

  /**
   * Try to resolve a package, return undefined on error
   */
  private async tryResolvePackage(source: string, filePath: string): Promise<PackageResolution | undefined> {
    try {
      return await this.packageResolver.resolveExternalImport(source, filePath);
    } catch (error) {
      console.warn(`⚠️ Failed to resolve package ${source}:`, error);
      return undefined;
    }
  }

  /**
   * Extracts relationships from a file's AST
   * Now uses analyze() which leverages ASTEntityExtractor
   */
  async extract(
    filePath: string,
    chunks: DocumentChunk[]
  ): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    try {
      const absFilePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.workspaceRoot, filePath);

      // Use analyze() which now uses ASTEntityExtractor
      const { imports, exports, calls, typeRefs } = await this.analyze(absFilePath);

      // Log summary
      this.logAnalysisSummary(imports, exports, calls, typeRefs);
      
      // Create a map of symbol names to chunk IDs for quick lookup
      const symbolToChunkId = this.buildSymbolMap(chunks);

      // Create relationships
      this.addPackageRelationships(imports, filePath, relationships);
      this.addCallRelationships(calls, chunks, symbolToChunkId, relationships);
      this.addTypeRefRelationships(typeRefs, chunks, symbolToChunkId, relationships);

      // Log results
      this.logExtractionResults(imports, exports, relationships);

    } catch (error) {
      console.error(`❌ AST extraction error for ${filePath}:`, error);
    }

    return relationships;
  }

  /**
   * Log analysis summary
   */
  private logAnalysisSummary(
    imports: ImportInfo[],
    exports: string[],
    calls: string[],
    typeRefs: string[]
  ) {
    const externalCount = imports.filter(i => i.isExternal).length;
    const internalCount = imports.length - externalCount;
    console.log(`📊 Found ${imports.length} imports (${externalCount} external, ${internalCount} internal), ${exports.length} exports, ${calls.length} calls, ${typeRefs.length} type refs`);
  }

  /**
   * Build a map from symbol names to chunk IDs
   */
  private buildSymbolMap(chunks: DocumentChunk[]): Map<string, string> {
    const symbolToChunkId = new Map<string, string>();
    for (const chunk of chunks) {
      if (chunk.metadata.symbolName) {
        symbolToChunkId.set(chunk.metadata.symbolName, chunk.id);
      }
    }
    return symbolToChunkId;
  }

  /**
   * Add package import relationships
   */
  private addPackageRelationships(
    imports: ImportInfo[],
    filePath: string,
    relationships: GraphRelationship[]
  ) {
    for (const imp of imports) {
      if (imp.isExternal && imp.packageResolution) {
        const res = imp.packageResolution;
        const pkgId = `pkg:${res.name}@${res.resolved ?? res.range ?? 'unknown'}`;
        
        relationships.push({
          from: filePath,
          to: pkgId,
          type: 'IMPORTS_PKG',
          properties: {
            specifier: imp.source,
            subpath: res.subpath,
            range: res.range,
            resolved: res.resolved,
            manager: res.manager,
            lockfile: res.lockfile,
            integrity: res.integrity,
            workspace: res.workspace,
            commit: res.commit,
            url: res.url,
            source: res.source,
            confidence: res.confidence,
            specifiers: imp.specifiers
          }
        });
      }
    }
  }

  /**
   * Add function call relationships
   */
  private addCallRelationships(
    calls: string[],
    chunks: DocumentChunk[],
    symbolToChunkId: Map<string, string>,
    relationships: GraphRelationship[]
  ) {
    for (const call of calls) {
      const targetChunkId = symbolToChunkId.get(call);
      if (targetChunkId) {
        this.addReferenceRelationshipsForSymbol(
          call,
          targetChunkId,
          'function_call',
          chunks,
          relationships
        );
      }
    }
  }

  /**
   * Add type reference relationships
   */
  private addTypeRefRelationships(
    typeRefs: string[],
    chunks: DocumentChunk[],
    symbolToChunkId: Map<string, string>,
    relationships: GraphRelationship[]
  ) {
    for (const typeRef of typeRefs) {
      const targetChunkId = symbolToChunkId.get(typeRef);
      if (targetChunkId) {
        this.addReferenceRelationshipsForSymbol(
          typeRef,
          targetChunkId,
          'type_reference',
          chunks,
          relationships
        );
      }
    }
  }

  /**
   * Add REFERENCES relationships for a symbol
   */
  private addReferenceRelationshipsForSymbol(
    symbolName: string,
    targetChunkId: string,
    referenceType: 'function_call' | 'type_reference',
    chunks: DocumentChunk[],
    relationships: GraphRelationship[]
  ) {
    for (const chunk of chunks) {
      if (chunk.metadata.chunkType === 'code' || chunk.metadata.chunkType === 'jsdoc') {
        relationships.push({
          from: chunk.id,
          to: targetChunkId,
          type: 'REFERENCES',
          properties: {
            referenceType,
            symbolName
          }
        });
      }
    }
  }

  /**
   * Log extraction results
   */
  private logExtractionResults(
    imports: ImportInfo[],
    exports: string[],
    relationships: GraphRelationship[]
  ) {
    const internalImports = imports.filter(i => !i.isExternal);
    if (internalImports.length > 0) {
      console.log(`  📥 Internal imports: ${internalImports.map(i => i.source).join(', ')}`);
    }
    if (exports.length > 0) {
      console.log(`  📤 Exports: ${exports.join(', ')}`);
    }

    const pkgRelCount = relationships.filter(r => r.type === 'IMPORTS_PKG').length;
    const otherRelCount = relationships.length - pkgRelCount;
    console.log(`  🔗 Created ${relationships.length} relationships (${pkgRelCount} package imports, ${otherRelCount} code references)`);
  }
}
