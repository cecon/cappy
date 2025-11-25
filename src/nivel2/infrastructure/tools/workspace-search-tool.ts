import * as vscode from 'vscode';

/**
 * Input schema for workspace file search
 */
export interface WorkspaceSearchInput {
	/** 
	 * File name pattern to search for. Supports glob patterns like "*.ts", "**\/test\/*.js", etc.
	 * Examples: "*.md", "src/**\/*.ts", "package.json"
	 */
	pattern: string;
	
	/**
	 * Optional: Folders to include in search. If not specified, searches all workspace folders.
	 */
	includeFolders?: string[];
	
	/**
	 * Optional: Maximum number of results to return (default: 100)
	 */
	maxResults?: number;
	
	/**
	 * Optional: Whether to follow symbolic links (default: true)
	 */
	followSymlinks?: boolean;
}

/**
 * Language Model Tool for searching files in workspace by pattern.
 * Based on VS Code's native file search implementation.
 * 
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/search/common/fileSearchManager.ts
 */
export class WorkspaceSearchTool implements vscode.LanguageModelTool<WorkspaceSearchInput> {
	public inputSchema = {
		type: 'object',
		properties: {
			pattern: {
				type: 'string',
				description: 'File pattern to search for (glob pattern). Example: "**/*.ts"'
			},
			includeFolders: {
				type: 'array',
				items: { type: 'string' },
				description: 'Optional folders to include in search'
			},
			maxResults: {
				type: 'number',
				description: 'Maximum number of results',
				default: 100
			},
			followSymlinks: {
				type: 'boolean',
				description: 'Whether to follow symbolic links',
				default: true
			}
		},
		required: ['pattern']
	} as const;

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<WorkspaceSearchInput>,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		// Validate input
		if (!options.input) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide a "pattern" parameter.')
			]);
		}

		const { pattern, includeFolders, maxResults = 100 } = options.input;

		// Validate required pattern parameter
		if (!pattern) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing required "pattern" parameter. Example: {"pattern": "**/*.ts"}')
			]);
		}

		try {
			// Build glob pattern
			const globPattern = new vscode.RelativePattern(
				vscode.workspace.workspaceFolders?.[0] || vscode.Uri.file('.'),
				pattern
			);

			// Search using VS Code's native file search
			const uris = await vscode.workspace.findFiles(
				globPattern,
				undefined, // exclude pattern (use workspace settings)
				maxResults
			);

			// Filter by folders if specified
			let filteredUris = uris;
			if (includeFolders && includeFolders.length > 0) {
				filteredUris = uris.filter(uri => 
					includeFolders.some(folder => uri.fsPath.includes(folder))
				);
			}

			// Format results
			const files = filteredUris.map(uri => ({
				path: vscode.workspace.asRelativePath(uri),
				absolutePath: uri.fsPath,
				scheme: uri.scheme
			}));

			const resultText = files.length > 0
				? `Found ${files.length} file(s) matching pattern "${pattern}":\n\n` +
				  files.map(f => `- ${f.path}`).join('\n')
				: `No files found matching pattern "${pattern}"`;

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(resultText)
			]);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error searching workspace: ${errorMessage}`)
			]);
		}
	}
}
