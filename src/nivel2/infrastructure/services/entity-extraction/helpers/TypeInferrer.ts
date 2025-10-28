import type { EntityType } from "../../../../../shared/types/entity";
import type { ASTNode } from "../ast-types/ASTNodeTypes";

export class TypeInferrer {
  /**
   * Infer entity type from name pattern
   */
  static fromName(name: string): EntityType {
    if (/^use[A-Z]/.test(name)) return "function"; // React hooks
    if (/^[A-Z]/.test(name)) return "component"; // Components or classes
    return "other";
  }

  /**
   * Infer entity type from AST node
   */
  static fromNode(node: ASTNode): EntityType {
    if (!node) return "other";

    if (
      node.type === "FunctionDeclaration" ||
      node.type === "ArrowFunctionExpression"
    ) {
      return "function";
    }
    if (node.type === "ClassDeclaration") {
      return "class";
    }
    if (node.type === "Identifier") {
      const name = (node as { name?: string }).name;
      if (typeof name === "string" && /^[A-Z]/.test(name)) {
        return "component";
      }
    }

    return "other";
  }
}
