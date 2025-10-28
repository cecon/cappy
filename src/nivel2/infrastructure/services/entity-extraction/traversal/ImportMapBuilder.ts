import type { ASTNode, ImportDeclarationNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import { ASTHelpers } from "../helpers/ASTHelpers";

export class ImportMapBuilder {
  /**
   * Build map of imported symbols from AST
   */
  static build(node: ASTNode, context: ExtractionContext): void {
    this.buildRecursive(node, context);
  }

  private static buildRecursive(node: ASTNode, context: ExtractionContext): void {
    if (!node) return;

    if (node.type === "ImportDeclaration") {
      const importNode = node as ImportDeclarationNode;
      const source = importNode.source?.value;
      if (source && importNode.specifiers) {
        const isExternal = ASTHelpers.isExternalImport(source);
        for (const spec of importNode.specifiers) {
          const name = spec.imported?.name || spec.local?.name;
          if (name) {
            context.importedSymbols.set(name, { source, isExternal });
          }
        }
      }
    }

    // Recursively traverse
    for (const key in node) {
      if (key !== "parent" && typeof node[key] === "object") {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            if (child && typeof child === "object") {
              this.buildRecursive(child as ASTNode, context);
            }
          }
        } else if (node[key] !== null) {
          this.buildRecursive(node[key] as ASTNode, context);
        }
      }
    }
  }
}
