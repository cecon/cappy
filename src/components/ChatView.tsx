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
    const { messages } = options;
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
      }
    };

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
    }
  }
}

export function ChatView({ sessionId, sessionTitle }: ChatViewProps) {
  const vscode = useRef(window.vscodeApi);

  const adapter = useRef(
    new VSCodeChatAdapter(vscode.current, sessionId)
  ).current;
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-col h-screen bg-vscode-background">
        <div className="p-3 border-b border-vscode-border">
          <h3 className="m-0 text-vscode-foreground">
            {sessionTitle || "Chat"}
          </h3>
        </div>

        <ThreadPrimitive.Root className="flex flex-col flex-1">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4">
            <ThreadPrimitive.Messages
              components={{
                UserMessage: () => (
                  <MessagePrimitive.Root>
                    <MessagePrimitive.Content />
                  </MessagePrimitive.Root>
                ),
                AssistantMessage: () => (
                  <MessagePrimitive.Root>
                    <MessagePrimitive.Content
                      components={{
                        Text: ({ text }: { text: string }) => (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                          >
                            {text}
                          </ReactMarkdown>
                        )
                      }}
                    />
                  </MessagePrimitive.Root>
                ),
              }}
            />
          </ThreadPrimitive.Viewport>

          <ComposerPrimitive.Root className="flex gap-2 p-3 border-t border-vscode-border">
            <ComposerPrimitive.Input
              placeholder="Digite sua mensagem..."
              autoFocus
              className="flex-1 bg-vscode-input-background text-vscode-input-foreground"
            />
            <ComposerPrimitive.Send className="px-3 py-2 bg-vscode-button-background text-vscode-button-foreground rounded hover:opacity-90">
              ➤
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
