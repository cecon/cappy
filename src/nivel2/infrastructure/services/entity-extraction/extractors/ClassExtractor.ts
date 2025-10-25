import type { NamedASTNode, ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ConfidenceCalculator } from "../helpers/ConfidenceCalculator";

export class ClassExtractor {
  static extract(node: NamedASTNode, context: ExtractionContext): ASTEntity | null {
    const name = node.id?.name;
    if (!name) return null;

    return {
      name,
      type: "class",
      category: "internal",
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      isExported: context.exportedNames.has(name),
      exportType: context.exportedNames.has(name) ? "named" : undefined,
      confidence: ConfidenceCalculator.calculate(node as ASTNode, "class", context),
    };
  }
}
