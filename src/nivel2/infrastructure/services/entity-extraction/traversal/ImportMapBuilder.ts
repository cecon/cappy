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

    // Static import declarations
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

    // Dynamic imports: import('./module') or import(`./module`)
    if (node.type === "CallExpression" || node.type === "ImportExpression") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callNode = node as any;
      
      // Check for import() dynamic imports
      if (callNode.callee?.type === "Import" || node.type === "ImportExpression") {
        const source = this.extractDynamicImportSource(callNode);
        if (source) {
          const isExternal = ASTHelpers.isExternalImport(source);
          // Use a special marker for dynamic imports
          const dynamicKey = `__dynamic__${source}`;
          context.importedSymbols.set(dynamicKey, { 
            source, 
            isExternal,
            isDynamic: true,
            method: 'import'
          });
        }
      }
      
      // Check for require() calls
      if (callNode.callee?.name === "require" || callNode.callee?.property?.name === "require") {
        const source = this.extractDynamicImportSource(callNode);
        if (source) {
          const isExternal = ASTHelpers.isExternalImport(source);
          const dynamicKey = `__require__${source}`;
          context.importedSymbols.set(dynamicKey, { 
            source, 
            isExternal,
            isDynamic: true,
            method: 'require'
          });
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

  /**
   * Extract the source path from a dynamic import/require call
   * Handles: import('path'), require('path'), import(`path`), require(`path`)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static extractDynamicImportSource(callNode: any): string | null {
    // Get the first argument
    const args = callNode.arguments;
    if (!args || args.length === 0) return null;

    const firstArg = args[0];

    // String literal: import('path') or require('path')
    if (firstArg.type === "Literal" && typeof firstArg.value === "string") {
      return firstArg.value;
    }

    // Template literal with no expressions: import(`path`)
    if (firstArg.type === "TemplateLiteral") {
      // Only handle simple template literals without expressions
      if (firstArg.expressions?.length === 0 && firstArg.quasis?.length === 1) {
        return firstArg.quasis[0].value.raw || firstArg.quasis[0].value.cooked;
      }
      
      // For template literals with expressions, try to extract the base path
      // Example: import(`./plugins/${name}`) -> './plugins/'
      if (firstArg.quasis?.length > 0) {
        const firstPart = firstArg.quasis[0].value.raw || firstArg.quasis[0].value.cooked;
        if (firstPart && (firstPart.startsWith('./') || firstPart.startsWith('../'))) {
          return `${firstPart}*`; // Mark as pattern
        }
      }
    }

    return null;
  }
}
