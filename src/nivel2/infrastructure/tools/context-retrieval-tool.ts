import * as vscode from 'vscode';

interface ContextRetrievalInput {
  query: string;
  maxResults?: number;
  minScore?: number;
  sources?: Array<'code' | 'documentation' | 'prevention' | 'task'>;
  includeRelated?: boolean;
}

type RetrievedContext = {
  file: string;
  lineStart: number;
  lineEnd: number;
  snippet: string;
  source: 'code' | 'documentation' | 'prevention' | 'task';
  score: number;
};

const DEFAULT_EXCLUDE = '**/{node_modules,.git,dist,build,coverage,out,tmp}/**';

function detectSource(file: string): RetrievedContext['source'] {
  const lower = file.toLowerCase();
  if (lower.includes('docs/prevention')) return 'prevention';
  if (lower.includes('.cappy/tasks')) return 'task';
  if (lower.includes('docs/')) return 'documentation';
  return 'code';
}

function buildIncludePatterns(sources?: ContextRetrievalInput['sources']): string[] {
  const patterns: string[] = [];
  const hasSource = (src: RetrievedContext['source']) => !sources || sources.includes(src);

  if (hasSource('code')) {
    patterns.push('**/*.{ts,tsx,js,jsx,mjs,cjs,tsconfig,json,cs,cpp,c,h,java,py,go,rb,rs,php,swift,kt,kts,scala,sh,ps1}');
  }

  if (hasSource('documentation')) {
    patterns.push('**/*.{md,mdx,txt,adoc,org,rst}');
    patterns.push('docs/**');
  }

  if (hasSource('prevention')) {
    patterns.push('docs/prevention/**');
  }

  if (hasSource('task')) {
    patterns.push('.cappy/tasks/**/*.xml');
  }

  return patterns.length > 0 ? patterns : ['**/*'];
}

async function readFileSafe(uri: vscode.Uri): Promise<string | null> {
  try {
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString('utf8');
  } catch {
    return null;
  }
}

function createSnippet(content: string, needle: string): { snippet: string; lineStart: number; lineEnd: number; score: number } | null {
  const lines = content.split('\n');
  const lowerNeedle = needle.toLowerCase();
  let bestIndex = -1;
  let occurrences = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lowerNeedle)) {
      occurrences += 1;
      if (bestIndex === -1) bestIndex = i;
    }
  }

  if (bestIndex === -1) return null;

  const start = Math.max(0, bestIndex - 2);
  const end = Math.min(lines.length, bestIndex + 3);
  const snippetLines = lines.slice(start, end).join('\n');
  const normalized = snippetLines.length > 900 ? `${snippetLines.slice(0, 900)}...` : snippetLines;

  return {
    snippet: normalized,
    lineStart: start + 1,
    lineEnd: end,
    score: occurrences
  };
}

/**
 * Language Model Tool that surfaces relevant project context for a query.
 * Lightweight retriever that scans code, docs, prevention rules and tasks.
 */
export class ContextRetrievalTool implements vscode.LanguageModelTool<ContextRetrievalInput> {
  public inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Query to search for in project context' },
      maxResults: { type: 'number', description: 'Maximum items to return', default: 8 },
      minScore: { type: 'number', description: 'Minimum score 0-1 (unused, reserved)' },
      sources: {
        type: 'array',
        description: 'Sources to search: code, documentation, prevention, task',
        items: { type: 'string' }
      },
      includeRelated: { type: 'boolean', description: 'Include related context (reserved)', default: true }
    },
    required: ['query']
  } as const;

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ContextRetrievalInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    if (!options.input?.query) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('❌ Error: Missing required "query" field')
      ]);
    }

    const query = options.input.query.trim();
    const maxResults = Math.min(options.input.maxResults ?? 8, 15);
    const includePatterns = buildIncludePatterns(options.input.sources);
    const seen = new Set<string>();
    const results: RetrievedContext[] = [];

    try {
      for (const pattern of includePatterns) {
        if (token.isCancellationRequested) break;

        const uris = await vscode.workspace.findFiles(pattern, DEFAULT_EXCLUDE, 120);

        for (const uri of uris) {
          if (token.isCancellationRequested) break;
          const relPath = vscode.workspace.asRelativePath(uri);
          if (relPath.includes('.cappy/indexes') || relPath.includes('.cappy/history')) continue;
          if (seen.has(relPath)) continue;

          const content = await readFileSafe(uri);
          if (!content) continue;

          const snippetInfo = createSnippet(content, query);
          if (!snippetInfo) continue;

          seen.add(relPath);
          results.push({
            file: relPath,
            lineStart: snippetInfo.lineStart,
            lineEnd: snippetInfo.lineEnd,
            snippet: snippetInfo.snippet,
            source: detectSource(relPath),
            score: snippetInfo.score
          });

          if (results.length >= maxResults * 2) break;
        }
      }

      if (results.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`ℹ️ No relevant context found for "${query}"`)
        ]);
      }

      const sorted = results
        .slice(0, maxResults * 2)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      const sourceCounts = sorted.reduce<Record<string, number>>((acc, curr) => {
        acc[curr.source] = (acc[curr.source] || 0) + 1;
        return acc;
      }, {});

      const header = `📊 Found ${sorted.length} contexts for "${query}"
📁 Sources: ${Object.entries(sourceCounts)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}\n\n`;

      const body = sorted
        .map((item, idx) => {
          const title = `${idx + 1}. ${item.file} [${item.lineStart}-${item.lineEnd}] (${item.source})`;
          return `${title}\n${item.snippet}\n\n---`;
        })
        .join('\n');

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`${header}${body}`)
      ]);

    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error retrieving context: ${err}`)
      ]);
    }
  }
}
