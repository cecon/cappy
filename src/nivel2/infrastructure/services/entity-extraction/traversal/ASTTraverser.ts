import type { ASTNode, ImportDeclarationNode, FunctionNode, VariableDeclaratorNode, JSXElementNode, CallExpressionNode, NamedASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ImportExtractor } from "../extractors/ImportExtractor";
import { FunctionExtractor } from "../extractors/FunctionExtractor";
import { VariableExtractor } from "../extractors/VariableExtractor";
import { JSXExtractor } from "../extractors/JSXExtractor";
import { CallExpressionExtractor } from "../extractors/CallExpressionExtractor";
import { ClassExtractor } from "../extractors/ClassExtractor";
import { InterfaceExtractor } from "../extractors/InterfaceExtractor";
import { TypeAliasExtractor } from "../extractors/TypeAliasExtractor";
import { ExportExtractor } from "../extractors/ExportExtractor";

export class ASTTraverser {
  /**
   * Traverse AST and extract all entities
   */
  static traverse(node: ASTNode, context: ExtractionContext): ASTEntity[] {
    const entities: ASTEntity[] = [];
    this.traverseRecursive(node, context, entities);
    return entities;
  }

  private static traverseRecursive(
    node: ASTNode,
    context: ExtractionContext,
    entities: ASTEntity[]
  ): void {
    if (!node) return;

    // Delegate to specialized extractors
    const extracted = this.extractFromNode(node, context);
    entities.push(...extracted);

    // Recursively traverse children
    for (const key in node) {
      if (key !== "parent" && typeof node[key] === "object") {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            if (child && typeof child === "object") {
              this.traverseRecursive(child as ASTNode, context, entities);
            }
          }
        } else if (node[key] !== null) {
          this.traverseRecursive(node[key] as ASTNode, context, entities);
        }
      }
    }
  }

  private static extractFromNode(node: ASTNode, context: ExtractionContext): ASTEntity[] {
    switch (node.type) {
      case "ImportDeclaration":
        return ImportExtractor.extract(node as ImportDeclarationNode, context);
      
      case "FunctionDeclaration": {
        const func = FunctionExtractor.extract(node as FunctionNode, context);
        return func ? [func] : [];
      }
      
      case "VariableDeclarator": {
        const variable = VariableExtractor.extract(node as VariableDeclaratorNode, context);
        return variable ? [variable] : [];
      }
      
      case "JSXElement": {
        const jsx = JSXExtractor.extract(node as JSXElementNode, context);
        return jsx ? [jsx] : [];
      }
      
      case "CallExpression":
        return CallExpressionExtractor.extract(node as CallExpressionNode, context);
      
      case "ClassDeclaration": {
        const cls = ClassExtractor.extract(node as NamedASTNode, context);
        return cls ? [cls] : [];
      }
      
      case "TSInterfaceDeclaration": {
        const iface = InterfaceExtractor.extract(node as NamedASTNode, context);
        return iface ? [iface] : [];
      }
      
      case "TSTypeAliasDeclaration": {
        const typeAlias = TypeAliasExtractor.extract(node as NamedASTNode, context);
        return typeAlias ? [typeAlias] : [];
      }
      
      case "ExportDefaultDeclaration":
      case "ExportNamedDeclaration":
        return ExportExtractor.extract(node, context);
      
      default:
        return [];
    }
  }
}
