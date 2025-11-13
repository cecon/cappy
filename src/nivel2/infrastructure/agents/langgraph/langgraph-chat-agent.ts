import * as vscode from 'vscode'
import { Annotation, END, START, StateGraph, type AnnotationRoot } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph-checkpoint'
import type { RunnableConfig } from '@langchain/core/runnables'

interface ChatMemoryMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

interface AgentTurnParams {
  readonly prompt: string
  readonly sessionId: string
  readonly token?: vscode.CancellationToken
  readonly onToken?: (chunk: string) => void
}

const ChatStateDefinition: AnnotationRoot<{
  messages: ReturnType<typeof Annotation<ChatMemoryMessage[]>>
}> = Annotation.Root({
  messages: Annotation<ChatMemoryMessage[]>({
    reducer: (left: ChatMemoryMessage[], right: ChatMemoryMessage | ChatMemoryMessage[]) => {
      if (!right) {
        return left
      }

      if (Array.isArray(right)) {
        if (right.length === 0) {
          return left
        }
        return left.concat(right)
      }

      return left.concat([right])
    },
    default: () => []
  })
})

const SYSTEM_PROMPT = `You are Cappy, a helpful coding assistant working inside Visual Studio Code.

<BEHAVIOR>
- Answer in the same language used by the developer.
- Keep replies concise and focused on the requested outcome.
- Reference files using relative paths when helpful.
- When the developer greets you, reply politely then wait for the next instruction.
- If the developer asks about earlier parts of the conversation, use the stored history to answer.
</BEHAVIOR>

<LIMITS>
- Do not invent file paths or commands.
- Say "I don't know" when the information is not available in the conversation history.
</LIMITS>
`.trim()

export class LangGraphChatAgent {
  private readonly checkpointer = new MemorySaver()
  private readonly graph = this.createGraph()
  private model: vscode.LanguageModelChat | null = null
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    const models = await vscode.lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o'
    })

    if (!models.length) {
      throw new Error('No Copilot chat models available')
    }

    this.model = models[0]
    this.initialized = true
    console.log('[LangGraphChatAgent] Initialized with model:', this.model.name)
  }

  async runTurn(params: AgentTurnParams): Promise<string> {
    if (!this.initialized || !this.model) {
      await this.initialize()
    }

    if (!this.model) {
      throw new Error('Language model not available')
    }

    const { prompt, sessionId, token, onToken } = params
    const abortController = new AbortController()

    if (token) {
      token.onCancellationRequested(() => {
        abortController.abort()
      })
    }

    const config: RunnableConfig = {
      configurable: { thread_id: sessionId },
      signal: abortController.signal
    }

    const updatedState = await this.graph.invoke(
      { messages: [{ role: 'user', content: prompt }] },
      config
    )

    const history = updatedState.messages ?? []
    const assistantResponse = await this.generateAssistantResponse(history, token, onToken)

    if (assistantResponse) {
      await this.graph.invoke(
        { messages: [{ role: 'assistant', content: assistantResponse }] },
        config
      )
    }

    return assistantResponse
  }

  private createGraph() {
    const graphBuilder = new StateGraph(ChatStateDefinition)
      .addNode('noop', async () => ({}))
      .addEdge(START, 'noop')
      .addEdge('noop', END)

    return graphBuilder.compile({
      checkpointer: this.checkpointer
    })
  }

  private async generateAssistantResponse(
    history: ReadonlyArray<ChatMemoryMessage>,
    token?: vscode.CancellationToken,
    onToken?: (chunk: string) => void
  ): Promise<string> {
    const messages = this.buildChatMessages(history)

    const cancellation = new vscode.CancellationTokenSource()
    if (token) {
      token.onCancellationRequested(() => {
        cancellation.cancel()
      })
    }

    const response = await this.model!.sendRequest(
      messages,
      { justification: 'Cappy LangGraph chat turn' },
      cancellation.token
    )

    let collected = ''
    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        collected += part.value
        onToken?.(part.value)
      }
    }

    return collected.trim()
  }

  private buildChatMessages(history: ReadonlyArray<ChatMemoryMessage>): vscode.LanguageModelChatMessage[] {
    const messages: vscode.LanguageModelChatMessage[] = [
      vscode.LanguageModelChatMessage.User(SYSTEM_PROMPT)
    ]

    for (const item of history) {
      if (!item.content) {
        continue
      }

      if (item.role === 'user') {
        messages.push(vscode.LanguageModelChatMessage.User(item.content))
      } else {
        messages.push(vscode.LanguageModelChatMessage.Assistant(item.content))
      }
    }

    return messages
  }
}
