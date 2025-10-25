import type { ASTNode, ExportDefaultDeclarationNode, ExportNamedDeclarationNode } from "../ast-types/ASTNodeTypes";

export class ExportCollector {
  /**
   * Collect all exported entity names from AST
   */
  static collect(node: ASTNode): Set<string> {
    const exportedNames = new Set<string>();
    this.collectRecursive(node, exportedNames);
    return exportedNames;
  }

  private static collectRecursive(node: ASTNode, exportedNames: Set<string>): void {
    if (!node || typeof node !== "object") return;

    // Handle export declarations
    if (node.type === "ExportDefaultDeclaration") {
      this.handleExportDefault(node as ExportDefaultDeclarationNode, exportedNames);
    } else if (node.type === "ExportNamedDeclaration") {
      this.handleExportNamed(node as ExportNamedDeclarationNode, exportedNames);
    }

    // Recursively traverse
    for (const key in node) {
      if (key !== "parent" && typeof node[key] === "object") {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            if (child && typeof child === "object") {
              this.collectRecursive(child as ASTNode, exportedNames);
            }
          }
        } else if (node[key] !== null) {
          this.collectRecursive(node[key] as ASTNode, exportedNames);
        }
      }
    }
  }

  private static handleExportDefault(node: ExportDefaultDeclarationNode, exportedNames: Set<string>): void {
    const declaration = node.declaration as any;
    if (declaration?.id?.name) {
      exportedNames.add(declaration.id.name);
    } else if (declaration?.name) {
      exportedNames.add(declaration.name);
    }
  }

  private static handleExportNamed(node: ExportNamedDeclarationNode, exportedNames: Set<string>): void {
    // Export with declaration: export const x = ...
    const declaration = node.declaration as any;
    if (declaration?.declarations) {
      for (const decl of declaration.declarations) {
        if (decl.id?.name) {
          exportedNames.add(decl.id.name);
        }
      }
    }
    if (declaration?.id?.name) {
      exportedNames.add(declaration.id.name);
    }

    // Export with specifiers: export { x, y }
    if (node.specifiers) {
      for (const spec of node.specifiers) {
        if (spec.exported?.name) {
          exportedNames.add(spec.exported.name);
        }
      }
    }
  }
}
