import OpenAI from "openai";

import type { ToolJsonSchema } from "./types";

const MAX_RAW_SNIPPET = 6_000;
const MAX_SCHEMA_SNIPPET = 2_000;

/**
 * Remove cercas Markdown do texto devolvido pelo modelo.
 */
function stripCodeFence(text: string): string {
  const normalized = text.trim();
  if (!normalized.startsWith("```")) {
    return normalized;
  }
  return normalized
    .replace(/^```[a-zA-Z]*\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

/**
 * Extrai o primeiro fragmento que parece um objeto JSON.
 */
function extractFirstJsonObject(text: string): string | null {
  const stripped = stripCodeFence(text);
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  return stripped.slice(start, end + 1).trim();
}

/**
 * Resume o schema da tool para o prompt de recuperação (evita enviar ficheiros enormes).
 */
function summarizeParameters(parameters: ToolJsonSchema | undefined): string {
  if (!parameters?.properties || typeof parameters.properties !== "object") {
    return "(schema não disponível)";
  }
  const keys = Object.keys(parameters.properties);
  const required = Array.isArray(parameters.required) ? parameters.required : [];
  const raw = JSON.stringify(
    {
      required,
      properties: parameters.properties,
    },
    null,
    2,
  );
  if (raw.length <= MAX_SCHEMA_SNIPPET) {
    return raw;
  }
  return `${raw.slice(0, MAX_SCHEMA_SNIPPET)}…\n(truncado)`;
}

/**
 * Um pedido LLM curto e determinístico para corrigir argumentos JSON de uma tool quando o parse local falhou.
 *
 * @returns Texto JSON válido para voltar a passar por `parseToolArguments`, ou `null` se não for possível.
 */
export async function recoverToolArgumentsWithLlm(
  client: OpenAI,
  model: string,
  toolName: string,
  rawArgumentsText: string,
  parseErrorMessage: string,
  parameters: ToolJsonSchema | undefined,
): Promise<string | null> {
  const raw = rawArgumentsText.length > MAX_RAW_SNIPPET ? `${rawArgumentsText.slice(0, MAX_RAW_SNIPPET)}…` : rawArgumentsText;
  const schemaHint = summarizeParameters(parameters);

  const userPrompt = [
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
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 2_048,
      messages: [
        {
          role: "system",
          content:
            "You fix malformed tool-call arguments. Reply with a single JSON object only — no markdown fences, no commentary. " +
            "Keys must match the tool schema. Use ASCII double quotes for JSON strings.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (typeof text !== "string" || text.trim().length === 0) {
      return null;
    }

    const candidate = extractFirstJsonObject(text);
    if (!candidate) {
      return null;
    }

    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}
