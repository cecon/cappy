import type { ASTNode, ExportNamedDeclarationNode, NamedASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";
import { TypeInferrer } from "../helpers/TypeInferrer";

export class ExportExtractor {
  static extract(node: ASTNode, context: ExtractionContext): ASTEntity[] {
    const entities: ASTEntity[] = [];

    // export default ...
    if (node.type === "ExportDefaultDeclaration") {
      const decl = node.declaration as NamedASTNode | { name?: string; id?: { name?: string } } | undefined;
      const name = decl?.id?.name || decl?.name || "default";

      entities.push({
        name,
        type: TypeInferrer.fromNode(node.declaration as ASTNode),
        kind: "export", // AST node kind
        category: "internal",
        source: context.relFilePath,
        line: node.loc?.start?.line || 0,
        column: node.loc?.start?.column || 0,
        confidence: 0.95,
        isExported: true,
        exportType: "default",
      });
    }

    // export { x, y } or export const x = ...
    if (node.type === "ExportNamedDeclaration") {
      // Re-export: export { x } from './module'
      if ((node as ExportNamedDeclarationNode).source) {
        const source = (node as ExportNamedDeclarationNode).source?.value as string;
        const isExternal = ASTHelpers.isExternalImport(source);

        const specs = (node as ExportNamedDeclarationNode).specifiers;
        if (specs) {
          for (const spec of specs) {
            const name = spec.exported?.name;
            if (name) {
              entities.push({
                name,
                type: "other",
                kind: "export", // AST node kind
                category: isExternal ? "external" : "internal",
                source: context.relFilePath,
                line: node.loc?.start?.line || 0,
                column: node.loc?.start?.column || 0,
                confidence: 0.9,
                isExported: true,
                exportType: "re-export",
                originalModule: source,
              });
            }
          }
        }
      }
      // Named export
      else {
        const specs = (node as ExportNamedDeclarationNode).specifiers;
        if (specs) {
          for (const spec of specs) {
            const name = spec.exported?.name;
            if (name) {
              entities.push({
                name,
                type: "other",
                kind: "export", // AST node kind
                category: "internal",
                source: context.relFilePath,
                line: node.loc?.start?.line || 0,
                column: node.loc?.start?.column || 0,
                confidence: 0.95,
                isExported: true,
                exportType: "named",
              });
            }
          }
        }
      }
    }

    return entities;
  }
}
