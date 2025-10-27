import type { ICodeAnalyzer, AnalysisResult } from "../ports/IAnalyzer";
import type { RawEntity } from "../../nivel2/infrastructure/services/entity-filtering/types/FilterTypes";
import type { DocumentChunk } from "../../shared/types/chunk";

/**
 * Domain Service: Analisador de código PHP
 */
export class PHPAnalyzer implements ICodeAnalyzer {
  constructor(
  ) {}

  getSupportedExtensions(): string[] {
    return [".php"];
  }

  async analyze(filePath: string): Promise<AnalysisResult> {
    const { PHPParser } = await import(
      "../../nivel2/infrastructure/parsers/php-parser.js"
    );

    const phpParser = new PHPParser();
    const phpAnalysis = await phpParser.analyze(filePath);
    const phpChunks = await phpParser.parseFile(filePath);
    const jsdocChunks: DocumentChunk[] = phpChunks;

    console.log(`📝🐘 [PHPAnalyzer] PHPDoc chunks extracted: ${phpChunks.length}`);
    console.log(
      `📊 [PHPAnalyzer] Analysis: ${phpAnalysis.classes.length} classes, ${phpAnalysis.interfaces.length} interfaces, ${phpAnalysis.traits.length} traits, ${phpAnalysis.functions.length} functions`
    );

    const rawEntities: RawEntity[] = [];

    // Classes
    for (const cls of phpAnalysis.classes) {
      rawEntities.push({
        type: "export" as const,
        name: cls.name,
        source: filePath,
        specifiers: [],
        scope: "module" as const,
        metadata: {
          symbolKind: "class",
          fullName: cls.fullName,
          extends: cls.extends,
          implements: cls.implements,
          isAbstract: cls.isAbstract,
          isFinal: cls.isFinal,
        },
      });

      for (const method of cls.methods) {
        rawEntities.push({
          type: "export" as const,
          name: `${cls.name}::${method.name}`,
          source: filePath,
          specifiers: [],
          scope: "module" as const,
          isPrivate: method.visibility !== "public",
          metadata: {
            symbolKind: "method",
            visibility: method.visibility,
            isStatic: method.isStatic,
            className: cls.name,
          },
        });
      }

      for (const prop of cls.properties) {
        rawEntities.push({
          type: "export" as const,
          name: `${cls.name}::$${prop.name}`,
          source: filePath,
          specifiers: [],
          scope: "module" as const,
          isPrivate: prop.visibility !== "public",
          metadata: {
            symbolKind: "property",
            visibility: prop.visibility,
            type: prop.type,
            className: cls.name,
          },
        });
      }
    }

    // Interfaces
    for (const iface of phpAnalysis.interfaces) {
      rawEntities.push({
        type: "export" as const,
        name: iface.name,
        source: filePath,
        specifiers: [],
        scope: "module" as const,
        metadata: {
          symbolKind: "interface",
          fullName: iface.fullName,
          extends: iface.extends,
        },
      });
    }

    // Traits
    for (const trait of phpAnalysis.traits) {
      rawEntities.push({
        type: "export" as const,
        name: trait.name,
        source: filePath,
        specifiers: [],
        scope: "module" as const,
        metadata: {
          symbolKind: "trait",
          fullName: trait.fullName,
        },
      });
    }

    // Functions
    for (const func of phpAnalysis.functions) {
      rawEntities.push({
        type: "export" as const,
        name: func.name,
        source: filePath,
        specifiers: [],
        scope: "module" as const,
        metadata: {
          symbolKind: "function",
          returnType: func.returnType,
          parameters: func.parameters,
        },
      });
    }

    // Uses (imports)
    for (const use of phpAnalysis.uses) {
      rawEntities.push({
        type: "import" as const,
        name: use.fullName,
        source: use.fullName,
        specifiers: [use.alias],
        scope: "module" as const,
        metadata: {
          alias: use.alias,
          isExternal: true,
        },
      });
    }

    console.log(`📊 [PHPAnalyzer] Raw entities extracted: ${rawEntities.length}`);

    return {
      ast: undefined,
      rawEntities,
      signatures: [phpAnalysis],
      jsdocChunks,
      metadata: {
        lines: 0,
        characters: 0,
        importsCount: phpAnalysis.uses.length,
        exportsCount: rawEntities.filter(e => e.type === "export").length,
        callsCount: 0,
        typeRefsCount: 0,
      },
    };
  }
}
