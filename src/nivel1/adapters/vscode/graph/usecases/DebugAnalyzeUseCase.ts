import type { UseCase, UseCaseContext, WebviewMessage } from './UseCase';
import { ASTRelationshipExtractor } from '../../../../../nivel2/infrastructure/services/ast-relationship-extractor';
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
        const analysis = await extractor.analyze(tempFilePath);
        
        // Extract signatures
        const signatures = this.extractSignatures(ast);
        
        // Build response
        const response = {
          fileName,
          fileSize,
          mimeType,
          ast,
          entities: [
            ...analysis.imports.map(imp => ({
              type: 'import',
              source: imp.source,
              specifiers: imp.specifiers,
              isExternal: imp.isExternal,
              packageResolution: imp.packageResolution
            })),
            ...analysis.exports.map(exp => ({
              type: 'export',
              name: exp
            })),
            ...analysis.calls.map(call => ({
              type: 'call',
              name: call
            })),
            ...analysis.typeRefs.map(ref => ({
              type: 'typeRef',
              name: ref
            }))
          ],
          signatures,
          metadata: {
            lines: content.split('\n').length,
            characters: content.length,
            hasErrors: false,
            mode: 'backend-analysis',
            importsCount: analysis.imports.length,
            exportsCount: analysis.exports.length,
            callsCount: analysis.calls.length,
            typeRefsCount: analysis.typeRefs.length
          }
        };

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
