import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Input schema for reading file contents
 */
export interface ReadFileInput {
	/**
	 * File path to read (relative to workspace root or absolute)
	 */
	filePath: string;
	
	/**
	 * Optional: Start line number (1-indexed, inclusive)
	 */
	startLine?: number;
	
	/**
	 * Optional: End line number (1-indexed, inclusive)
	 */
	endLine?: number;
	
	/**
	 * Optional: Maximum number of lines to read (default: 500)
	 */
	maxLines?: number;
}

/**
 * Language Model Tool for reading file contents from workspace.
 * Based on VS Code's native file system API.
 * 
 * @see https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/browser/mainThreadWorkspace.ts
 */
export class ReadFileTool implements vscode.LanguageModelTool<ReadFileInput> {
	public inputSchema = {
		type: 'object',
		properties: {
			filePath: {
				type: 'string',
				description: 'File path to read (relative to workspace root or absolute)'
			},
			startLine: {
				type: 'number',
				description: 'Start line number (1-indexed, inclusive)'
			},
			endLine: {
				type: 'number',
				description: 'End line number (1-indexed, inclusive)'
			},
			maxLines: {
				type: 'number',
				description: 'Maximum number of lines to read',
				default: 500
			}
		},
		required: ['filePath']
	} as const;

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ReadFileInput>,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		// Validate input
		if (!options.input) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing tool parameters. Please provide a "filePath" parameter.')
			]);
		}

		const { filePath, startLine, endLine, maxLines = 500 } = options.input;

		// Validate required filePath parameter
		if (!filePath) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing required "filePath" parameter. Example: {"filePath": "src/file.ts"}')
			]);
		}

		try {
			// Resolve file path
			let uri: vscode.Uri;
			if (path.isAbsolute(filePath)) {
				uri = vscode.Uri.file(filePath);
			} else {
				// Try to find file in workspace
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (!workspaceFolder) {
					return new vscode.LanguageModelToolResult([
						new vscode.LanguageModelTextPart('No workspace folder found')
					]);
				}
				uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
			}

			// Read file using VS Code's file system API
			const fileContent = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(fileContent).toString('utf8');
			const allLines = text.split('\n');

			// Apply line range if specified
			let lines = allLines;
			let rangeInfo = '';
			
			if (startLine !== undefined || endLine !== undefined) {
				const start = Math.max(0, (startLine || 1) - 1);
				const end = endLine !== undefined ? endLine : allLines.length;
				lines = allLines.slice(start, end);
				rangeInfo = ` (lines ${start + 1}-${Math.min(end, allLines.length)})`;
			}

			// Apply max lines limit
			if (lines.length > maxLines) {
				const originalCount = lines.length;
				lines = lines.slice(0, maxLines);
				rangeInfo += ` [truncated from ${originalCount} lines]`;
			}

			// Format result
			const relativePath = vscode.workspace.asRelativePath(uri);
			const resultText = 
				`File: ${relativePath}${rangeInfo}\n` +
				`Total lines: ${allLines.length}\n` +
				`\n` +
				`\`\`\`\n${lines.join('\n')}\n\`\`\``;

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(resultText)
			]);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Provide helpful error messages
			if (errorMessage.includes('ENOENT') || errorMessage.includes('FileNotFound')) {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`File not found: ${filePath}`)
				]);
			}
			
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error reading file: ${errorMessage}`)
			]);
		}
	}
}
