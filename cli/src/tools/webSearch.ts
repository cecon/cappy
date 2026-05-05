import type { ToolDefinition } from "./toolTypes";

const SEARCH_TIMEOUT_MS = 25_000;
const MAX_RESULTS = 12;

interface WebSearchParams {
  query: string;
  /** Comma-separated host substrings to allow (optional). */
  allowed_domains?: string;
  /** Comma-separated host substrings to block (optional). */
  blocked_domains?: string;
}

interface WebSearchHit {
  title: string;
  url: string;
  description?: string;
}

interface WebSearchResult {
  query: string;
  durationSeconds: number;
  hits: WebSearchHit[];
}

/**
 * Web search via DuckDuckGo HTML (OpenClaude-style default path, no extra npm deps).
 */
export const webSearchTool: ToolDefinition<WebSearchParams, WebSearchResult> = {
  name: "WebSearch",
  description:
    "Search the public web for current information. Uses DuckDuckGo HTML results; may be rate-limited. " +
    "Optional allowed_domains / blocked_domains filter hosts.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query (min 2 characters)." },
      allowed_domains: {
        type: "string",
        description: "Optional comma-separated host substrings; if set, only those hosts are kept.",
      },
      blocked_domains: {
        type: "string",
        description: "Optional comma-separated substrings; matching hosts are removed from results.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(params) {
    const q = params.query.trim();
    if (q.length < 2) {
      throw new Error("query must be at least 2 characters.");
    }

    const started = performance.now();
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    let html: string;
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Cappy-Extension/1.0 (WebSearch)",
          Accept: "text/html",
        },
      });
      if (!res.ok) {
        throw new Error(`Search HTTP ${res.status}`);
      }
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const rawHits = parseDuckDuckGoHtml(html).slice(0, MAX_RESULTS);
    const allowed = splitCommaList(params.allowed_domains).map((d) => d.toLowerCase());
    const blocked = splitCommaList(params.blocked_domains).map((d) => d.toLowerCase());

    const hits = rawHits.filter((h) => {
      let host: string;
      try {
        host = new URL(h.url).hostname.toLowerCase();
      } catch {
        return false;
      }
      if (blocked.length > 0 && blocked.some((b) => host.includes(b))) {
        return false;
      }
      if (allowed.length > 0 && !allowed.some((a) => host.includes(a.replace(/^www\./u, "")))) {
        return false;
      }
      return true;
    });

    return {
      query: q,
      durationSeconds: (performance.now() - started) / 1000,
      hits,
    };
  },
};

/**
 * Extracts result links from classic DDG HTML (best-effort).
 */
function parseDuckDuckGoHtml(html: string): WebSearchHit[] {
  const out: WebSearchHit[] = [];
  const re =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = decodeHtmlEntities(m[1] ?? "");
    const title = decodeHtmlEntities(stripTags(m[2] ?? "")).trim();
    const normalized = normalizeDuckLink(href);
    if (!normalized || out.some((x) => x.url === normalized)) {
      continue;
    }
    out.push({ title: title || normalized, url: normalized });
  }
  return out;
}

function normalizeDuckLink(href: string): string | null {
  if (href.includes("duckduckgo.com/l/?")) {
    try {
      const u = new URL(href.startsWith("http") ? href : `https:${href}`);
      const uddg = u.searchParams.get("uddg");
      if (uddg) {
        return decodeURIComponent(uddg);
      }
    } catch {
      return null;
    }
  }
  if (href.startsWith("https://") || href.startsWith("http://")) {
    return href;
  }
  if (href.startsWith("//") && href.length > 2) {
    return `https:${href}`;
  }
  return null;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/gu, "");
}

function splitCommaList(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
