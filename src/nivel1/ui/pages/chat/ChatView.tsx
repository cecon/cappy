import { createContext, useContext, useMemo, useRef } from "react";
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
import { ToolCallConfirmation, type PendingToolCall } from "./tools/index.ts";

interface ChatViewProps {
  readonly sessionId?: string;
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
  private readonly vscode: VsCodeApi;
  private readonly sessionId?: string;
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
  const lastMessage = messages.at(-1);

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

  // Handle stream messages from backend

      // Handle stream messages (require messageId match)
      if (message.messageId !== messageId) {
  // Ignore messages for other requests
        return;
      }

      switch (message.type) {
        case "streamToken": {
          // Accumulate all text (reasoning + content)
          // Append token to full text
          fullText += message.token;
          
          // Check if token contains __PROMPT_REQUEST__
          if (message.token.includes('__PROMPT_REQUEST__:')) {
            const promptRegex = /__PROMPT_REQUEST__:({.+})/;
            const match = promptRegex.exec(message.token);
            if (match) {
              try {
                const promptData = JSON.parse(match[1]);
                
                // Create pending tool call and add to map
                const promptMessageId = promptData.messageId;
                const userDecision = new Promise<boolean>((resolve) => {
                  const pendingTool: PendingToolCall = {
                    messageId: promptMessageId,
                    toolName: promptData.toolCall?.name || "unknown",
                    args: promptData.toolCall?.input || {},
                    question: promptData.question || "Execute tool?",
                    resolver: resolve,
                  };
                  this.pendingToolCalls.set(promptMessageId, pendingTool);
                });

                // Add marker to text for UI to detect
                fullText += `\n\n__TOOL_CALL_PENDING__:${promptMessageId}\n\n`;
                
                // Wait for user decision in background
                userDecision.then((approved) => {
                  // Send response to backend
                  this.vscode.postMessage({
                    type: "userPromptResponse",
                    messageId: promptMessageId,
                    response: approved ? "yes" : "no",
                  });
                }).catch(() => {/* no-op */});
              } catch {
                // Ignore malformed prompt hints
              }
            }
          }
          break;
        }
        case "streamEnd":
          isDone = true;
          break;
        case "streamError":
          hasError = true;
          errorMessage = message.error || "Unknown error";
          isDone = true;
          break;
        case "promptRequest": {
          
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
          });

          // Add marker to text
          fullText += `\n\n__TOOL_CALL_PENDING__:${message.promptMessageId}\n\n`;
          
          // The periodic yield loop below will pick up this change and render the UI
          
          // Wait for user decision
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
      isDone = true;
      hasError = true;
      errorMessage = "Cancelled by user";
    };

    if (abortSignal) {
      abortSignal.addEventListener("abort", handleAbort);
    }

    const onMessage = (evt: Event) => { void handleMessage(evt as MessageEvent); };
    globalThis.addEventListener("message", onMessage);

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
            .replaceAll("<!-- reasoning:start -->", "")
            .replaceAll("<!-- reasoning:end -->", "");

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
          .replaceAll("<!-- reasoning:start -->", "")
          .replaceAll("<!-- reasoning:end -->", "");

        yield {
          content: [{ type: "text", text: displayText }],
        };
      }
    } finally {
      globalThis.removeEventListener("message", onMessage);
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

// Adapter context to avoid nested component definitions needing props drilling
const AdapterContext = createContext<VSCodeChatAdapter | null>(null);

const useChatAdapter = () => {
  const ctx = useContext(AdapterContext);
  if (!ctx) throw new Error("Chat adapter not available in context");
  return ctx;
};

const UserMessage: React.FC = () => (
  <MessagePrimitive.Root className="mb-4 flex justify-end">
    <div className="max-w-[80%] rounded-2xl bg-blue-500 px-4 py-2 text-white">
      <MessagePrimitive.Content />
    </div>
  </MessagePrimitive.Root>
);

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1">
    <div className="size-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500 [animation-delay:-0.3s]" />
    <div className="size-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500 [animation-delay:-0.15s]" />
    <div className="size-2 animate-bounce rounded-full bg-gray-400 dark:bg-gray-500" />
  </div>
);

const AssistantText: React.FC<{ text: string }> = ({ text }) => {
  const adapter = useChatAdapter();
  // Detect pending tool marker
  const pendingRegex = /__TOOL_CALL_PENDING__:([^\s]+)/;
  const pendingMatch = pendingRegex.exec(text);
  const pendingMessageId = pendingMatch?.[1]?.trim();
  const pendingTool = pendingMessageId ? adapter.pendingToolCalls.get(pendingMessageId) : null;

  // Remove all special markers for display
  const cleanText = text
    .replaceAll(/__TOOL_CALL_PENDING__:[^\s]+/g, '')
    .replaceAll(/__PROMPT_REQUEST__:[^\n]+/g, '')
    .replaceAll(/<!-- reasoning:start -->[\s\S]*?<!-- reasoning:end -->/g, '')
    .trim();

  const actions = {
    approveToolCall: (id: string) => adapter.approveToolCall(id),
    denyToolCall: (id: string) => adapter.denyToolCall(id),
  };

  // Show typing indicator when there's no content yet
  if (!cleanText && !pendingTool) {
    return <TypingIndicator />;
  }

  return (
    <>
      {cleanText && (
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {cleanText}
          </ReactMarkdown>
        </div>
      )}
      {pendingTool && <ToolCallConfirmation pendingTool={pendingTool} actions={actions} />}
    </>
  );
};

const AssistantMessage: React.FC = () => (
  <MessagePrimitive.Root className="mb-4">
    <div className="max-w-[80%] rounded-2xl bg-gray-100 dark:bg-gray-800 px-4 py-2">
      <MessagePrimitive.Content components={{ Text: AssistantText }} />
    </div>
  </MessagePrimitive.Root>
);

export function ChatView({ sessionId }: Readonly<ChatViewProps>) {
  console.log('[ChatView] 🚀 ChatView component rendering...', { sessionId })
  
  // Resolve VS Code API lazily to allow the dev mock script to attach later
  const vscodeApi = useMemo<VsCodeApi>(() => {
    console.log('[ChatView] 🔧 Initializing VS Code API...')
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { window?: unknown }).window) {
        const w = (globalThis as unknown as { window: unknown }).window as Window & { vscodeApi?: VsCodeApi; acquireVsCodeApi?: () => VsCodeApi };
        if (w.vscodeApi) {
          console.log('[ChatView] ✅ Using existing vscodeApi')
          return w.vscodeApi;
        }
        if (typeof w.acquireVsCodeApi === 'function') {
          console.log('[ChatView] ✅ Acquiring vscodeApi...')
          const api = w.acquireVsCodeApi();
          w.vscodeApi = api;
          return api;
        }
      }
      console.warn('[ChatView] ⚠️ No vscodeApi available, using mock')
    } catch (error) {
      console.error('[ChatView] ❌ Error acquiring vscodeApi:', error)
    }
    return { postMessage: () => {} };
  }, []);

  console.log('[ChatView] 🤖 Creating chat adapter...')
  const adapter = useRef(
    new VSCodeChatAdapter(vscodeApi, sessionId)
  ).current;
  
  console.log('[ChatView] 🔄 Creating local runtime...')
  const runtime = useLocalRuntime(adapter);
  
  console.log('[ChatView] ✅ Rendering chat UI...')

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AdapterContext.Provider value={adapter}>
      <ThreadPrimitive.Root className="flex h-screen flex-col">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 pt-8">
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              AssistantMessage: AssistantMessage,
            }}
          />
        </ThreadPrimitive.Viewport>

        <div className="border-t p-4">
          <Composer />
        </div>
      </ThreadPrimitive.Root>
      </AdapterContext.Provider>
    </AssistantRuntimeProvider>
  );
}
