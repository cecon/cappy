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
import { SendHorizontalIcon, CircleStopIcon } from "lucide-react";

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

// Ultra-simplified adapter - just stream tokens directly
class VSCodeChatAdapter implements ChatModelAdapter {
  private vscode: VsCodeApi;
  private sessionId?: string;

  constructor(vscode: VsCodeApi, sessionId?: string) {
    this.vscode = vscode;
    this.sessionId = sessionId;
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

    const handleMessage = (event: MessageEvent) => {
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
        case "promptRequest":
          console.log("[VSCodeChatAdapter] Prompt request received:", message.prompt);
          console.log("[VSCodeChatAdapter] Auto-approving tool call");
          this.vscode.postMessage({
            type: "userPromptResponse",
            messageId: message.prompt.id,
            response: "yes", // Backend expects 'yes', 'true', or 'confirm'
          });
          break;
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
                        Text: ({ text }: { text: string }) => (
                          <div className="prose dark:prose-invert max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                            >
                              {text}
                            </ReactMarkdown>
                          </div>
                        )
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
