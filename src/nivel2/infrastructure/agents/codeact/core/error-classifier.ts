/**
 * @fileoverview Error classification system for intelligent retry and recovery
 * @module core/error-classifier
 */

export const ErrorCategory = {
  RETRIABLE: 'retriable',      // Pode tentar de novo (network, temporary)
  FIXABLE: 'fixable',           // Pode tentar estratégia diferente
  TERMINAL: 'terminal',         // Não tem como resolver
  USER_INPUT: 'user_input'      // Precisa de input do usuário
} as const

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory]

export interface ClassifiedError {
  category: ErrorCategory
  originalError: string
  suggestion?: string
  alternativeStrategies?: string[]
}

export interface ErrorContext {
  toolName: string
  input: Record<string, unknown>
  previousAttempts: number
}

/**
 * Classifies errors and suggests recovery strategies
 */
export class ErrorClassifier {

  /**
   * Classifica erro e sugere estratégias
   */
  classify(error: string, context: ErrorContext): ClassifiedError {
    // Padrões comuns de erros retriáveis
    if (this.isNetworkError(error)) {
      return {
        category: ErrorCategory.RETRIABLE,
        originalError: error,
        suggestion: 'Network error - retry with backoff'
      }
    }

    if (this.isPermissionError(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Try with --user flag',
          'Check file permissions',
          'Use alternative installation method'
        ]
      }
    }

    if (this.isFileNotFound(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Create the file first',
          'Check if path is correct',
          'Search for file in workspace'
        ]
      }
    }

    if (this.isSyntaxError(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        suggestion: 'Fix syntax and try again'
      }
    }

    if (this.needsUserInput(error)) {
      return {
        category: ErrorCategory.USER_INPUT,
        originalError: error,
        suggestion: 'Ask user for missing information'
      }
    }

    // Erros específicos de ferramentas
    const toolSpecific = this.classifyToolSpecific(error, context)
    if (toolSpecific) {
      return toolSpecific
    }

    // Se tentou 3+ vezes, considerar terminal
    if (context.previousAttempts >= 3) {
      return {
        category: ErrorCategory.TERMINAL,
        originalError: error,
        suggestion: 'Multiple attempts failed - need user intervention'
      }
    }

    // Default: retriable
    return {
      category: ErrorCategory.RETRIABLE,
      originalError: error
    }
  }

  private isNetworkError(error: string): boolean {
    return /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|network|timeout|connection/i.test(error)
  }

  private isPermissionError(error: string): boolean {
    return /EACCES|EPERM|permission denied|access denied/i.test(error)
  }

  private isFileNotFound(error: string): boolean {
    return /ENOENT|file not found|cannot find|no such file/i.test(error)
  }

  private isSyntaxError(error: string): boolean {
    return /SyntaxError|unexpected token|parse error|compilation error/i.test(error)
  }

  private needsUserInput(error: string): boolean {
    return /configuration required|missing required|provide|specify|enter/i.test(error)
  }

  private classifyToolSpecific(error: string, context: ErrorContext): ClassifiedError | null {
    switch (context.toolName) {
      case 'bash':
        return this.classifyBashError(error, context)

      case 'edit_file':
        return this.classifyEditError(error, context)

      case 'file_read':
        return this.classifyFileReadError(error, context)

      case 'retrieve_context':
        return this.classifyRetrievalError(error, context)

      default:
        return null
    }
  }

  private classifyBashError(error: string, context: ErrorContext): ClassifiedError | null {
    // Command not found
    if (/command not found|not recognized/i.test(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Check if command is installed',
          'Use full path to executable',
          'Install required package'
        ]
      }
    }

    // Permission denied
    if (/permission denied|access denied/i.test(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Run with sudo/admin privileges',
          'Check file permissions',
          'Use different user account'
        ]
      }
    }

    // Package manager errors
    if (context.input.command?.toString().includes('npm') ||
        context.input.command?.toString().includes('yarn')) {
      if (/registry error|network error/i.test(error)) {
        return {
          category: ErrorCategory.RETRIABLE,
          originalError: error,
          suggestion: 'Package registry error - retry with different registry'
        }
      }
    }

    return null
  }

  private classifyEditError(error: string, _context: ErrorContext): ClassifiedError | null { // eslint-disable-line @typescript-eslint/no-unused-vars
    // Text not found
    if (/text not found|no match/i.test(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Check exact text with whitespace',
          'Include more context lines',
          'Verify file content first'
        ]
      }
    }

    // Syntax validation failed
    if (/syntax validation failed|syntax error/i.test(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Check syntax of replacement text',
          'Use smaller, targeted edits',
          'Validate replacement manually'
        ]
      }
    }

    return null
  }

  private classifyFileReadError(error: string, _context: ErrorContext): ClassifiedError | null { // eslint-disable-line @typescript-eslint/no-unused-vars
    // File not found
    if (/file not found|no such file/i.test(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Check file path spelling',
          'Use file search to locate file',
          'Create file if it should exist'
        ]
      }
    }

    return null
  }

  private classifyRetrievalError(error: string, _context: ErrorContext): ClassifiedError | null { // eslint-disable-line @typescript-eslint/no-unused-vars
    // No results found
    if (/no results|empty|not found/i.test(error)) {
      return {
        category: ErrorCategory.FIXABLE,
        originalError: error,
        alternativeStrategies: [
          'Try different search terms',
          'Use broader search query',
          'Check if files are indexed'
        ]
      }
    }

    return null
  }
}