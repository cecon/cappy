import { useRef, type FC } from "react";
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
import { SendHorizontalIcon, CircleStopIcon, CheckIcon, XIcon } from "lucide-react";

interface ChatViewProps {
  sessionId?: string;
  sessionTitle?: string;
}

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
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

interface PendingToolCall {
  messageId: string;
  toolName: string;
  args: Record<string, unknown>;
  question: string;
  resolver: (approved: boolean) => void;
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

    // @assistant-ui already provides full conversation history in messages
    // We just need to send the entire history to backend
    console.log(
      "[VSCodeChatAdapter] Total messages in conversation:",
      messages.length
    );
    console.log(
      "[VSCodeChatAdapter] Last message:",
      userContent.substring(0, 50) + "..."
    );

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
          console.log("[VSCodeChatAdapter] Prompt request received:", message);
          console.log("[VSCodeChatAdapter] promptMessageId:", message.promptMessageId);
          console.log("[VSCodeChatAdapter] prompt data:", message.prompt);
          
          // Create pending tool call FIRST (before adding marker)
          const userDecision = new Promise<boolean>((resolve) => {
            const pendingTool: PendingToolCall = {
              messageId: message.promptMessageId,
              toolName: message.prompt?.toolCall?.name || "unknown",
              args: message.prompt?.toolCall?.input || {},
              question: message.prompt?.question || "Execute tool?",
              resolver: resolve,
            };
            console.log("[VSCodeChatAdapter] Adding to pendingToolCalls:", pendingTool);
            this.pendingToolCalls.set(message.promptMessageId, pendingTool);
            console.log("[VSCodeChatAdapter] Map size after set:", this.pendingToolCalls.size);
          });

          // Yield tool call UI to show confirmation buttons
          fullText += `\n\n__TOOL_CALL_PENDING__:${message.promptMessageId}\n\n`;
          console.log("[VSCodeChatAdapter] Added marker to text");

          // Wait for user decision (this will pause execution until button click)
          const approved = await userDecision;

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
      console.log("[VSCodeChatAdapter] Stream cancelled by user");
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

const TooltipIconButton: FC<{
  tooltip: string;
  variant: string;
  className: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  return (
    <button className={className} type="submit">
      {children}
    </button>
  );
};

const ComposerAction: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <SendHorizontalIcon className="size-full" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            className="my-2.5 size-8 p-2 transition-opacity ease-in rounded-md bg-destructive text-primary-foreground hover:bg-destructive/90"
          >
            <CircleStopIcon className="size-full" />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const ToolCallConfirmation: FC<{ adapter: VSCodeChatAdapter; pendingTool: PendingToolCall }> = ({ adapter, pendingTool }) => {
  const handleApprove = () => {
    adapter.approveToolCall(pendingTool.messageId);
  };

  const handleDeny = () => {
    adapter.denyToolCall(pendingTool.messageId);
  };

  return (
    <div className="my-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-medium text-sm mb-1">🔧 {pendingTool.toolName}</div>
          <div className="text-xs text-muted-foreground mb-2">
            {pendingTool.question}
          </div>
          {Object.keys(pendingTool.args).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View parameters
              </summary>
              <pre className="mt-2 overflow-auto max-h-32 p-2 rounded bg-muted">
                {JSON.stringify(pendingTool.args, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleApprove}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <CheckIcon className="size-3" />
          Allow
        </button>
        <button
          onClick={handleDeny}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <XIcon className="size-3" />
          Deny
        </button>
      </div>
    </div>
  );
};

const Composer: FC = () => {
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
                          // Detecta se há um tool pendente nesta mensagem
                          const pendingMatch = text.match(/__TOOL_CALL_PENDING__:(.+)$/);
                          const pendingMessageId = pendingMatch?.[1]?.trim();
                          
                          console.log("[Text Component] Raw text:", text);
                          console.log("[Text Component] Pending match:", pendingMatch);
                          console.log("[Text Component] Pending messageId:", pendingMessageId);
                          console.log("[Text Component] Adapter pendingToolCalls size:", adapter.pendingToolCalls.size);
                          
                          const pendingTool = pendingMessageId ? adapter.pendingToolCalls.get(pendingMessageId) : null;
                          console.log("[Text Component] Found pendingTool:", pendingTool);

                          // Remove o marker do texto exibido
                          const cleanText = text.replace(/__TOOL_CALL_PENDING__:.+$/, '').trim();

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
                              {pendingTool && <ToolCallConfirmation adapter={adapter} pendingTool={pendingTool} />}
                              {!pendingTool && pendingMessageId && (
                                <div className="text-red-500 text-xs">
                                  Debug: Tool not found in Map. ID: {pendingMessageId}
                                </div>
                              )}
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
