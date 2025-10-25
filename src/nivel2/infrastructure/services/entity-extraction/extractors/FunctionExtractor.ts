import type { FunctionNode, ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";
import { ConfidenceCalculator } from "../helpers/ConfidenceCalculator";

export class FunctionExtractor {
  static extract(node: FunctionNode, context: ExtractionContext): ASTEntity | null {
    const name = node.id?.name;
    if (!name) return null;

    const params = ASTHelpers.extractParameters(node.params || []);
    const returnType = ASTHelpers.extractTypeAnnotation(node.returnType as ASTNode);

    return {
      name,
      type: "function",
      category: "internal",
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      metadata: { params, returnType },
      isExported: context.exportedNames.has(name),
      exportType: context.exportedNames.has(name) ? "named" : undefined,
      confidence: ConfidenceCalculator.calculate(node as ASTNode, "function", context),
    };
  }
}
