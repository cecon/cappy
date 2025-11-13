/**
 * @fileoverview Generate Plan Tool - creates initial development plan
 * @module codeact/tools/generate-plan-tool
 */

import { BaseTool, type ToolResult, type ToolParameter } from '../core/tool'
import { createPlan } from '../core/plan'
import type { PlanRepository } from '../services/plan-repository'
import type { LLMService, RetrieveContextTool } from '../types/services'

export class GeneratePlanTool extends BaseTool {
  name = 'generate_plan'
  description = 'Generate a structured development plan based on user goal and codebase context'
  
  parameters: ToolParameter[] = [
    {
      name: 'goal',
      type: 'string',
      description: 'The development goal or feature request from the user',
      required: true
    }
  ]

  private readonly sessionId: string
  private readonly retrieveContextTool: RetrieveContextTool
  private readonly llmService: LLMService
  private readonly planRepository: PlanRepository
  
  constructor(
    sessionId: string,
    retrieveContextTool: RetrieveContextTool,
    llmService: LLMService,
    planRepository: PlanRepository
  ) {
    super()
    this.sessionId = sessionId
    this.retrieveContextTool = retrieveContextTool
    this.llmService = llmService
    this.planRepository = planRepository
  }
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    const goal = input.goal as string
    
    try {
      console.log('[GeneratePlanTool] Starting plan generation for:', goal)
      
      // 1. Retrieve context from knowledge graph
      console.log('[GeneratePlanTool] Retrieving context from knowledge graph...')
      const contextResult = await this.retrieveContextTool.execute({ 
        query: goal,
        limit: 10
      })
      
      if (!contextResult.success) {
        console.warn('[GeneratePlanTool] Context retrieval failed:', contextResult.error)
        // Continue anyway with empty context
      }
      
      const context = (contextResult.success ? contextResult.result : {}) as Record<string, unknown>
      
      // 2. Build planning prompt
      const prompt = this.buildPlanningPrompt(goal, context)
      
      // 3. Call LLM to generate plan
      console.log('[GeneratePlanTool] Calling LLM to generate plan...')
      const llmResponse = await this.llmService.generateStructured(prompt)
      
      // 4. Parse and validate response
      const parsedPlan = this.parseLLMResponse(llmResponse)
      
      if (!parsedPlan) {
        return this.error('Failed to parse LLM response into valid plan structure')
      }
      
      // 5. Create Plan object
      const plan = createPlan(
        this.sessionId,
        goal,
        parsedPlan.tasks as Array<Omit<import('../core/plan').PlanTask, 'id' | 'position'>>,
        this.extractFilesFromContext(context)
      )
      
      // 6. Save to database
      console.log('[GeneratePlanTool] Saving plan to database...')
      await this.planRepository.save(plan)
      
      console.log('[GeneratePlanTool] Plan generated successfully:', plan.id)
      
      return this.success({
        plan,
        message: `✅ Plan created with ${plan.tasks.length} tasks`
      })
      
    } catch (error) {
      console.error('[GeneratePlanTool] Error:', error)
      return this.error(error instanceof Error ? error.message : 'Unknown error during plan generation')
    }
  }
  
  /**
   * Build the LLM prompt for plan generation
   */
  private buildPlanningPrompt(goal: string, context: Record<string, unknown>): string {
    let prompt = `You are an expert software development planner. Your task is to create a detailed, structured development plan.

USER GOAL:
${goal}

`
    
    // Add context if available
    if (context && context.files && Array.isArray(context.files) && context.files.length > 0) {
      prompt += `RELEVANT CODEBASE CONTEXT:
${JSON.stringify(context, null, 2)}

`
    }
    
    prompt += `Generate a development plan with the following JSON structure:

{
  "tasks": [
    {
      "description": "Clear, actionable description of what needs to be done",
      "filesToModify": ["path/to/file.ts"],
      "dependencies": [],
      "estimatedComplexity": "low",
      "technicalNotes": "Important technical considerations or warnings"
    }
  ]
}

RULES FOR GENERATING THE PLAN:
1. Break down the goal into atomic, sequential tasks
2. Each task should be concrete and actionable
3. Order tasks by logical dependencies (if task B needs task A, A comes first)
4. Reference existing files from the context when possible
5. Use "low", "medium", or "high" for estimatedComplexity
6. Include technical notes for complex decisions or trade-offs
7. Keep filesToModify realistic - don't invent file paths not in context
8. Dependencies should reference task indices (e.g., ["task-1", "task-2"])

IMPORTANT:
- Return ONLY valid JSON
- Do not include markdown code blocks or any other formatting
- Do not add explanations outside the JSON structure
- Ensure all file paths are relative to project root

Generate the plan now:`
    
    return prompt
  }
  
  /**
   * Parse LLM response into plan structure
   */
  private parseLLMResponse(response: unknown): { tasks: Array<Record<string, unknown>> } | null {
    try {
      // If response is already parsed
      if (typeof response === 'object' && response !== null && 'tasks' in response) {
        return response as { tasks: Array<Record<string, unknown>> }
      }
      
      // If response is string, try to parse
      if (typeof response === 'string') {
        // Remove markdown code blocks if present
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
      console.error('[GeneratePlanTool] Failed to parse LLM response:', error)
      return null
    }
  }
  
  /**
   * Extract file paths from context
   */
  private extractFilesFromContext(context: Record<string, unknown>): string[] {
    if (!context) return []
    
    const files: string[] = []
    
    if (context.files && Array.isArray(context.files)) {
      files.push(...context.files.map((f: unknown) => {
        if (typeof f === 'string') return f
        if (typeof f === 'object' && f !== null) {
          const fileObj = f as Record<string, unknown>
          return (fileObj.path || fileObj.name || String(f)) as string
        }
        return String(f)
      }))
    }
    
    if (context.entities && Array.isArray(context.entities)) {
      for (const entity of context.entities) {
        if (typeof entity === 'object' && entity !== null) {
          const entityObj = entity as Record<string, unknown>
          if (entityObj.file || entityObj.filePath) {
            files.push((entityObj.file || entityObj.filePath) as string)
          }
        }
      }
    }
    
    // Remove duplicates
    return [...new Set(files)]
  }
}