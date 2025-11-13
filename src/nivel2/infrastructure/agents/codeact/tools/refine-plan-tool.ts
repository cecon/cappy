/**
 * @fileoverview Refine Plan Tool - adjusts existing plan based on user feedback
 * @module codeact/tools/refine-plan-tool
 */

import { BaseTool, type ToolResult, type ToolParameter } from '../core/tool'
import type { Plan } from '../core/plan'
import type { PlanRepository } from '../services/plan-repository'
import type { LLMService } from '../types/services'

export class RefinePlanTool extends BaseTool {
  name = 'refine_plan'
  description = 'Refine an existing development plan based on user feedback or adjustments'
  
  parameters: ToolParameter[] = [
    {
      name: 'planId',
      type: 'string',
      description: 'ID of the plan to refine',
      required: true
    },
    {
      name: 'adjustment',
      type: 'string',
      description: 'User feedback or adjustment request',
      required: true
    }
  ]

  private readonly llmService: LLMService
  private readonly planRepository: PlanRepository
  
  constructor(
    llmService: LLMService,
    planRepository: PlanRepository
  ) {
    super()
    this.llmService = llmService
    this.planRepository = planRepository
  }
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    const planId = input.planId as string
    const adjustment = input.adjustment as string
    
    try {
      console.log('[RefinePlanTool] Refining plan:', planId)
      console.log('[RefinePlanTool] Adjustment:', adjustment)
      
      // 1. Load current plan
      const currentPlan = await this.planRepository.findById(planId)
      
      if (!currentPlan) {
        return this.error(`Plan not found: ${planId}`)
      }
      
      // 2. Save current version before modifying
      console.log('[RefinePlanTool] Saving current version as backup...')
      await this.planRepository.saveVersion(
        currentPlan.id,
        currentPlan,
        adjustment
      )
      
      // 3. Build refinement prompt
      const prompt = this.buildRefinementPrompt(currentPlan, adjustment)
      
      // 4. Call LLM to refine plan
      console.log('[RefinePlanTool] Calling LLM to refine plan...')
      const llmResponse = await this.llmService.generateStructured(prompt)
      
      // 5. Parse response
      const refinedTasks = this.parseLLMResponse(llmResponse)
      
      if (!refinedTasks) {
        return this.error('Failed to parse LLM response into valid plan structure')
      }
      
      // 6. Create refined plan
      const refinedPlan: Plan = {
        ...currentPlan,
        tasks: refinedTasks.tasks.map((task, index) => {
          const taskObj = task as Record<string, unknown>
          return {
            id: (taskObj.id as string) || `task-${index + 1}`,
            description: (taskObj.description as string) || '',
            filesToModify: (taskObj.filesToModify as string[]) || [],
            dependencies: (taskObj.dependencies as string[]) || [],
            estimatedComplexity: (taskObj.estimatedComplexity as 'low' | 'medium' | 'high') || 'medium',
            technicalNotes: (taskObj.technicalNotes as string) || undefined,
            position: index + 1
          }
        }),
        version: currentPlan.version + 1
      }
      
      // 7. Save refined plan
      console.log('[RefinePlanTool] Saving refined plan...')
      await this.planRepository.save(refinedPlan)
      
      console.log('[RefinePlanTool] Plan refined successfully. New version:', refinedPlan.version)
      
      return this.success({
        plan: refinedPlan,
        message: `✅ Plan refined (v${refinedPlan.version}). ${refinedPlan.tasks.length} tasks.`,
        changes: this.summarizeChanges(currentPlan, refinedPlan)
      })
      
    } catch (error) {
      console.error('[RefinePlanTool] Error:', error)
      return this.error(error instanceof Error ? error.message : 'Unknown error during plan refinement')
    }
  }
  
  /**
   * Build the LLM prompt for plan refinement
   */
  private buildRefinementPrompt(currentPlan: Plan, adjustment: string): string {
    return `You are refining an existing development plan based on user feedback.

CURRENT PLAN:
Goal: ${currentPlan.goal}
Version: ${currentPlan.version}

Current Tasks:
${JSON.stringify(currentPlan.tasks, null, 2)}

USER ADJUSTMENT REQUEST:
${adjustment}

Generate a refined plan with the following JSON structure:

{
  "tasks": [
    {
      "id": "task-1",
      "description": "Clear, actionable description",
      "filesToModify": ["path/to/file.ts"],
      "dependencies": [],
      "estimatedComplexity": "low|medium|high",
      "technicalNotes": "Technical considerations"
    }
  ]
}

RULES FOR REFINEMENT:
1. Apply the user's adjustment while maintaining plan coherence
2. Keep existing tasks that aren't affected by the adjustment
3. Modify, add, or remove tasks as needed to satisfy the adjustment
4. Maintain logical task ordering and dependencies
5. Preserve task IDs where possible for tracking
6. Update complexity estimates if changes affect them
7. Add technical notes explaining significant changes

IMPORTANT:
- Return ONLY valid JSON
- Do not include markdown code blocks
- Ensure the refined plan still achieves the original goal
- Keep all tasks actionable and specific

Generate the refined plan now:`
  }
  
  /**
   * Parse LLM response into plan structure
   */
  private parseLLMResponse(response: unknown): { tasks: Array<Record<string, unknown>> } | null {
    try {
      if (typeof response === 'object' && response !== null && 'tasks' in response) {
        return response as { tasks: Array<Record<string, unknown>> }
      }
      
      if (typeof response === 'string') {
        let cleaned = response.trim()
        cleaned = cleaned.replace(/```json\n?/g, '')
        cleaned = cleaned.replace(/```\n?/g, '')
        cleaned = cleaned.trim()
        
        const parsed = JSON.parse(cleaned) as Record<string, unknown>
        
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          return parsed as { tasks: Array<Record<string, unknown>> }
        }
      }
      
      return null
      
    } catch (error) {
      console.error('[RefinePlanTool] Failed to parse LLM response:', error)
      return null
    }
  }
  
  /**
   * Summarize changes between old and new plan
   */
  private summarizeChanges(oldPlan: Plan, newPlan: Plan): string {
    const oldTaskCount = oldPlan.tasks.length
    const newTaskCount = newPlan.tasks.length
    
    const changes: string[] = []
    
    if (newTaskCount > oldTaskCount) {
      changes.push(`Added ${newTaskCount - oldTaskCount} task(s)`)
    } else if (newTaskCount < oldTaskCount) {
      changes.push(`Removed ${oldTaskCount - newTaskCount} task(s)`)
    }
    
    // Check for modified tasks
    let modified = 0
    for (const newTask of newPlan.tasks) {
      const oldTask = oldPlan.tasks.find(t => t.id === newTask.id)
      if (oldTask && oldTask.description !== newTask.description) {
        modified++
      }
    }
    
    if (modified > 0) {
      changes.push(`Modified ${modified} task(s)`)
    }
    
    return changes.length > 0 ? changes.join(', ') : 'Minor adjustments'
  }
}