/**
 * @fileoverview Clarify Requirements tool - enables agent to ask investigative questions
 * @module codeact/tools/clarify-tool
 * 
 * This tool forces the agent to be proactive and investigative instead of generating
 * generic plans when context is unclear.
 */

import { BaseTool } from '../core/tool'
import type { ToolParameter, ToolResult } from '../core/tool'

/**
 * Clarify Requirements tool
 * 
 * Allows the agent to ask specific clarifying questions when:
 * - User request is vague or ambiguous
 * - Critical context is missing
 * - Multiple interpretations are possible
 * - Better alternatives exist that should be discussed
 * 
 * This tool effectively PAUSES execution until the user provides more context,
 * preventing the agent from generating useless generic plans.
 */
export class ClarifyRequirementsTool extends BaseTool {
  name = 'clarify_requirements'
  description = `Ask clarifying questions when user requirements are vague, ambiguous, or lack critical context. 
  
  Use this tool BEFORE planning when:
  - User request could have multiple interpretations
  - Critical technical details are missing (auth, API endpoints, data formats, etc.)
  - You see a potentially better approach worth discussing
  - Implementation details would significantly affect the plan
  
  This tool pauses execution and waits for user response - do NOT proceed with planning until you have real context.
  
  EXAMPLES OF WHEN TO USE:
  
  User: "create a tool for jira"
  You should ask:
  - What operations? (create issues, search, update status?)
  - Jira Cloud or Server? What's the instance URL?
  - Do you have API credentials? (token, OAuth, basic auth?)
  - Integration context? (part of Cappy, standalone, CI/CD?)
  
  User: "add a database"
  You should ask:
  - Which database? (PostgreSQL, MongoDB, SQLite?)
  - What data needs to be stored?
  - Local dev only or production too?
  - Any specific schema requirements?
  
  User: "integrate with API"
  You should ask:
  - Which API? What's the base URL and documentation?
  - What endpoints/operations do you need?
  - Authentication method? (API key, OAuth, JWT?)
  - Rate limits or quotas to consider?`
  
  parameters: ToolParameter[] = [
    {
      name: 'questions',
      type: 'array',
      description: 'IMPORTANT: Provide ALL your questions here, but only the FIRST ONE will be asked to the user. The remaining questions will be asked one-by-one in subsequent turns. Each question should investigate a different aspect of the unclear requirement.',
      required: true,
      items: {
        type: 'string'
      }
    },
    {
      name: 'reason',
      type: 'string',
      description: 'Brief explanation of WHY these questions are necessary and what context you need to proceed effectively.',
      required: true
    },
    {
      name: 'assumptions_to_verify',
      type: 'array',
      description: 'Optional: List of assumptions you\'re making that need verification',
      required: false,
      items: {
        type: 'string'
      }
    },
    {
      name: 'alternative_approaches',
      type: 'array',
      description: 'Optional: Alternative approaches worth discussing with the user',
      required: false,
      items: {
        type: 'string'
      }
    }
  ]
  
  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const validation = this.validateInput(input)
    if (!validation.valid) {
      return this.error(validation.error!)
    }
    
    const questions = input.questions as string[]
    const reason = input.reason as string
    const assumptions = (input.assumptions_to_verify as string[] | undefined) || []
    const alternatives = (input.alternative_approaches as string[] | undefined) || []
    
    // ⚠️ STRATEGY: Ask only ONE question at a time
    // Store remaining questions in state for next turns
    
    // ⚠️ VALIDAÇÃO RIGOROSA: Qualidade e quantidade das perguntas
    if (questions.length < 1) {
      return this.error('You must ask at least 1 question to clarify requirements')
    }
    
    if (questions.length > 8) {
      return this.error('Too many questions planned. Limit to 8 maximum.')
    }
    
    // Validar que não são perguntas genéricas
    const genericPatterns = [
      'what do you want',
      'tell me more',
      'any preferences',
      'anything else',
      'more details',
      'what exactly'
    ]
    
    const hasGenericQuestion = questions.some(q => 
      genericPatterns.some(pattern => q.toLowerCase().includes(pattern))
    )
    
    if (hasGenericQuestion) {
      return this.error('Ask SPECIFIC questions (e.g., "Which database?" not "Tell me more"). Be precise and technical.')
    }
    
    // 🎯 ASK ONLY THE FIRST QUESTION
    const currentQuestion = questions[0]
    const remainingQuestions = questions.slice(1)
    
    // Format the clarification request for the user
    let message = `🤔 **Preciso entender melhor antes de planejar**\n\n`
    message += `**Por que estou perguntando:** ${reason}\n\n`
    
    if (assumptions.length > 0) {
      message += `**Premissas que preciso validar:**\n`
      for (const [i, assumption] of assumptions.entries()) {
        message += `${i + 1}. ${assumption}\n`
      }
      message += `\n`
    }
    
    message += `**Pergunta ${1}/${questions.length}:**\n`
    message += `${currentQuestion}\n`
    
    if (remainingQuestions.length > 0) {
      message += `\n_Terei mais ${remainingQuestions.length} pergunta(s) depois dessa._\n`
    }
    
    if (alternatives.length > 0) {
      message += `\n**Abordagens alternativas para considerar:**\n`
      for (const [i, alt] of alternatives.entries()) {
        message += `${i + 1}. ${alt}\n`
      }
    }
    
    message += `\n📌 *Aguardando sua resposta...*`
    
    return this.success({
      message,
      questions: [currentQuestion], // Only return first question
      remainingQuestions, // Store for next turn
      reason,
      assumptions,
      alternatives,
      status: 'awaiting_user_response',
      pauseExecution: true  // ← CRÍTICO: Sinaliza que deve pausar o loop do agent
    })
  }
}
