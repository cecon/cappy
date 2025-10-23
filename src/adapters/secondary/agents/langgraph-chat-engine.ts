import * as vscode from 'vscode'
import * as path from 'node:path'
import type { ChatAgentPort, ChatContext } from '../../../domains/chat/ports/agent-port'
import type { Message } from '../../../domains/chat/entities/message'

const MAX_AGENT_STEPS = 8

const SYSTEM_PROMPT = `
You are Cappy, a helpful AI assistant integrated into VS Code that can interact with the codebase to solve tasks.

<ROLE>
Your primary role is to assist users by creating comprehensive task files that will guide development work. You focus exclusively on:
* Reading the codebase database to gather maximum context
* Creating rich and effective task files with all necessary information
* Asking clarifying questions one-by-one until no doubts remain
* Structuring tasks into clear, actionable steps with precise file references

If the user asks a general question like "why is X happening", just answer the question without trying to create a task file.
</ROLE>

<TASK_FILE_GUIDELINES>
* Task files must be saved as: TASK_YYYY-MM-DD-HH-MM-SS_SLUG.md in the .cappy/tasks/ directory
* Use the context retrieval tool extensively to gather codebase information
* When referencing code from the retriever, always include the line numbers received (e.g., "see lines 45-67 in file.ts")
* Include precise file paths and line ranges to help the development agent locate relevant code quickly
* Structure each task with:
  - **Context**: Resources needed (files, documentation, APIs) with file paths and line numbers
  - **Objective**: Clear goal statement
  - **Steps**: Numbered action items with dependencies, deliverables, and acceptance criteria
  - **Why It Matters**: Technical rationale for each major component
* ALWAYS add a final step instructing the development agent to:
  1. Move the completed task file to .cappy/history/YYYY-MM/ directory
  2. Create a brief summary (2-3 sentences) of what was accomplished
  3. Run the workspace scanner to update the database with new changes
</TASK_FILE_GUIDELINES>

<QUESTIONING_STRATEGY>
* Ask questions one at a time, never in batches
* Wait for the user's response before asking the next question
* Continue asking until you have complete clarity about the task
* Confirm assumptions explicitly before proceeding
</QUESTIONING_STRATEGY>

<EFFICIENCY>
* Use the context retrieval tool (cappy_retrieve_context) to understand the codebase before asking questions
* Leverage line numbers from retrieval results to create precise references
* Combine related context into cohesive sections
</EFFICIENCY>

<COMPLETION_PROTOCOL>
* Mark intermediate work that needs continuation with: <!-- agent:continue -->
* Mark final output with: <!-- agent:done -->
* After saving the task file, provide:
  1. A brief thank you message
  2. Confirmation that the task was created
  3. A mini summary (2-3 sentences) of what the task will accomplish
  4. The file path where it was saved
* CRITICAL: Every task MUST include a final step that instructs the development agent to:
  - Move the task file to .cappy/history/YYYY-MM/ after completion
  - Add a completion summary to the file
  - Run the workspace scanner to update the codebase database
  - This ensures the knowledge base stays current with all changes
</COMPLETION_PROTOCOL>

Answer in the same language as the user unless explicitly instructed otherwise.
`.trim()

/**
 * Chat engine using GitHub Copilot's LLM via VS Code Language Model API
 * 
 * Uses vscode.lm.selectChatModels to access Copilot models.
 * Supports: streaming responses, tool calling, reasoning display
 */
export class LangGraphChatEngine implements ChatAgentPort {
  private readonly promptResolvers = new Map<string, (response: string) => void>()

  handleUserPromptResponse(messageId: string, response: string): void {
    const resolver = this.promptResolvers.get(messageId)
    if (resolver) {
      resolver(response)
      this.promptResolvers.delete(messageId)
    }
  }

  private waitForUserResponse(messageId: string): Promise<string> {
    return new Promise((resolve) => {
      this.promptResolvers.set(messageId, resolve)
    })
  }

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
            try {
              const savedInfo = await this.persistPlanFromText(combinedAssistantText)
              if (savedInfo) {
                // Extract task title for summary
                const extracted = this.extractTaskContent(combinedAssistantText)
                const taskTitle = extracted?.title || 'task'
                
                yield '\n\n---\n\n'
                yield '✅ **Task concluída com sucesso!**\n\n'
                yield `📄 Arquivo criado: \`${savedInfo.relativePath}\`\n\n`
                yield `📋 **Resumo**: Task "${taskTitle}" criada com contexto completo do código, referências precisas de arquivos e linha, e passos bem estruturados para execução.\n\n`
              } else {
                yield '\n\n⚠️ Não foi possível encontrar conteúdo válido para salvar a task.\n\n'
              }
            } catch (persistError) {
              const persistMessage = persistError instanceof Error ? persistError.message : 'Erro desconhecido ao salvar task.'
              yield `\n\n❌ Não foi possível salvar a task automaticamente: ${persistMessage}\n\n`
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
          
          // Send prompt request to frontend for user confirmation
          const promptMessageId = `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
          
          // Yield special marker that ChatMessageHandler will parse into promptRequest
          yield `__PROMPT_REQUEST__:${JSON.stringify({
            messageId: promptMessageId,
            question: `Execute ${toolName}?`,
            toolCall: {
              name: toolName,
              input: part.input
            }
          })}\n\n`

          // Wait for user response (frontend will send userPromptResponse)
          const userResponse = await this.waitForUserResponse(promptMessageId)
          
          if (userResponse !== 'yes') {
            yield `\n\n❌ Tool execution denied by user\n\n`
            return
          }

          yield `\n\n🔧 Executing: ${toolName}\n\n`

          try {
            let resultText = ''

            // Execute tools directly without VS Code confirmation
            if (toolName === 'create_file') {
              const input = part.input as { path: string; content: string }
              const filePath = path.isAbsolute(input.path)
                ? input.path
                : path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', input.path)
              
              const fileUri = vscode.Uri.file(filePath)
              const content = Buffer.from(input.content, 'utf-8')
              
              await vscode.workspace.fs.writeFile(fileUri, content)
              resultText = `✅ File created: ${input.path}`
              
              // Open the file
              const doc = await vscode.workspace.openTextDocument(fileUri)
              await vscode.window.showTextDocument(doc)
            } else {
              // For other tools, use VS Code invokeTool (will show confirmation)
              const toolResult = await vscode.lm.invokeTool(
                part.name,
                {
                  input: part.input,
                  toolInvocationToken: undefined
                },
                cancellationSource.token
              )

              resultText = toolResult.content
                .filter((c): c is vscode.LanguageModelTextPart => c instanceof vscode.LanguageModelTextPart)
                .map(c => c.value)
                .join('')
            }

            if (resultText) {
              yield `${resultText}\n\n`
            }

            // Add tool result to conversation
            const toolResultContent = [new vscode.LanguageModelTextPart(resultText)]
            const toolResultPart = new vscode.LanguageModelToolResultPart(part.callId, toolResultContent)
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

  private extractTaskContent(rawText: string): { content: string; title: string } | null {
    // Remove agent markers for cleaner content
    const cleanText = rawText
      .replaceAll('<!-- agent:done -->', '')
      .replaceAll('<!-- agent:continue -->', '')
      .trim()

    if (!cleanText) {
      return null
    }

    // Try to extract a title from the markdown
    const titleMatch = /^#\s+(.+)/m.exec(cleanText)
    const title = titleMatch?.[1]?.trim() || 'task'

    return { content: cleanText, title }
  }

  private static slugify(value: string): string {
    return value
      .normalize('NFKD')
      .replaceAll(/[\u0300-\u036f]/g, '')
      .replaceAll(/[^a-zA-Z0-9]+/g, '-')
      .replaceAll(/^-+/g, '')
      .replaceAll(/-+$/g, '')
      .toLowerCase() || 'task'
  }

  private async persistPlanFromText(rawText: string): Promise<{ absolutePath: string; relativePath: string } | null> {
    const extracted = this.extractTaskContent(rawText)

    if (!extracted) {
      return null
    }

    const slug = LangGraphChatEngine.slugify(extracted.title)
    
    // Format: TASK_YYYY-MM-DD-HH-MM-SS_SLUG.md
    const now = new Date()
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('-')

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      throw new Error('Workspace não encontrado para salvar a task.')
    }

    const tasksDirUri = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'tasks')
    await vscode.workspace.fs.createDirectory(tasksDirUri)

    const fileName = `TASK_${timestamp}_${slug}.md`
    const fileUri = vscode.Uri.joinPath(tasksDirUri, fileName)
    const fileContent = Buffer.from(extracted.content, 'utf8')

    await vscode.workspace.fs.writeFile(fileUri, fileContent)

    return {
      absolutePath: fileUri.fsPath,
      relativePath: path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath)
    }
  }

  /**
   * Wait for user response to a prompt
   * Returns true if user confirmed, false if cancelled
   */
}
