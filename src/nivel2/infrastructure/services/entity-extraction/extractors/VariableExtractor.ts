import type { VariableDeclaratorNode, ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";
import { ConfidenceCalculator } from "../helpers/ConfidenceCalculator";

export class VariableExtractor {
  static extract(node: VariableDeclaratorNode, context: ExtractionContext): ASTEntity | null {
    const name = node.id?.name;
    if (!name) return null;

    // Check if it's a function assigned to a variable
    if (node.init?.type === "ArrowFunctionExpression" || node.init?.type === "FunctionExpression") {
      const params = ASTHelpers.extractParameters(node.init.params || []);
      const returnType = ASTHelpers.extractTypeAnnotation(node.init.returnType as ASTNode);

      return {
        name,
        type: "function",
        category: "internal",
        source: context.relFilePath,
        line: node.loc?.start?.line || 0,
        column: node.loc?.start?.column || 0,
        metadata: { params, returnType },
        parameters: params,
        returnType,
        isExported: context.exportedNames.has(name),
        exportType: context.exportedNames.has(name) ? "named" : undefined,
        confidence: ConfidenceCalculator.calculate(node as ASTNode, "function", context),
      };
    }

    // Regular variable
    const varType = ASTHelpers.extractTypeAnnotation(node.id?.typeAnnotation as ASTNode);
    const initialValue = ASTHelpers.extractInitialValue(node.init as ASTNode);

    return {
      name,
      type: "variable",
      category: "internal",
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      metadata: { varType, initialValue },
      initialValue,
      isExported: context.exportedNames.has(name),
      exportType: context.exportedNames.has(name) ? "named" : undefined,
      confidence: ConfidenceCalculator.calculate(node as ASTNode, "variable", context),
    };
  }
}
