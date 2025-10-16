import { useRef } from "react";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
} from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { SendHorizontalIcon, CircleStopIcon } from "lucide-react";
import { ToolCallConfirmation, type PendingToolCall } from "./tools";

interface ChatViewProps {
  sessionId?: string;
}

interface VsCodeApi {
  postMessage: (message: unknown) => void;
}

declare global {
  interface Window {
    vscodeApi: VsCodeApi;
  }
}

interface TextContentPart {
  type: "text";
  text: string;
}

// Ultra-simplified adapter - just stream tokens directly
class VSCodeChatAdapter implements ChatModelAdapter {
  private vscode: VsCodeApi;
  private sessionId?: string;
  public pendingToolCalls: Map<string, PendingToolCall> = new Map();

  constructor(vscode: VsCodeApi, sessionId?: string) {
    this.vscode = vscode;
    this.sessionId = sessionId;
  }

  public approveToolCall(messageId: string) {
    const pending = this.pendingToolCalls.get(messageId);
    if (pending) {
      pending.resolver(true);
      this.pendingToolCalls.delete(messageId);
    }
  }

  public denyToolCall(messageId: string) {
    const pending = this.pendingToolCalls.get(messageId);
    if (pending) {
      pending.resolver(false);
      this.pendingToolCalls.delete(messageId);
    }
  }

  async *run(
    options: ChatModelRunOptions
  ): AsyncGenerator<ChatModelRunResult, void> {
    const { messages, abortSignal } = options;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      throw new Error("Last message must be from user");
    }

    const userContent = lastMessage.content
      .filter((part): part is TextContentPart => part.type === "text")
      .map((part) => part.text)
      .join("");

    const messageId = Date.now().toString();
    let fullText = "";
    let isDone = false;
    let hasError = false;
    let errorMessage = "";

    const handleMessage = async (event: MessageEvent) => {
      const message = event.data;

      // Handle stream messages (require messageId match)
      if (message.messageId !== messageId) return;

      switch (message.type) {
        case "streamToken":
          // Accumulate all text (reasoning + content)
          fullText += message.token;
          break;
        case "streamEnd":
          isDone = true;
          break;
        case "streamError":
          hasError = true;
          errorMessage = message.error || "Unknown error";
          isDone = true;
          break;
        case "promptRequest": {
          console.log('[ChatView] Received promptRequest:', message.promptMessageId);
          
          // Create pending tool call and add to map
          const userDecision = new Promise<boolean>((resolve) => {
            const pendingTool: PendingToolCall = {
              messageId: message.promptMessageId,
              toolName: message.prompt?.toolCall?.name || "unknown",
              args: message.prompt?.toolCall?.input || {},
              question: message.prompt?.question || "Execute tool?",
              resolver: resolve,
            };
            this.pendingToolCalls.set(message.promptMessageId, pendingTool);
            console.log('[ChatView] Added pending tool call:', pendingTool);
          });

          // Add marker to text
          fullText += `\n\n__TOOL_CALL_PENDING__:${message.promptMessageId}\n\n`;
          console.log('[ChatView] Added marker to fullText:', fullText.substring(fullText.length - 100));
          
          // The periodic yield loop below will pick up this change and render the UI
          
          // Wait for user decision
          const approved = await userDecision;
          console.log('[ChatView] User decision:', approved);

          // Send response to backend
          this.vscode.postMessage({
            type: "userPromptResponse",
            messageId: message.promptMessageId,
            response: approved ? "yes" : "no",
          });

          // Update text to show result
          if (approved) {
            fullText += `✅ Tool approved\n\n`;
          } else {
            fullText += `❌ Tool denied\n\n`;
            isDone = true;
          }
          break;
        }
      }
    };

    // Handle abort signal
    const handleAbort = () => {
      isDone = true;
      hasError = true;
      errorMessage = "Cancelled by user";
    };

    if (abortSignal) {
      abortSignal.addEventListener("abort", handleAbort);
    }

    window.addEventListener("message", handleMessage);

    try {
      // Send entire conversation history from @assistant-ui to backend
      // Convert messages to simple format
      const history = messages.slice(0, -1).map((msg) => ({
        role: msg.role,
        content: msg.content
          .filter((part): part is TextContentPart => part.type === "text")
          .map((part) => part.text)
          .join(""),
      }));

      // Send message with history
      this.vscode.postMessage({
        type: "sendMessage",
        messageId,
        text: userContent,
        history, // Send full conversation history
        sessionId: this.sessionId,
      });

      // Yield accumulated text periodically (filter out reasoning markers)
      let lastYieldedLength = 0;

      while (!isDone) {
        await new Promise((resolve) => setTimeout(resolve, 50));

        if (fullText.length > lastYieldedLength) {
          // Remove reasoning markers for display
          const displayText = fullText
            .replace(/<!-- reasoning:start -->/g, "")
            .replace(/<!-- reasoning:end -->/g, "");

          yield {
            content: [{ type: "text", text: displayText }],
          };
          lastYieldedLength = fullText.length;
        }

        if (hasError) {
          throw new Error(errorMessage);
        }
      }

      // Final yield (filter reasoning markers)
      if (fullText) {
        const displayText = fullText
          .replace(/<!-- reasoning:start -->/g, "")
          .replace(/<!-- reasoning:end -->/g, "");

        yield {
          content: [{ type: "text", text: displayText }],
        };
      }
    } finally {
      window.removeEventListener("message", handleMessage);
      if (abortSignal) {
        abortSignal.removeEventListener("abort", handleAbort);
      }
    }
  }
}

const IconButton = ({ className, children }: {
  className: string;
  children: React.ReactNode;
}) => {
  return (
    <button className={className} type="submit">
      {children}
    </button>
  );
};

const ComposerAction = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <IconButton className="my-2.5 size-8 p-2 transition-opacity ease-in rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            <SendHorizontalIcon className="size-full" />
          </IconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <IconButton className="my-2.5 size-8 p-2 transition-opacity ease-in rounded-md bg-destructive text-primary-foreground hover:bg-destructive/90">
            <CircleStopIcon className="size-full" />
          </IconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const Composer = () => {
  return (
    <ComposerPrimitive.Root className="focus-within:border-ring/20 flex w-full flex-wrap items-end rounded-lg border bg-inherit px-2.5 shadow-sm transition-colors ease-in">
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Write a message..."
        className="placeholder:text-muted-foreground max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

export function ChatView({ sessionId }: ChatViewProps) {
  const vscode = useRef(window.vscodeApi);

  const adapter = useRef(
    new VSCodeChatAdapter(vscode.current, sessionId)
  ).current;
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-screen flex-col">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 pt-8">
          <ThreadPrimitive.Messages
            components={{
              UserMessage: () => (
                <MessagePrimitive.Root className="mb-4 flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-blue-500 px-4 py-2 text-white">
                    <MessagePrimitive.Content />
                  </div>
                </MessagePrimitive.Root>
              ),
              AssistantMessage: () => (
                <MessagePrimitive.Root className="mb-4">
                  <div className="max-w-[80%] rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-2">
                    <MessagePrimitive.Content
                      components={{
                        Text: ({ text }: { text: string }) => {
                          // Detecta se há um tool pendente nesta mensagem (pode estar em qualquer lugar do texto)
                          const pendingMatch = text.match(/__TOOL_CALL_PENDING__:([^\s\n]+)/);
                          const pendingMessageId = pendingMatch?.[1]?.trim();
                          const pendingTool = pendingMessageId ? adapter.pendingToolCalls.get(pendingMessageId) : null;

                          console.log('[ChatView.Text] text:', text.substring(0, 200));
                          console.log('[ChatView.Text] pendingMatch:', pendingMatch);
                          console.log('[ChatView.Text] pendingMessageId:', pendingMessageId);
                          console.log('[ChatView.Text] pendingTool:', pendingTool);
                          console.log('[ChatView.Text] adapter.pendingToolCalls size:', adapter.pendingToolCalls.size);

                          // Remove o marker do texto exibido
                          const cleanText = text.replace(/__TOOL_CALL_PENDING__:[^\s\n]+/g, '').trim();

                          // Cria objeto de actions para o componente
                          const actions = {
                            approveToolCall: (id: string) => adapter.approveToolCall(id),
                            denyToolCall: (id: string) => adapter.denyToolCall(id)
                          };

                          return (
                            <>
                              {cleanText && (
                                <div className="prose dark:prose-invert max-w-none">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeHighlight]}
                                  >
                                    {cleanText}
                                  </ReactMarkdown>
                                </div>
                              )}
                              {pendingTool && <ToolCallConfirmation pendingTool={pendingTool} actions={actions} />}
                            </>
                          );
                        }
                      }}
                    />
                  </div>
                </MessagePrimitive.Root>
              ),
            }}
          />
        </ThreadPrimitive.Viewport>

        <div className="border-t p-4">
          <Composer />
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
