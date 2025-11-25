import * as vscode from 'vscode';

/**
 * Input schema for workspace symbol search
 */
export interface SymbolSearchInput {
	/**
	 * Symbol name to search for (e.g., class names, function names, variables)
	 */
	query: string;
	
	/**
	 * Optional: Maximum number of results (default: 50)
	 */
	maxResults?: number;
	
	/**
	 * Optional: Filter by symbol kind (Class, Function, Variable, etc.)
	 */
	symbolKind?: string;
}

/**
 * Language Model Tool for searching symbols (classes, functions, variables) across workspace.
 * Based on VS Code's native workspace symbol provider.
 * 
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/search/common/search.ts#L69
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/browser/mainThreadLanguageFeatures.ts#L490
 */
export class SymbolSearchTool implements vscode.LanguageModelTool<SymbolSearchInput> {
	public inputSchema = {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Symbol name to search for (class, function, variable, etc.)'
			},
			maxResults: {
				type: 'number',
				description: 'Maximum number of results',
				default: 50
			}
		},
		required: ['query']
	} as const;

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<SymbolSearchInput>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		// Validate input
		if (!options.input) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide a "query" parameter.')
			]);
		}

		const { query, maxResults = 50, symbolKind } = options.input;

		// Validate required query parameter
		if (!query) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing required "query" parameter. Example: {"query": "MyClass"}')
			]);
		}

		try {
			// Use VS Code's native workspace symbol provider command
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
				'vscode.executeWorkspaceSymbolProvider',
				query
			);

			if (token.isCancellationRequested) {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart('Search cancelled')
				]);
			}

			// Filter by symbol kind if specified
			let filteredSymbols = symbols || [];
			if (symbolKind) {
				const kindFilter = symbolKind.toLowerCase();
				filteredSymbols = filteredSymbols.filter(symbol => {
					const symbolKindName = vscode.SymbolKind[symbol.kind].toLowerCase();
					return symbolKindName.includes(kindFilter);
				});
			}

			// Limit results
			const limitedSymbols = filteredSymbols.slice(0, maxResults);

			// Format results
			const resultText = limitedSymbols.length > 0
				? `Found ${limitedSymbols.length} symbol(s) matching "${query}"${symbolKind ? ` (kind: ${symbolKind})` : ''}:\n\n` +
				  limitedSymbols.map(symbol => {
					const kind = vscode.SymbolKind[symbol.kind];
					const location = `${vscode.workspace.asRelativePath(symbol.location.uri)}:${symbol.location.range.start.line + 1}`;
					const container = symbol.containerName ? ` (in ${symbol.containerName})` : '';
					return `- ${kind}: ${symbol.name}${container}\n  at ${location}`;
				  }).join('\n\n')
				: `No symbols found matching "${query}"${symbolKind ? ` (kind: ${symbolKind})` : ''}`;

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(resultText)
			]);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error searching symbols: ${errorMessage}`)
			]);
		}
	}
}
