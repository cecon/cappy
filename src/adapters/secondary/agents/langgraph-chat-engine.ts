import * as vscode from 'vscode'
import type { ChatAgentPort, ChatContext } from '../../../domains/chat/ports/agent-port'
import type { Message } from '../../../domains/chat/entities/message'

/**
 * Chat engine using GitHub Copilot's LLM via VS Code Language Model API
 * 
 * Uses vscode.lm.selectChatModels to access Copilot models.
 * Future: Add tool calling, planning, and multi-step workflows.
 */
export class LangGraphChatEngine implements ChatAgentPort {
  async *processMessage(message: Message, context: ChatContext): AsyncIterable<string> {
    try {
      // Select a Copilot chat model
      const models = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o'
      })

      if (models.length === 0) {
        yield '❌ No Copilot models available. Make sure you have:\n'
        yield '1. GitHub Copilot extension installed\n'
        yield '2. GitHub Copilot subscription active\n'
        yield '3. Signed in to GitHub in VS Code'
        return
      }

      const model = models[0]

      // Build message array for the model
      const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(
          'You are Cappy, an AI coding assistant integrated into VS Code. ' +
          'You help developers write code, debug issues, understand codebases, and improve productivity. ' +
          'Be concise, helpful, and provide actionable advice. ' +
          'Use markdown formatting for code blocks.'
        )
      ]

      // Add conversation history from context
      for (const msg of context.history) {
        if (msg.author === 'user') {
          messages.push(vscode.LanguageModelChatMessage.User(msg.content))
        } else if (msg.author === 'assistant') {
          messages.push(vscode.LanguageModelChatMessage.Assistant(msg.content))
        }
      }

      // Add the current user message
      messages.push(vscode.LanguageModelChatMessage.User(message.content))

      // Get available tools
      const tools = vscode.lm.tools
      const cappyTools = tools.filter((tool: vscode.LanguageModelToolInformation) => tool.name.startsWith('cappy_'))
      
      console.log(`🛠️ Total tools: ${tools.length}, Cappy tools: ${cappyTools.length}`)
      console.log(`🛠️ Available Cappy tools: ${cappyTools.map((t: vscode.LanguageModelToolInformation) => t.name).join(', ')}`)
      console.log(`📝 Sending ${messages.length} messages to model`)
      console.log(`💬 Last message: ${message.content.substring(0, 50)}...`)

      // Send request with tools enabled
      const options: vscode.LanguageModelChatRequestOptions = {
        tools: cappyTools
      }
      
      const response = await model.sendRequest(messages, options, new vscode.CancellationTokenSource().token)

      // Process response stream - handle both text and tool calls
      for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          yield part.value
        } else if (part instanceof vscode.LanguageModelToolCallPart) {
          // Tool call detected
          yield `\n🔧 Using tool: ${part.name}\n`
          
          try {
            // Invoke the tool
            const toolResult = await vscode.lm.invokeTool(
              part.name, 
              {
                input: part.input,
                toolInvocationToken: undefined // Not in a chat participant context
              },
              new vscode.CancellationTokenSource().token
            )
            
            // Add tool result to conversation and continue
            messages.push(vscode.LanguageModelChatMessage.Assistant([part]))
            
            // Create tool result part with callId
            const toolResultPart = new vscode.LanguageModelToolResultPart(part.callId, toolResult.content)
            messages.push(vscode.LanguageModelChatMessage.User([toolResultPart]))
            
            // Get follow-up response from model with tool result
            const followUp = await model.sendRequest(messages, options, new vscode.CancellationTokenSource().token)
            for await (const followUpPart of followUp.stream) {
              if (followUpPart instanceof vscode.LanguageModelTextPart) {
                yield followUpPart.value
              }
            }
          } catch (toolError) {
            const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error'
            yield `\n❌ Tool error: ${errorMsg}\n`
          }
        }
      }
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        yield `\n\n❌ Language Model Error: ${error.message}\n\n`
        
        // Handle specific error codes
        if (error.code === 'NoPermissions') {
          yield '⚠️ You need to grant permission to use the language model.\n'
          yield 'The first request will show a consent dialog.'
        } else if (error.code === 'NotFound') {
          yield '⚠️ The requested model was not found.\n'
          yield 'Make sure GitHub Copilot is installed and active.'
        } else if (error.code === 'Blocked') {
          yield '⚠️ Request blocked due to quota or rate limits.\n'
          yield 'Please try again later.'
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        yield `\n\n❌ Error: ${errorMessage}\n`
      }
    }
  }
}
