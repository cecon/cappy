import type { ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import { ASTHelpers } from "./ASTHelpers";

export class ConfidenceCalculator {
  /**
   * Calculate confidence score based on node and context
   */
  static calculate(
    node: ASTNode,
    _entityType: string,
    context: ExtractionContext
  ): number {
    let baseScore = 0.5;

    // Boost by node type
    const typeBoosts: Record<string, number> = {
      FunctionDeclaration: 0.3,
      ClassDeclaration: 0.3,
      ImportDeclaration: 0.4,
      VariableDeclarator: 0.2,
      CallExpression: -0.1,
      JSXElement: 0.25,
    };

    baseScore += typeBoosts[node.type] || 0;

    // Boost by type annotation
    if (ASTHelpers.hasTypeAnnotation(node)) {
      baseScore += 0.2;
    }

    // Boost by export
    const name = ASTHelpers.extractEntityName(node);
    if (name && context.exportedNames.has(name)) {
      baseScore += 0.1;
    }

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, baseScore));
  }
}
