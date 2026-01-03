import * as vscode from 'vscode';
import * as path from 'path';

// ============================================================================
// Fetch Web Tool
// ============================================================================

/**
 * Input schema for fetching web content
 */
export interface FetchWebInput {
	/**
	 * URL to fetch (HTTP or HTTPS)
	 */
	url: string;
	
	/**
	 * Optional: CSS selector to extract specific content
	 */
	selector?: string;
}

/**
 * Language Model Tool for fetching web content.
 * Supports HTML, JSON, and text content extraction.
 */
export class FetchWebTool implements vscode.LanguageModelTool<FetchWebInput> {
	public inputSchema = {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: 'HTTP/HTTPS URL to fetch'
			},
			selector: {
				type: 'string',
				description: 'Optional CSS selector to extract specific content from HTML'
			}
		},
		required: ['url']
	} as const;

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<FetchWebInput>,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		if (!options.input?.url) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Missing required "url" parameter.')
			]);
		}

		const { url, selector } = options.input;

		// Validate URL
		try {
			const parsedUrl = new URL(url);
			if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart('❌ Error: URL must use http or https protocol.')
				]);
			}
		} catch {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('❌ Error: Invalid URL format.')
			]);
		}

		try {
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; CappyBot/1.0)',
					'Accept': 'text/html,application/json,text/plain,*/*'
				},
				signal: AbortSignal.timeout(15000) // 15 second timeout
			});

			if (!response.ok) {
				return new vscode.LanguageModelToolResult([
					new vscode.LanguageModelTextPart(`❌ HTTP Error: ${response.status} ${response.statusText}`)
				]);
			}

			const contentType = response.headers.get('content-type') || '';
			let content = await response.text();

			// For JSON, pretty print
			if (contentType.includes('application/json')) {
				try {
					const json = JSON.parse(content);
					content = JSON.stringify(json, null, 2);
				} catch { /* keep as is */ }
			}

			// For HTML, extract text content (simplified)
			if (contentType.includes('text/html')) {
				content = this.extractTextFromHtml(content, selector);
			}

			// Truncate if too long (max 10KB)
			const maxLength = 10000;
			if (content.length > maxLength) {
				content = content.slice(0, maxLength) + '\n\n[...content truncated...]';
			}

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`URL: ${url}\nContent-Type: ${contentType}\n\n${content}`)
			]);

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`❌ Error fetching URL: ${errorMessage}`)
			]);
		}
	}

	/**
	 * Simple HTML text extraction (without external dependencies)
	 */
	private extractTextFromHtml(html: string, selector?: string): string {
		// Remove script and style tags
		let text = html
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
			.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
			.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
			.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');

		// If selector provided, try to extract that section
		if (selector) {
			const selectorRegex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'gi');
			const matches = html.match(selectorRegex);
			if (matches) {
				text = matches.join('\n');
			}
		}

		// Extract main content areas if present
		const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
			text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
			text.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
		
		if (mainMatch) {
			text = mainMatch[1];
		}

		// Remove HTML tags
		text = text.replace(/<[^>]+>/g, ' ');
		
		// Clean up whitespace
		text = text
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#\d+;/g, '')
			.replace(/\s+/g, ' ')
			.trim();

		return text;
	}
}

// ============================================================================
// Read File Tool
// ============================================================================

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
