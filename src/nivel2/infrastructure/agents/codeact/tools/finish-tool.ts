/**
 * @fileoverview Finish tool to end agent execution
 * @module codeact/tools/finish-tool
 */

import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Finish tool - signals completion of the task
 * Similar to OpenHands FinishTool
 */
export class FinishTool extends BaseTool {
  name = 'finish'
  description = 'Signal that the task is complete. Use this when you have successfully completed the user\'s request.'
  
  parameters: ToolParameter[] = [
    {
      name: 'summary',
      type: 'string',
      description: 'Brief summary of what was accomplished',
      required: false
    },
    {
      name: 'outputs',
      type: 'object',
      description: 'Optional outputs or results from the task',
      required: false
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const summary = input.summary as string | undefined
    const outputs = input.outputs as Record<string, unknown> | undefined
    
    return this.success({
      summary: summary || 'Task completed',
      outputs: outputs || {},
      completed: true
    })
  }
}
