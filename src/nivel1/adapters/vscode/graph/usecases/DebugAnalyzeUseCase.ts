import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';
import { ASTRelationshipExtractor } from '../../../../../nivel2/infrastructure/services/ast-relationship-extractor';
import { EntityFilterPipeline } from '../../../../../nivel2/infrastructure/services/entity-filtering/core/EntityFilterPipeline';
import { ASTEntityAdapter } from '../../../../../nivel2/infrastructure/services/entity-conversion/ASTEntityAdapter';
import { parse } from '@typescript-eslint/parser';
import * as path from 'path';

interface DebugAnalyzeMessage extends WebviewMessage {
  type: 'debug/analyze';
  payload: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    content: string;
  };
}

export class DebugAnalyzeUseCase implements UseCase {
  canHandle(message: WebviewMessage): boolean {
    return message.type === 'debug/analyze';
  }

  async handle(message: WebviewMessage, ctx: UseCaseContext): Promise<void> {
    const msg = message as DebugAnalyzeMessage;
    const { fileName, fileSize, mimeType, content } = msg.payload;

    ctx.log(`🐛 [Debug] Analyzing file: ${fileName}`);

    try {
      // Check if it's a supported file type
      const ext = path.extname(fileName).toLowerCase();
      const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      
      if (!supportedExtensions.includes(ext)) {
        ctx.sendMessage({
          type: 'debug/analyze-error',
          payload: {
            error: `Unsupported file type: ${ext}. Supported: ${supportedExtensions.join(', ')}`
          }
        });
        return;
      }

      // Parse AST
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: false,
        ecmaVersion: 'latest' as const,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      });

      // Use ASTRelationshipExtractor to get detailed analysis
      // Create a temporary file path for analysis
      const workspaceFolder = ctx.vscode.workspace.workspaceFolders?.[0];
      const workspaceRoot = workspaceFolder?.uri.fsPath || process.cwd();
      
      const extractor = new ASTRelationshipExtractor(workspaceRoot);
      
      // Create temp file to analyze
      const tempFilePath = path.join(workspaceRoot, '.cappy-debug-temp', fileName);
      const fs = await import('fs');
      const fsPromises = fs.promises;
      
      // Ensure temp dir exists
      const tempDir = path.dirname(tempFilePath);
      await fsPromises.mkdir(tempDir, { recursive: true });
      
      // Write temp file
      await fsPromises.writeFile(tempFilePath, content, 'utf-8');
      
      try {
        // Analyze using our infrastructure
        ctx.log(`🔍 [Debug] Running AST analysis...`);
        const analysis = await extractor.analyze(tempFilePath);
        
        ctx.log(`📝 [Debug] AST analysis complete - Imports: ${analysis.imports.length}, Exports: ${analysis.exports.length}`);
        
        // Extract signatures
        const signatures = this.extractSignatures(ast);
        
        // ============================================
        // PIPELINE INTEGRADO: extraction + filtering
        // ============================================
        
        // Usar ASTEntityAdapter para converter análise → RawEntities
        ctx.log(`🔄 [Debug] Converting analysis to raw entities...`);
        const rawEntities = ASTEntityAdapter.fromAnalysisFormat(analysis);
        
        ctx.log(`🔍 [Debug] Raw entities extracted: ${rawEntities.length}`);
        
        if (rawEntities.length === 0) {
          ctx.log(`⚠️ [Debug] No entities found! This might be an issue.`);
        }
        
        ctx.log(`📝 [Debug] Breakdown - Imports: ${analysis.imports.length}, Exports: ${analysis.exports.length}, Calls: ${analysis.calls.length}, TypeRefs: ${analysis.typeRefs.length}`);
        
        // Processar através do pipeline de filtragem
        ctx.log(`🔄 [Debug] Starting pipeline processing...`);
        const pipeline = new EntityFilterPipeline({
          skipLocalVariables: true,
          skipPrimitiveTypes: true,
          skipAssetImports: true,
          skipPrivateMembers: false,
          mergeIdenticalEntities: true,
          resolvePackageInfo: true,
          inferRelationships: true,
          calculateConfidence: true
        });
        
        const filterResult = await pipeline.process(rawEntities, tempFilePath, undefined, content);
        
        ctx.log(`📊 [Debug] Pipeline completed!`);
        ctx.log(`   • Raw: ${filterResult.stats.totalRaw}`);
        ctx.log(`   • Filtered: ${filterResult.stats.totalFiltered} (-${filterResult.stats.discardedCount})`);
        ctx.log(`   • Deduplicated: ${filterResult.deduplicated.length} (-${filterResult.stats.deduplicatedCount})`);
        ctx.log(`   • Final: ${filterResult.stats.finalCount}`);
        ctx.log(`   • Compression: ${((1 - filterResult.stats.finalCount / filterResult.stats.totalRaw) * 100).toFixed(1)}%`);
        
        // Build response
        const response = {
          fileName,
          fileSize,
          mimeType,
          ast,
          // NOVO: Incluir todas as etapas do pipeline
          pipeline: {
            raw: filterResult.original,
            filtered: filterResult.filtered,
            deduplicated: filterResult.deduplicated,
            normalized: filterResult.normalized,
            staticEnriched: filterResult.staticEnriched, // ← NOVO: Enriquecimento estático
            enriched: filterResult.enriched,
            stats: filterResult.stats
          },
          // Legacy format (manter compatibilidade)
          entities: filterResult.enriched.map(e => ({
            type: e.type,
            name: e.name,
            source: e.source,
            category: e.category,
            confidence: e.confidence,
            relationships: e.relationships,
            packageInfo: e.packageInfo
          })),
          signatures,
          metadata: {
            lines: content.split('\n').length,
            characters: content.length,
            hasErrors: false,
            mode: 'pipeline-analysis',
            // Stats originais
            importsCount: analysis.imports.length,
            exportsCount: analysis.exports.length,
            callsCount: analysis.calls.length,
            typeRefsCount: analysis.typeRefs.length,
            // Stats do pipeline
            pipelineStats: {
              totalRaw: filterResult.stats.totalRaw,
              totalFiltered: filterResult.stats.totalFiltered,
              discardedCount: filterResult.stats.discardedCount,
              deduplicatedCount: filterResult.stats.deduplicatedCount,
              finalCount: filterResult.stats.finalCount,
              processingTimeMs: filterResult.stats.processingTimeMs,
              compressionRate: `${((1 - filterResult.stats.finalCount / filterResult.stats.totalRaw) * 100).toFixed(1)}%`
            }
          }
        };

        ctx.log(`📤 [Debug] Sending response with pipeline data...`);
        ctx.log(`   • Pipeline object keys: ${Object.keys(response.pipeline || {}).join(', ')}`);
        ctx.log(`   • Pipeline.raw length: ${response.pipeline?.raw?.length || 0}`);
        ctx.log(`   • Pipeline.enriched length: ${response.pipeline?.enriched?.length || 0}`);
        
        ctx.sendMessage({
          type: 'debug/analyze-result',
          payload: response
        });

        ctx.log(`✅ [Debug] Analysis complete for ${fileName}`);
      } finally {
        // Cleanup temp file
        try {
          await fsPromises.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      ctx.log(`❌ [Debug] Analysis error: ${error}`);
      ctx.sendMessage({
        type: 'debug/analyze-error',
        payload: {
          error: error instanceof Error ? error.message : 'Unknown error during analysis'
        }
      });
    }
  }

  private extractSignatures(ast: unknown): unknown[] {
    const signatures: unknown[] = [];
    
    const visit = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>;
      
      if (n.type === 'FunctionDeclaration' && n.id) {
        const id = n.id as Record<string, unknown>;
        const params = n.params as unknown[];
        signatures.push({
          type: 'function',
          name: id.name,
          params: params?.map((p: unknown) => {
            const param = p as Record<string, unknown>;
            return param.name || param.type;
          }) || [],
          async: n.async || false
        });
      } else if (n.type === 'ClassDeclaration' && n.id) {
        const id = n.id as Record<string, unknown>;
        const superClass = n.superClass as Record<string, unknown> | undefined;
        signatures.push({
          type: 'class',
          name: id.name,
          superClass: superClass?.name || null
        });
      } else if (n.type === 'VariableDeclaration') {
        const declarations = n.declarations as unknown[];
        declarations?.forEach((decl: unknown) => {
          const d = decl as Record<string, unknown>;
          const id = d.id as Record<string, unknown>;
          if (id?.name) {
            signatures.push({
              type: 'variable',
              name: id.name,
              kind: n.kind
            });
          }
        });
      }
      
      for (const key in n) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const value = n[key];
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (typeof value === 'object') {
          visit(value);
        }
      }
    };
    
    visit(ast);
    return signatures;
  }
}
