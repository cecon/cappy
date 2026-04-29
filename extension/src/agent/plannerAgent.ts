import OpenAI from "openai";
import type { CappyConfig } from "../config";
import { buildPlannerRegenUserMessage, buildPlannerUserMessage, PLANNER_SYSTEM_PROMPT } from "./plannerPrompt";

/**
 * Calls the LLM once with the planner prompt to generate a spec.md from a user intent.
 * Returns the raw markdown content of the spec.
 */
export async function generatePlanSpec(intent: string, config: CappyConfig): Promise<string> {
  const client = buildClient(config);
  const response = await client.chat.completions.create({
    model: config.openrouter.model,
    messages: [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: buildPlannerUserMessage(intent) },
    ],
    stream: false,
  });

  const content = response.choices[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error("O modelo não retornou conteúdo para o spec.");
  }
  return content.trim();
}

/**
 * Calls the LLM to regenerate a spec after a user review, incorporating the review feedback.
 */
export async function regeneratePlanSpec(
  previousSpec: string,
  reviewReason: string,
  config: CappyConfig,
): Promise<string> {
  const client = buildClient(config);
  const response = await client.chat.completions.create({
    model: config.openrouter.model,
    messages: [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: buildPlannerRegenUserMessage(previousSpec, reviewReason) },
    ],
    stream: false,
  });

  const content = response.choices[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error("O modelo não retornou conteúdo para o spec revisado.");
  }
  return content.trim();
}

function buildClient(config: CappyConfig): OpenAI {
  if (!config.openrouter.apiKey.trim()) {
    throw new Error('Campo "openrouter.apiKey" inválido em ~/.cappy/config.json.');
  }
  if (!config.openrouter.model.trim()) {
    throw new Error('Campo "openrouter.model" inválido em ~/.cappy/config.json.');
  }
  return new OpenAI({
    apiKey: config.openrouter.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
}
