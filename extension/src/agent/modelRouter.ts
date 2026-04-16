import type { CappyConfig, ActiveAgent } from "../config/index.js";
import type { ChatUiMode } from "../bridge/chatMode.js";

/**
 * Selects the model to use for a given agent role and chat mode.
 * Priority: modelRouting[role] → modelRouting.ask (if ask mode) → openrouter.model
 */
export function selectModel(
  config: CappyConfig,
  activeAgent: ActiveAgent,
  chatMode?: ChatUiMode,
): string {
  const routing = config.openrouter.modelRouting;
  if (routing) {
    if (chatMode === "ask" && routing.ask && routing.ask.trim().length > 0) {
      return routing.ask;
    }
    const roleModel = routing[activeAgent];
    if (roleModel && roleModel.trim().length > 0) {
      return roleModel;
    }
  }
  return config.openrouter.model;
}
