import type { JSXElementNode, ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity, ASTEntityCategory } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";

export class JSXExtractor {
  static extract(node: JSXElementNode, context: ExtractionContext): ASTEntity | null {
    const name = node.openingElement?.name?.name;
    if (!name) return null;

    const props = ASTHelpers.extractJSXProps(node.openingElement as ASTNode);
    const importInfo = context.importedSymbols.get(name);
    const category = JSXExtractor.determineCategory(importInfo);

    return {
      name,
      type: "component",
      category,
      source: importInfo?.source || context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      metadata: { props },
      props,
      isImported: !!importInfo,
      originalModule: importInfo?.source,
      confidence: 0
    };
  }

  private static determineCategory(importInfo?: import("../types/ExtractionContext").ImportInfo): ASTEntityCategory {
    if (!importInfo) return "jsx";
    return importInfo.isExternal ? "external" : "internal";
  }
}
