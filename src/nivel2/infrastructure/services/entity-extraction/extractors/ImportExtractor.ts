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
    if (!source) return entities;

    const isExternal = ASTHelpers.isExternalImport(source);
    const specifiers = (node.specifiers || [])
      .map((s) => s.imported?.name || s.local?.name)
      .filter((n): n is string => !!n);

    // Emit a package-level entity representing the module
    entities.push({
      name: source,
      type: "package",
      kind: "import",
      category: isExternal ? "external" : "internal",
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      confidence: 1,
      specifiers,
    });

    // Emit individual specifier entities with relationship to the package/module
    for (const specName of specifiers) {
      entities.push({
        name: specName,
        type: TypeInferrer.fromName(specName),
        kind: "import",
        category: isExternal ? "external" : "internal",
        source: context.relFilePath,
        line: node.loc?.start?.line || 0,
        column: node.loc?.start?.column || 0,
        confidence: ConfidenceCalculator.calculate(node, "import", context),
        originalModule: source,
        relationships: [{ target: source, type: "imports" }],
      });
    }

    return entities;
  }
}
