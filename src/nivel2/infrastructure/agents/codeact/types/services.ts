/**
 * @fileoverview Shared service interfaces for CodeAct agents
 * @module codeact/types/services
 */

import type { ToolResult } from '../core/tool'

/**
 * LLM Service for structured generation
 */
export interface LLMService {
  generateStructured(prompt: string): Promise<unknown>
}

/**
 * Context Retrieval Tool interface
 */
export interface RetrieveContextTool {
  execute(input: Record<string, unknown>): Promise<ToolResult>
}
