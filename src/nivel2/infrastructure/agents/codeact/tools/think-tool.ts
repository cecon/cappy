/**
 * @fileoverview Think tool for agent reasoning
 * @module codeact/tools/think-tool
 */

import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Think tool - allows agent to express internal reasoning
 * Similar to OpenHands ThinkTool
 */
export class ThinkTool extends BaseTool {
  name = 'think'
  description = 'Express your internal reasoning process. Use this to think through the problem step-by-step before taking action.'
  
  parameters: ToolParameter[] = [
    {
      name: 'thought',
      type: 'string',
      description: 'Your reasoning, analysis, or thought process',
      required: true
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    const thought = input.thought as string
    
    return this.success({
      thought,
      action: 'Internal reasoning logged'
    })
  }
}
