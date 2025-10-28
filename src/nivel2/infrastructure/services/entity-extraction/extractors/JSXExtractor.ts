import type { JSXElementNode, ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";
import { ConfidenceCalculator } from "../helpers/ConfidenceCalculator";

export class JSXExtractor {
  static extract(node: JSXElementNode, context: ExtractionContext): ASTEntity | null {
    const name = node.openingElement?.name?.name;
    if (!name) return null;

    const props = ASTHelpers.extractJSXProps(node.openingElement as ASTNode);
    const importInfo = context.importedSymbols.get(name);

    return {
      name,
      type: "component",
      category: importInfo ? (importInfo.isExternal ? "external" : "internal") : "jsx",
      source: importInfo?.source || context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      metadata: { props },
      isImported: !!importInfo,
      originalModule: importInfo?.source,
      confidence: ConfidenceCalculator.calculate(node as ASTNode, "component", context),
    };
  }
}
