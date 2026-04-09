/**
 * @param value - Valor candidato
 * @returns `true` se for um objeto plano (não array).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Chaves onde o modelo/API aninha o payload real (ex.: `function.arguments`). */
const NEST_KEYS = ["arguments", "params", "input", "args", "data", "tool_input"] as const;

/**
 * Copia chaves de objetos aninhados para o nível superior sem sobrescrever chaves já definidas.
 */
export function mergeNestedPatternArgs(raw: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...raw };
  const fillableKeys = new Set(["pattern", "Pattern", "query", "glob", "path", "regex", "regexp", "search", "q"]);
  for (const nestKey of NEST_KEYS) {
    const inner = raw[nestKey];
    if (!isRecord(inner)) {
      continue;
    }
    for (const [key, value] of Object.entries(inner)) {
      if (merged[key] === undefined) {
        merged[key] = value;
        continue;
      }
      const current = merged[key];
      const currentEmpty = typeof current === "string" && current.trim().length === 0;
      if (currentEmpty && fillableKeys.has(key) && (typeof value === "string" || typeof value === "number")) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

/**
 * Obtém o texto de pesquisa para Grep/Glob quando o modelo usa chaves alternativas ou tipos soltos.
 */
export function coerceSearchPattern(raw: Record<string, unknown>, tool: "grep" | "glob"): string {
  const flat = mergeNestedPatternArgs(raw);
  const keys =
    tool === "grep"
      ? (["pattern", "Pattern", "regex", "regexp", "query", "search", "q"] as const)
      : (["pattern", "Pattern", "glob", "query", "search"] as const);

  for (const key of keys) {
    const value = flat[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (Array.isArray(value) && value.length > 0) {
      const parts = value
        .map((entry) => (typeof entry === "string" ? entry : String(entry)))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      if (parts.length > 0) {
        return parts.join("|");
      }
    }
  }

  for (const key of keys) {
    const value = flat[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}
