/**
 * Lexical tokenizer for hybrid retrieval.
 *
 * Pure function — zero imports, no side effects.
 * Used by both RagIndexer (at index time) and ragSearchTool (at query time)
 * to produce a consistent token vocabulary.
 */

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do",
  "for", "from", "has", "he", "in", "is", "it", "its",
  "of", "on", "or", "that", "the", "this", "to", "was",
  "were", "will", "with", "not", "no", "but", "if", "then",
  "so", "have", "had", "her", "him", "his", "they", "their",
  "we", "you", "your", "my", "our", "can", "would", "could",
  "should", "may", "might", "must", "than", "also",
]);

/**
 * Splits `text` into a deduplicated set of lowercase alphanumeric tokens,
 * filtering stopwords and tokens shorter than 2 characters.
 *
 * Designed for code content: camelCase and snake_case terms are split on
 * non-alphanumeric boundaries so "getUserById" yields ["getuserbyid"] as one
 * token plus individual splits if the regex matches — but since we split only
 * on `[^a-z0-9]+`, the full identifier is preserved as a token.
 * This means exact identifier matches (e.g. "DESTRUCTIVE_TOOLS") are always
 * findable via lexical scoring.
 */
export function tokenizeForLexical(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}
