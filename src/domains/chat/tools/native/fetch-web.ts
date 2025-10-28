/**
 * Fetch Web Tool - Native VS Code Integration
 * 
 * Fetches content from web URLs with support for HTML parsing
 */

import * as vscode from 'vscode'
import { ToolCategory } from '../types'

interface FetchWebInput {
  url: string
  selector?: string
}

/**
 * Language Model Tool for fetching web content
 * Supports basic HTML parsing and content extraction
 */
export class FetchWebTool implements vscode.LanguageModelTool<FetchWebInput> {
  static readonly metadata = {
    id: 'cappy_fetch_web',
    name: 'Fetch Web',
    description: 'Fetches content from a web URL (HTML, JSON, or text)',
    category: ToolCategory.NETWORK,
    version: '1.0.0',
    requiresConfirmation: true
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<FetchWebInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const { url } = options.input

    try {
      // Validate URL
      const urlObj = new URL(url)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart('❌ Only HTTP and HTTPS URLs are supported')
        ])
      }

      // Fetch content
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CappyBot/1.0; +https://github.com/cecon/cappy)'
        }
      })

      if (!response.ok) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`❌ HTTP ${response.status}: ${response.statusText}`)
        ])
      }

      const contentType = response.headers.get('content-type') || ''
      
      // Handle different content types
      if (contentType.includes('application/json')) {
        const json = await response.json()
        const formatted = JSON.stringify(json, null, 2)
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`✅ Fetched JSON from ${url}:\n\`\`\`json\n${formatted}\n\`\`\``)
        ])
      }

      if (contentType.includes('text/html')) {
        const html = await response.text()
        
        // Simple text extraction (remove scripts, styles, and HTML tags)
        let text = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        // Limit content length
        const maxLength = 3000
        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + '...\n\n(Content truncated)'
        }

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`✅ Fetched content from ${url}:\n\n${text}`)
        ])
      }

      // Plain text
      if (contentType.includes('text/')) {
        let text = await response.text()
        const maxLength = 3000
        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + '...\n\n(Content truncated)'
        }

        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`✅ Fetched text from ${url}:\n\n${text}`)
        ])
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Unsupported content type: ${contentType}`)
      ])

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`❌ Error fetching URL: ${errorMessage}`)
      ])
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<FetchWebInput>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<vscode.PreparedToolInvocation> {
    const { url } = options.input
    return {
      invocationMessage: `Fetching web content from: ${url}`,
      confirmationMessages: {
        title: 'Fetch Web Content',
        message: new vscode.MarkdownString(`Fetch content from \`${url}\`?\n\n⚠️ This will make an external HTTP request.`)
      }
    }
  }
}
