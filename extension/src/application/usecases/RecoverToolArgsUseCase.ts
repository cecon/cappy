/**
 * Use case: attempt LLM-based recovery of malformed tool JSON arguments.
 * Extracted from toolArgumentRecovery.ts. Depends only on ILlmProvider.
 */

import type { ILlmProvider } from "../../domain/ports/ILlmProvider";

const MAX_RAW_SNIPPET = 6_000;
const MAX_SCHEMA_SNIPPET = 2_000;
const MAX_COMPLETION_TOKENS = 2_048;

const RECOVERY_SYSTEM =
  "You fix malformed tool-call arguments. Reply with a single JSON object only — no markdown fences, no commentary. " +
  "Keys must match the tool schema. Use ASCII double quotes for JSON strings.";

export class RecoverToolArgsUseCase {
  constructor(private readonly llm: ILlmProvider) {}

  /**
   * Asks the LLM to repair a broken JSON argument string.
   * Returns valid JSON text, or null if recovery was not possible.
   */
  async execute(
    model: string,
    toolName: string,
    rawArgumentsText: string,
    parseErrorMessage: string,
    parameters: Record<string, unknown> | undefined,
  ): Promise<string | null> {
    const raw = rawArgumentsText.length > MAX_RAW_SNIPPET
      ? `${rawArgumentsText.slice(0, MAX_RAW_SNIPPET)}…`
      : rawArgumentsText;

    const schemaHint = summarizeSchema(parameters);

    const userContent = [
      `Tool name: ${toolName}`,
      `Parse error: ${parseErrorMessage}`,
      "",
      "Expected JSON schema (reference):",
      schemaHint,
      "",
      "Broken / raw arguments from the model (fix into one JSON object only):",
      raw,
    ].join("\n");

    try {
      const chunks: string[] = [];
      for await (const chunk of this.llm.stream({
        model,
        systemMessages: [RECOVERY_SYSTEM],
        messages: [{ role: "user", content: userContent }],
        tools: [],
      })) {
        if (chunk.textDelta) chunks.push(chunk.textDelta);
      }

      const text = chunks.join("").trim();
      if (!text) return null;

      const candidate = extractFirstJsonObject(text);
      if (!candidate) return null;

      // Validate it parses cleanly before returning
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function summarizeSchema(parameters: Record<string, unknown> | undefined): string {
  const props = parameters?.properties;
  if (!props || typeof props !== "object") return "(schema não disponível)";
  const required = Array.isArray(parameters.required) ? parameters.required : [];
  const raw = JSON.stringify({ required, properties: props }, null, 2);
  return raw.length <= MAX_SCHEMA_SNIPPET ? raw : `${raw.slice(0, MAX_SCHEMA_SNIPPET)}…\n(truncado)`;
}

function extractFirstJsonObject(text: string): string | null {
  const stripped = stripCodeFence(text);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return stripped.slice(start, end + 1).trim();
}

function stripCodeFence(text: string): string {
  const s = text.trim();
  if (!s.startsWith("```")) return s;
  return s.replace(/^```[a-zA-Z]*\s*/u, "").replace(/\s*```$/u, "").trim();
}
