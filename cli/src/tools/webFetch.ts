import type { ToolDefinition } from "./toolTypes";

const MAX_CHARS_DEFAULT = 80_000;
const FETCH_TIMEOUT_MS = 30_000;

interface WebFetchParams {
  url: string;
  maxChars?: number;
}

/**
 * Fetches public HTTP(S) content as text (trimmed), for research without extra dependencies.
 */
export const webFetchTool: ToolDefinition<WebFetchParams, { text: string; truncated: boolean }> = {
  name: "WebFetch",
  description:
    "Fetches a public http(s) URL and returns readable text (HTML is lightly stripped). Use for documentation or pages; respect robots and rate limits.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "Absolute http or https URL." },
      maxChars: {
        type: "number",
        description: `Maximum characters to return (default ${MAX_CHARS_DEFAULT}).`,
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  async execute(params) {
    const rawUrl = params.url.trim();
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error("Invalid URL.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http(s) URLs are allowed.");
    }

    const maxChars =
      typeof params.maxChars === "number" && Number.isFinite(params.maxChars) && params.maxChars > 0
        ? Math.min(Math.floor(params.maxChars), 500_000)
        : MAX_CHARS_DEFAULT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "Cappy-Extension/1.0 (webview agent)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const textDecoder = new TextDecoder("utf-8", { fatal: false });
      let text = textDecoder.decode(buffer);
      text = stripHtmlNoise(text);
      const truncated = text.length > maxChars;
      if (truncated) {
        text = text.slice(0, maxChars) + "\n\n[truncated]";
      }
      return { text, truncated };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

/**
 * Removes script/style blocks and collapses whitespace for rough HTML-to-text.
 */
function stripHtmlNoise(html: string): string {
  let s = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  s = s.replace(/<[^>]+>/g, " ");
  return s.replace(/\s+/g, " ").trim();
}
