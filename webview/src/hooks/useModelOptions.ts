/**
 * Hook: loads available model IDs from the OpenRouter public API.
 * Returns a merged list that always includes the currently-selected model.
 */

import { useEffect, useMemo, useState } from "react";
import { FALLBACK_MODEL_OPTIONS, loadOpenRouterModels } from "../lib/openrouter-models";

/**
 * Fetches OpenRouter model list once on mount.
 * Falls back to FALLBACK_MODEL_OPTIONS on network failure.
 * Ensures currentModel is always present even if absent from the fetched list.
 */
export function useModelOptions(currentModel: string | undefined): string[] {
  const [modelList, setModelList] = useState<string[]>([...FALLBACK_MODEL_OPTIONS]);

  useEffect(() => {
    let disposed = false;
    void loadOpenRouterModels({
      onStart: () => {},
      onSuccess: (models) => { if (!disposed) setModelList(models); },
      onError: () => { /* keeps FALLBACK_MODEL_OPTIONS */ },
      onFinally: () => {},
    });
    return () => { disposed = true; };
  }, []);

  return useMemo(() => {
    const model = currentModel ?? "openai/gpt-oss-120b";
    return modelList.includes(model) ? modelList : [model, ...modelList];
  }, [modelList, currentModel]);
}
