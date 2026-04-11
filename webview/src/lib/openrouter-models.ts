/** Endpoint público de modelos OpenRouter (lista para selects na UI). */
export const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

/** Lista mínima quando a API não responde. */
export const FALLBACK_MODEL_OPTIONS = [
  "openai/gpt-oss-120b",
  "anthropic/claude-opus-4-5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-r1",
] as const;

export interface LoadOpenRouterModelsCallbacks {
  onStart: () => void;
  onSuccess: (models: string[]) => void;
  onError: () => void;
  onFinally: () => void;
}

/**
 * Carrega IDs de modelos a partir do endpoint público OpenRouter.
 */
export async function loadOpenRouterModels(callbacks: LoadOpenRouterModelsCallbacks): Promise<void> {
  callbacks.onStart();
  try {
    const response = await fetch(OPENROUTER_MODELS_ENDPOINT);
    if (!response.ok) {
      callbacks.onError();
      return;
    }
    const payload = (await response.json()) as unknown;
    const models = extractModelIds(payload);
    if (models.length === 0) {
      callbacks.onError();
      return;
    }
    callbacks.onSuccess(models);
  } catch {
    callbacks.onError();
  } finally {
    callbacks.onFinally();
  }
}

/**
 * Extrai e ordena IDs de modelos de um payload desconhecido.
 */
export function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return [];
  }
  const modelIds = payload.data
    .map((model) => {
      if (!isRecord(model) || typeof model.id !== "string") {
        return null;
      }
      return model.id;
    })
    .filter((modelId): modelId is string => Boolean(modelId));
  const uniqueModelIds = Array.from(new Set(modelIds));
  return uniqueModelIds.sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
