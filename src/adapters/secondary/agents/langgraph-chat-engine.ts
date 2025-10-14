import * as vscode from 'vscode'
import * as path from 'path'
import type { ChatAgentPort, ChatContext } from '../../../domains/chat/ports/agent-port'
import type { Message } from '../../../domains/chat/entities/message'

const MAX_AGENT_STEPS = 8

const SYSTEM_PROMPT = `
You are Cappy, an AI planning assistant integrated into VS Code.
You specialize in producing development-plan JSON files saved under .cappy/tasks/{timestamp}_plan_{slug}.json.
Primary duties:
- Collect missing requirements and confirm assumptions before drafting the plan.
- Structure every proposal with contexts (array of named resources with kind, location, whyItMatters) and steps (id, objective, instructions list, deliverables, acceptanceCriteria, dependencies, contextRefs, estimatedEffort).
- Recommend validation checklists and prevention rules relevant to each step.
- Answer in the same language as the user unless explicitly instructed otherwise.
- When uncertain, ask clarifying questions before continuing.
- Operate agentically: run an iterative THINK → PLAN → ACTION → REVIEW loop until the task is complete. Use clear bullet lists for PLAN and REVIEW sections.
- Mark intermediate turns that require more work with \`<!-- agent:continue -->\`. Mark the final output with \`<!-- agent:done -->\` and ensure it contains the finalized JSON draft.
- After salvar o arquivo, sempre pergunte "Precisa de mais alguma coisa? (responda 'sim' ou 'não')" e, em caso afirmativo, conduza perguntas de follow-up uma a uma até ter clareza da nova tarefa.
`.trim()

/**
 * Chat engine using GitHub Copilot's LLM via VS Code Language Model API
 * 
 * Uses vscode.lm.selectChatModels to access Copilot models.
 * Supports: streaming responses, tool calling, reasoning display
 */
export class LangGraphChatEngine implements ChatAgentPort {
  async *processMessage(message: Message, context: ChatContext): AsyncIterable<string> {
    try {
      // Emit reasoning start
      yield '<!-- reasoning:start -->\n'      
      
      // Select a Copilot chat model
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })

      if (models.length === 0) {
        yield '<!-- reasoning:end -->\n'
        yield 'No Copilot models available. Make sure you have:\n'
        yield '1. GitHub Copilot extension installed\n'
        yield '2. GitHub Copilot subscription active\n'
        yield '3. Signed in to GitHub in VS Code\n'
        return
      }

      const model = models[0]
      yield '<!-- reasoning:end -->\n'

      // Build message array for the model
      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT)
      ]

      // Add conversation history from context (limit to last 10 messages to avoid context overflow)
      const recentHistory = context.history.slice(-10)
      console.log(`💬 Adding ${recentHistory.length} messages to context (total history: ${context.history.length})`)
      
      for (const msg of recentHistory) {
        if (msg.author === 'user') {
          messages.push(vscode.LanguageModelChatMessage.User(msg.content))
        } else if (msg.author === 'assistant') {
          messages.push(vscode.LanguageModelChatMessage.Assistant(msg.content))
        }
      }

      // Add the current user message
      messages.push(vscode.LanguageModelChatMessage.User(message.content))
      
      console.log(`📨 Sending ${messages.length} messages to model (1 system + ${recentHistory.length} history + 1 current)`)

      // Get available tools
      const tools = vscode.lm.tools
      const cappyTools = tools.filter((tool: vscode.LanguageModelToolInformation) => tool.name.startsWith('cappy_'))
      
      console.log(`🛠️ Total tools: ${tools.length}, Cappy tools: ${cappyTools.length}`)
      console.log(`🛠️ Available Cappy tools: ${cappyTools.map((t: vscode.LanguageModelToolInformation) => t.name).join(', ')}`)
      console.log(`📝 Sending ${messages.length} messages to model`)
      console.log(`💬 Last message: ${message.content.substring(0, 50)}...`)

      // Send request with tools enabled and justification
      const options: vscode.LanguageModelChatRequestOptions = {
        justification: 'Cappy chat assistant is processing user request with available tools',
        tools: cappyTools
      }
      
      const cancellationSource = new vscode.CancellationTokenSource()

      for (let step = 1; step <= MAX_AGENT_STEPS; step++) {
        console.log(`[LangGraphChatEngine] Agentic step ${step} starting`)
        const response = await model.sendRequest(messages, options, cancellationSource.token)

  const assistantParts: (vscode.LanguageModelTextPart | vscode.LanguageModelToolCallPart)[] = []
        const toolCalls: vscode.LanguageModelToolCallPart[] = []

        for await (const part of response.stream) {
          if (part instanceof vscode.LanguageModelTextPart) {
            assistantParts.push(part)
            yield part.value
          } else if (part instanceof vscode.LanguageModelToolCallPart) {
            assistantParts.push(part)
            toolCalls.push(part)
          }
        }

        if (assistantParts.length > 0) {
          messages.push(vscode.LanguageModelChatMessage.Assistant(assistantParts))
        }

        const combinedAssistantText = assistantParts
          .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
          .map(part => part.value)
          .join('')

        if (combinedAssistantText) {
          if (combinedAssistantText.includes('<!-- agent:done -->')) {
            let planSaved = false

            try {
              const savedInfo = await this.persistPlanFromText(combinedAssistantText)
              if (savedInfo) {
                planSaved = true
                yield `\n\nPlan saved to \`${savedInfo.relativePath}\`\n\n`
              } else {
                yield '\n\nCould not find a valid JSON block to save.\n\n'
              }
            } catch (persistError) {
              const persistMessage = persistError instanceof Error ? persistError.message : 'Unknown error saving plan.'
              yield `\n\nCould not save plan automatically: ${persistMessage}\n\n`
            }

            if (planSaved) {
              yield 'Do you need anything else? (reply "yes" or "no")\n'
            }

            return
          }

          if (combinedAssistantText.includes('<!-- agent:continue -->')) {
            continue
          }
        }

        if (toolCalls.length === 0) {
          console.log('[LangGraphChatEngine] No tool calls detected, finishing agentic loop')
          return
        }

        for (const part of toolCalls) {
          const toolName = part.name.replace('cappy_', '')

          console.log('[LangGraphChatEngine] Tool call detected:', toolName)
          console.log('[LangGraphChatEngine] Auto-executing without confirmation')

          yield `\n\n🔧 Executing: ${toolName}\n\n`

          try {
            const toolResult = await vscode.lm.invokeTool(
              part.name,
              {
                input: part.input,
                toolInvocationToken: undefined
              },
              cancellationSource.token
            )

            const resultText = toolResult.content
              .filter(c => c instanceof vscode.LanguageModelTextPart)
              .map(c => (c as vscode.LanguageModelTextPart).value)
              .join('')

            if (resultText) {
              yield `${resultText}\n\n`
            }

            const toolResultPart = new vscode.LanguageModelToolResultPart(part.callId, toolResult.content)
            messages.push(vscode.LanguageModelChatMessage.User([toolResultPart]))
          } catch (toolError) {
            const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error'
            yield `\n\nTool error: ${errorMsg}\n\n`
            return
          }
        }
      }

      yield `\n\nAgentic iteration limit reached. Please adjust your request or complete manually.\n\n`
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        yield `\n\nLanguage Model Error: ${error.message}\n\n`
        
        // Handle specific error codes
        if (error.code === 'NoPermissions') {
          yield 'You need to grant permission to use the language model.\n'
          yield 'The first request will show a consent dialog.\n'
        } else if (error.code === 'NotFound') {
          yield 'The requested model was not found.\n'
          yield 'Make sure GitHub Copilot is installed and active.\n'
        } else if (error.code === 'Blocked') {
          yield 'Request blocked due to quota or rate limits.\n'
          yield 'Please try again later.\n'
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        yield `\n\nError: ${errorMessage}\n`
      }
    }
  }

  private extractJsonPlan(rawText: string): { json: string; data: unknown } | null {
    const codeBlockMatch = rawText.match(/```json\s*([\s\S]*?)```/i)
    const fallbackMatch = rawText.match(/```\s*([\s\S]*?)```/i)
    const directMatch = rawText.match(/\{[\s\S]*\}/)

    const candidate = codeBlockMatch?.[1]?.trim() ?? fallbackMatch?.[1]?.trim() ?? directMatch?.[0]?.trim()

    if (!candidate) {
      return null
    }

    try {
      const data = JSON.parse(candidate)
      return { json: candidate, data }
    } catch {
      return null
    }
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'plan'
  }

  private async persistPlanFromText(rawText: string): Promise<{ absolutePath: string; relativePath: string } | null> {
    const extracted = this.extractJsonPlan(rawText)

    if (!extracted) {
      return null
    }

    if (typeof extracted.data !== 'object' || extracted.data === null) {
      throw new Error('O plano final precisa ser um objeto JSON.')
    }

    const planObject = extracted.data as Record<string, unknown>
    const slugSource = this.getSlugSource(planObject)
    const slug = LangGraphChatEngine.slugify(slugSource)
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '')

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      throw new Error('Workspace não encontrado para salvar o plano.')
    }

    const tasksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks')
    await vscode.workspace.fs.createDirectory(tasksDirUri)

    const fileName = `${timestamp}_plan_${slug}.json`
    const fileUri = vscode.Uri.joinPath(tasksDirUri, fileName)
    const fileContent = Buffer.from(JSON.stringify(planObject, null, 2), 'utf8')

    await vscode.workspace.fs.writeFile(fileUri, fileContent)

    return {
      absolutePath: fileUri.fsPath,
      relativePath: path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath)
    }
  }

  private getSlugSource(plan: Record<string, unknown>): string {
    const id = plan.id
    if (typeof id === 'string' && id.trim().length > 0) {
      return id.trim()
    }

    const title = plan.title
    if (typeof title === 'string' && title.trim().length > 0) {
      return title.trim()
    }

    return 'plan'
  }

  /**
   * Wait for user response to a prompt
   * Returns true if user confirmed, false if cancelled
   */
}
