import * as vscode from 'vscode';

/**
 * Input schema for text search (grep)
 */
export interface GrepSearchInput {
	/**
	 * Text pattern to search for. Can be a string or regex pattern.
	 */
	query: string;
	
	/**
	 * Optional: Whether the query is a regex pattern (default: false)
	 */
	isRegex?: boolean;
	
	/**
	 * Optional: Case sensitive search (default: false)
	 */
	isCaseSensitive?: boolean;
	
	/**
	 * Optional: Match whole words only (default: false)
	 */
	isWholeWord?: boolean;
	
	/**
	 * Optional: File patterns to include (glob). Example: "**\/*.ts"
	 */
	include?: string;
	
	/**
	 * Optional: File patterns to exclude (glob). Example: "**\/node_modules/**"
	 */
	exclude?: string;
	
	/**
	 * Optional: Maximum number of results (default: 100)
	 */
	maxResults?: number;
}

/**
 * Language Model Tool for text search (grep) across workspace files.
 * Based on VS Code's native text search implementation.
 * 
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/search/node/rawSearchService.ts
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/common/extHostWorkspace.ts#L720
 */
export class GrepSearchTool implements vscode.LanguageModelTool<GrepSearchInput> {
	public inputSchema = {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Text pattern to search for. Can be a string or regex pattern.'
			},
			isRegex: {
				type: 'boolean',
				description: 'Whether the query is a regex pattern',
				default: false
			},
			isCaseSensitive: {
				type: 'boolean',
				description: 'Case sensitive search',
				default: false
			},
			isWholeWord: {
				type: 'boolean',
				description: 'Match whole words only',
				default: false
			},
			include: {
				type: 'string',
				description: 'File patterns to include (glob). Example: "**/*.ts"'
			},
			exclude: {
				type: 'string',
				description: 'File patterns to exclude (glob). Example: "**/node_modules/**"'
			},
			maxResults: {
				type: 'number',
				description: 'Maximum number of results',
				default: 100
			}
		},
		required: ['query']
	} as const;

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GrepSearchInput>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		// Validate input
		if (!options.input) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide a "query" parameter.')
			]);
		}

		const {
			query,
			isRegex = false,
			isCaseSensitive = false,
			isWholeWord = false,
			include,
			exclude,
			maxResults = 100
		} = options.input;

		// Validate required query parameter
		if (!query) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing required "query" parameter. Example: {"query": "function"}')
			]);
		}

		try {
			const results: Array<{
				file: string;
				line: number;
				text: string;
				matchStart: number;
				matchEnd: number;
			}> = [];

			// Use VS Code's findTextInFiles API (proposed API)
			// For now, use a simpler approach with findFiles + readFile
			
			// Find files to search
			const includePattern = include || '**/*';
			const excludePattern = exclude || '**/node_modules/**';
			
			const uris = await vscode.workspace.findFiles(
				includePattern,
				excludePattern,
				maxResults * 10 // Search more files to get enough matches
			);

			// Search in each file
			for (const uri of uris) {
				if (token.isCancellationRequested) {
					break;
				}

				try {
					const content = await vscode.workspace.fs.readFile(uri);
					const text = Buffer.from(content).toString('utf8');
					const lines = text.split('\n');

					// Create search regex
					let searchPattern: RegExp;
					if (isRegex) {
						searchPattern = new RegExp(query, isCaseSensitive ? 'g' : 'gi');
					} else {
						const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
						const pattern = isWholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
						searchPattern = new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
					}

					// Search each line
					lines.forEach((line, lineIndex) => {
						const matches = [...line.matchAll(searchPattern)];
						matches.forEach(match => {
							if (results.length < maxResults) {
								results.push({
									file: vscode.workspace.asRelativePath(uri),
									line: lineIndex + 1,
									text: line.trim(),
									matchStart: match.index || 0,
									matchEnd: (match.index || 0) + match[0].length
								});
							}
						});
					});

					if (results.length >= maxResults) {
						break;
					}
				} catch (fileError) {
					// Skip files that can't be read (binary, permissions, etc.)
					continue;
				}
			}

			// Format results
			const resultText = results.length > 0
				? `Found ${results.length} match(es) for "${query}":\n\n` +
				  results.map(r => 
					`${r.file}:${r.line}\n  ${r.text}`
				  ).join('\n\n')
				: `No matches found for "${query}"`;

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(resultText)
			]);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error searching text: ${errorMessage}`)
			]);
		}
	}
}
