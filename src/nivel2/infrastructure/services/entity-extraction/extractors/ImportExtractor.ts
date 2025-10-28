import type { ImportDeclarationNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";
import { TypeInferrer } from "../helpers/TypeInferrer";
import { ConfidenceCalculator } from "../helpers/ConfidenceCalculator";

export class ImportExtractor {
  static extract(node: ImportDeclarationNode, context: ExtractionContext): ASTEntity[] {
    const entities: ASTEntity[] = [];
    const source = node.source?.value;
    if (!source || !node.specifiers) return entities;

    const isExternal = ASTHelpers.isExternalImport(source);

    for (const spec of node.specifiers) {
      const name = spec.imported?.name || spec.local?.name;
      if (!name) continue;

      entities.push({
        name,
        type: TypeInferrer.fromName(name),
        kind: "import", // AST node kind
        category: isExternal ? "external" : "internal",
        source: isExternal ? source : context.relFilePath,
        line: node.loc?.start?.line || 0,
        column: node.loc?.start?.column || 0,
        confidence: ConfidenceCalculator.calculate(node, "import", context),
        originalModule: source,
      });
    }

    return entities;
  }
}
