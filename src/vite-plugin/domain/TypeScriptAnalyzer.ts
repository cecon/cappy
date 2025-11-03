import path from "node:path";
import type { ICodeAnalyzer, AnalysisResult } from "../ports/IAnalyzer";
import type { IFileSystem } from "../ports/IFileSystem";
import type { RawEntity } from "../../nivel2/infrastructure/services/entity-filtering/types/FilterTypes";
import type { DocumentChunk } from "../../shared/types/chunk";

/**
 * Domain Service: Analisador de código TypeScript/JavaScript
 */
export class TypeScriptAnalyzer implements ICodeAnalyzer {
  private readonly workspaceRoot: string;

  constructor(_fileSystem: IFileSystem, workspaceRoot: string) {
    // fileSystem parameter kept for interface compatibility but not used
    this.workspaceRoot = workspaceRoot;
  }

  getSupportedExtensions(): string[] {
    return [".ts", ".tsx", ".js", ".jsx"];
  }

  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    const { parse } = await import("@typescript-eslint/parser");
    const { ASTRelationshipExtractor } = await import(
      "../../nivel2/infrastructure/services/ast-relationship-extractor.js"
    );

    const ast = parse(content, {
      loc: true,
      range: true,
      comment: true,
      tokens: false,
      ecmaVersion: "latest" as const,
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    });

    const extractor = new ASTRelationshipExtractor(this.workspaceRoot);
    const analysis = await extractor.analyze(filePath);
    const signatures = this.extractSignatures(ast);
    const jsdocChunks = this.extractJSDocChunks(ast, path.basename(filePath));

    console.log(`📝 [TypeScriptAnalyzer] JSDoc chunks extracted: ${jsdocChunks.length}`);

    const rawEntities: RawEntity[] = [
      ...analysis.imports.map((imp) => ({
        type: "import" as const,
        name: imp.source,
        source: filePath,
        specifiers: imp.specifiers || [],
        metadata: {
          isExternal: imp.isExternal,
          packageResolution: imp.packageResolution,
        },
      })),
      ...analysis.exports.map((expName) => ({
        type: "export" as const,
        name: expName,
        source: filePath,
        specifiers: [],
        metadata: {
          isExternal: false,
        },
      })),
      ...analysis.calls.map((callName) => ({
        type: "call" as const,
        name: callName,
        source: filePath,
        specifiers: [],
        metadata: {
          isExternal: false,
        },
      })),
      ...analysis.typeRefs.map((typeRefName) => ({
        type: "typeRef" as const,
        name: typeRefName,
        source: filePath,
        specifiers: [],
        metadata: {
          isExternal: false,
        },
      })),
    ];

    console.log(`📊 [TypeScriptAnalyzer] Raw entities extracted: ${rawEntities.length}`);

    const counts = { imports: 0, exports: 0, calls: 0, typeRefs: 0 };
    for (const entity of rawEntities) {
      if (entity.type === "import") counts.imports++;
      else if (entity.type === "export") counts.exports++;
      else if (entity.type === "call") counts.calls++;
      else if (entity.type === "typeRef") counts.typeRefs++;
    }

    return {
      ast,
      rawEntities,
      signatures,
      jsdocChunks,
      metadata: {
        lines: content.split("\n").length,
        characters: content.length,
        importsCount: counts.imports,
        exportsCount: counts.exports,
        callsCount: counts.calls,
        typeRefsCount: counts.typeRefs,
      },
    };
  }

  private extractSignatures(ast: unknown): unknown[] {
    const signatures: unknown[] = [];

    const addFunction = (n: Record<string, unknown>) => {
      const id = n.id as Record<string, unknown> | undefined;
      if (!id) return;
      const params = (n.params as unknown[]) || [];
      signatures.push({
        type: "function",
        name: id.name,
        params: params.map((p: unknown) => {
          const param = p as Record<string, unknown>;
          return param.name || param.type;
        }),
        async: Boolean(n.async),
      });
    };

    const addClass = (n: Record<string, unknown>) => {
      const id = n.id as Record<string, unknown> | undefined;
      if (!id) return;
      const superClass = n.superClass as Record<string, unknown> | undefined;
      signatures.push({
        type: "class",
        name: id.name,
        superClass: superClass?.name || null,
      });
    };

    const addVariables = (n: Record<string, unknown>) => {
      const declarations = n.declarations as unknown[] | undefined;
      if (!Array.isArray(declarations)) return;
      for (const decl of declarations) {
        const d = decl as Record<string, unknown>;
        const id = d.id as Record<string, unknown>;
        if (id?.name) {
          signatures.push({
            type: "variable",
            name: id.name,
            kind: n.kind,
          });
        }
      }
    };

    const traverseChildren = (n: Record<string, unknown>) => {
      for (const key in n) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        const value = n[key];
        if (Array.isArray(value)) {
          for (const v of value) visit(v);
        } else if (value && typeof value === "object") {
          visit(value);
        }
      }
    };

    const visit = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      const type = n.type as string | undefined;

      if (type === "FunctionDeclaration") addFunction(n);
      else if (type === "ClassDeclaration") addClass(n);
      else if (type === "VariableDeclaration") addVariables(n);

      traverseChildren(n);
    };

    visit(ast);
    return signatures;
  }

  private extractJSDocChunks(ast: unknown, fileName: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    const addChunk = (
      file: string,
      content: string,
      loc?: { start?: { line?: number }; end?: { line?: number } },
      symbolName?: string
    ) => {
      chunks.push({
        id: `jsdoc:${file}:${symbolName || chunks.length}`,
        content: `/**${content}*/`,
        metadata: {
          filePath: file,
          lineStart: loc?.start?.line || 0,
          lineEnd: loc?.end?.line || 0,
          chunkType: "jsdoc",
          symbolName,
        },
      });
    };

    const processLeadingComments = (n: Record<string, unknown>, parentName?: string) => {
      const comments = n.leadingComments as unknown;
      if (!Array.isArray(comments)) return;
      for (const comment of comments) {
        const c = comment as Record<string, unknown>;
        if (c.type !== "CommentBlock" || typeof c.value !== "string") continue;
        const value = c.value.trim();
        if (!value.startsWith("*")) continue;
        const symbolName = parentName || this.extractSymbolName(n);
        const loc = c.loc as { start?: { line?: number }; end?: { line?: number } } | undefined;
        addChunk(fileName, value, loc, symbolName);
      }
    };

    const traverseNodeChildren = (n: Record<string, unknown>, parentName?: string) => {
      for (const key in n) {
        if (key === "parent" || key === "loc" || key === "range" || key === "leadingComments") {
          continue;
        }
        const value = n[key];
        const currentName = this.extractSymbolName(n) || parentName;
        if (Array.isArray(value)) {
          for (const child of value) visit(child, currentName);
        } else if (value && typeof value === "object") {
          visit(value, currentName);
        }
      }
    };

    const visit = (node: unknown, parentName?: string): void => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      processLeadingComments(n, parentName);
      traverseNodeChildren(n, parentName);
    };

    visit(ast);
    return chunks;
  }

  private extractSymbolName(node: Record<string, unknown>): string | undefined {
    if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
      const id = node.id as Record<string, unknown> | undefined;
      return id?.name as string | undefined;
    }
    if (node.type === "VariableDeclarator") {
      const id = node.id as Record<string, unknown> | undefined;
      return id?.name as string | undefined;
    }
    return undefined;
  }
}
