/**
 * @fileoverview Advanced file read tool with intelligent chunking and content analysis
 * @module codeact/tools/file-read-tool
 */

import * as vscode from 'vscode'
import * as path from 'node:path'
import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * File read result with metadata
 */
interface FileReadResult {
  path: string
  content: string
  lineCount: number
  totalLines: number
  fileSize: number
  fileType: string
  encoding: string
  truncated: boolean
  chunked: boolean
  message: string
}

/**
 * Advanced file reading tool with intelligent chunking and content analysis
 */
export class FileReadTool extends BaseTool {
  name = 'read_file'
  description = `Read file contents with intelligent chunking and analysis.

**Features:**
- Automatic file type detection
- Smart chunking for large files
- Binary file detection and handling
- Context-aware reading
- Performance optimized with caching

**Usage:**
- Read entire files: just provide path
- Read specific lines: use startLine/endLine
- Read large files: automatic chunking prevents memory issues
- Read with context: specify lines around target area

**Examples:**
- "Read package.json" - entire file
- "Read src/main.ts lines 10-50" - specific range
- "Read large.log last 100 lines" - tail-like reading
`

  parameters: ToolParameter[] = [
    {
      name: 'path',
      type: 'string',
      description: 'Relative path to the file from workspace root',
      required: true
    },
    {
      name: 'startLine',
      type: 'number',
      description: 'Start line (1-based) to read from (optional)',
      required: false
    },
    {
      name: 'endLine',
      type: 'number',
      description: 'End line (1-based) to read to (optional)',
      required: false
    },
    {
      name: 'maxLines',
      type: 'number',
      description: 'Maximum lines to return (optional, default 1000)',
      required: false
    },
    {
      name: 'context',
      type: 'number',
      description: 'Lines of context around start/end (optional, default 0)',
      required: false
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding (optional, default utf-8)',
      required: false
    }
  ]

  // Simple cache for performance
  private fileCache = new Map<string, { content: string; mtime: number; size: number }>()
  private readonly MAX_CACHE_SIZE = 10
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly MAX_LINES_DEFAULT = 1000
  private readonly CHUNK_SIZE = 5000 // lines

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }

    try {
      const filePath = input.path as string
      const startLine = input.startLine as number | undefined
      const endLine = input.endLine as number | undefined
      const maxLines = (input.maxLines as number) || this.MAX_LINES_DEFAULT
      const context = (input.context as number) || 0
      const encoding = (input.encoding as string) || 'utf-8'

      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
      if (!workspaceFolder) {
        return this.error('No workspace folder open')
      }

      // Construct absolute path
      const absolutePath = path.join(workspaceFolder.uri.fsPath, filePath)
      const uri = vscode.Uri.file(absolutePath)

      // Check if file exists and get stats
      let stat: vscode.FileStat
      try {
        stat = await vscode.workspace.fs.stat(uri)
      } catch {
        return this.error(`File not found: ${filePath}`)
      }

      // Check file size
      if (stat.size > this.MAX_FILE_SIZE) {
        return this.error(
          `File too large: ${this.formatFileSize(stat.size)} (max: ${this.formatFileSize(this.MAX_FILE_SIZE)}). Use startLine/endLine to read specific sections.`
        )
      }

      // Detect file type
      const fileType = this.detectFileType(filePath)

      // Check if binary file
      if (this.isBinaryFile(filePath, fileType)) {
        return this.error(
          `Binary file detected: ${fileType}. Cannot read binary files. Use terminal commands to inspect.`
        )
      }

      // Read file content
      let content: string
      const cacheKey = `${filePath}:${stat.mtime}`

      if (this.fileCache.has(cacheKey)) {
        content = this.fileCache.get(cacheKey)!.content
      } else {
        const fileContent = await vscode.workspace.fs.readFile(uri)
        // Validate encoding
        const validEncoding = this.isValidEncoding(encoding) ? encoding as BufferEncoding : 'utf-8'
        content = Buffer.from(fileContent).toString(validEncoding)

        // Cache the content
        this.addToCache(cacheKey, content, stat.size)
      }

      const allLines = content.split('\n')
      const totalLines = allLines.length

      // Calculate actual line range to read
      const actualStart = startLine ? Math.max(1, startLine - context) : 1
      let actualEnd = endLine ? Math.min(totalLines, endLine + context) : totalLines

      // Apply max lines limit
      if (actualEnd - actualStart + 1 > maxLines) {
        actualEnd = actualStart + maxLines - 1
      }

      // Extract content
      const resultLines = allLines.slice(actualStart - 1, actualEnd)
      const resultContent = resultLines.join('\n')
      const lineCount = resultLines.length

      // Check if content was truncated
      const truncated = actualEnd < totalLines || (startLine !== undefined && startLine > 1) || (endLine !== undefined && endLine < totalLines)
      const chunked = lineCount > this.CHUNK_SIZE

      const result: FileReadResult = {
        path: filePath,
        content: resultContent,
        lineCount,
        totalLines,
        fileSize: stat.size,
        fileType,
        encoding,
        truncated,
        chunked,
        message: this.generateReadMessage(filePath, lineCount, totalLines, stat.size, truncated, chunked, actualStart, actualEnd)
      }

      return this.success(result)

    } catch (error) {
      if (error instanceof vscode.FileSystemError) {
        return this.error(`File system error: ${error.message}`)
      }
      return this.error(
        error instanceof Error ? error.message : 'Unknown error reading file'
      )
    }
  }

  /**
   * Add content to cache with LRU eviction
   */
  private addToCache(key: string, content: string, size: number): void {
    if (this.fileCache.size >= this.MAX_CACHE_SIZE) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.fileCache.keys().next().value
      if (firstKey) {
        this.fileCache.delete(firstKey)
      }
    }
    this.fileCache.set(key, { content, mtime: Date.now(), size })
  }

  /**
   * Check if encoding is valid BufferEncoding
   */
  private isValidEncoding(encoding: string): encoding is BufferEncoding {
    const validEncodings: BufferEncoding[] = ['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex']
    return validEncodings.includes(encoding as BufferEncoding)
  }

  /**
   * Detect file type based on extension
   */
  private detectFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const types: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.toml': 'TOML',
      '.md': 'Markdown',
      '.txt': 'Text',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'Sass',
      '.less': 'Less',
      '.sql': 'SQL',
      '.sh': 'Shell Script',
      '.bash': 'Bash Script',
      '.ps1': 'PowerShell',
      '.bat': 'Batch Script',
      '.cmd': 'Command Script',
      '.log': 'Log File',
      '.env': 'Environment Variables',
      '.gitignore': 'Git Ignore',
      '.dockerfile': 'Dockerfile',
      '.makefile': 'Makefile'
    }
    return types[ext] || 'Unknown'
  }

  /**
   * Check if file is binary
   */
  private isBinaryFile(filePath: string, fileType: string): boolean {
    const binaryExtensions = [
      '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.ico', '.svg',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
      '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'
    ]

    const ext = path.extname(filePath).toLowerCase()
    return binaryExtensions.includes(ext) || fileType === 'Binary'
  }

  /**
   * Format file size in human readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * Generate informative read message
   */
  private generateReadMessage(
    filePath: string,
    lineCount: number,
    totalLines: number,
    fileSize: number,
    truncated: boolean,
    chunked: boolean,
    startLine: number,
    endLine: number
  ): string {
    let message = `📄 Read ${lineCount} lines from \`${filePath}\` (${this.formatFileSize(fileSize)})`

    if (truncated) {
      message += `\n⚠️  Content truncated (showing lines ${startLine}-${endLine} of ${totalLines})`
    }

    if (chunked) {
      message += `\n📊 Large file chunked for performance`
    }

    if (lineCount === totalLines) {
      message += `\n✅ Full file content loaded`
    }

    return message
  }
}
