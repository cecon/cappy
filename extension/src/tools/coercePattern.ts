/**
 * Obtém o texto de pesquisa para Grep/Glob quando o modelo usa chaves alternativas ou tipos soltos.
 */
export function coerceSearchPattern(raw: Record<string, unknown>, tool: "grep" | "glob"): string {
  const keys =
    tool === "grep"
      ? (["pattern", "Pattern", "regex", "regexp", "query", "search", "q"] as const)
      : (["pattern", "Pattern", "glob", "query", "search"] as const);

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}
