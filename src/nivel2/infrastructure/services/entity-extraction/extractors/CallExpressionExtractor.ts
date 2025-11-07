import type { CallExpressionNode, ASTNode } from "../ast-types/ASTNodeTypes";
import type { ExtractionContext } from "../types/ExtractionContext";
import type { ASTEntity } from "../types/ASTEntity";
import { ASTHelpers } from "../helpers/ASTHelpers";

export class CallExpressionExtractor {
  static extract(node: CallExpressionNode, context: ExtractionContext): ASTEntity[] {
    const entities: ASTEntity[] = [];
    const callName = ASTHelpers.extractCallName(node.callee as ASTNode);
    if (!callName) return entities;

    // Sempre adicionar a chamada de função
    entities.push({
      name: callName,
      type: "function",
      kind: "call", // AST node kind
      category: callName.startsWith("console.") ? "builtin" : "internal",
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      confidence: 0.8,
    });

    // Extract arguments (for literals, errors, logs, etc.)
    const args = node.arguments || [];
    const literals: string[] = [];

    for (const arg of args) {
      if (arg.type === "Literal" && typeof arg.value === "string") {
        literals.push(arg.value);
      }
    }

    // Log calls
    if (callName.includes("log") || callName.includes("console")) {
      for (const literal of literals) {
        entities.push({
          name: `log:${literal.slice(0, 50)}`,
          type: "other",
          kind: "call",
          category: "internal",
          source: context.relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          metadata: { callName, message: literal },
          confidence: 0.6,
        });
      }
    }

    // Error calls
    if (callName.includes("Error") || callName.includes("throw")) {
      for (const literal of literals) {
        entities.push({
          name: `error:${literal.slice(0, 50)}`,
          type: "other",
          kind: "call",
          category: "internal",
          source: context.relFilePath,
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          metadata: { callName, message: literal },
          confidence: 0.7,
        });
      }
    }

    return entities;
  }
}
