/**
 * @fileoverview Finish tool to end agent execution
 * @module codeact/tools/finish-tool
 */

import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Finish tool - signals completion or pause of the task
 * Similar to OpenHands FinishTool
 */
export class FinishTool extends BaseTool {
  name = 'finish'
  description = 'Signal that the task is complete OR pause to wait for user response. Use completed=true when fully done, completed=false when waiting for user input.'
  
  parameters: ToolParameter[] = [
    {
      name: 'summary',
      type: 'string',
      description: 'Brief summary of what was accomplished or reason for pausing',
      required: false
    },
    {
      name: 'outputs',
      type: 'object',
      description: 'Optional outputs or results from the task',
      required: false
    },
    {
      name: 'completed',
      type: 'boolean',
      description: 'Whether the task is fully completed (true) or just pausing to wait for user response (false)',
      required: false
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const summary = input.summary as string | undefined
    const outputs = input.outputs as Record<string, unknown> | undefined
    const completed = input.completed !== false // Default to true for backward compatibility
    
    return this.success({
      summary: summary || (completed ? 'Task completed' : 'Waiting for user response'),
      outputs: outputs || {},
      completed
    })
  }
}
