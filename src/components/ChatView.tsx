import { useEffect, useRef, useState } from 'react';
import { 
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult
} from '@assistant-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/vs2015.css';
import './ChatView.css';
import cappyIcon from '../assets/cappy-icon.svg';
import userIcon from '../assets/user-icon.svg';
import { PromptMessage } from './PromptMessage';
import type { UserPrompt } from '../domains/chat/entities/prompt';

interface ChatViewProps {
  sessionId?: string;
  sessionTitle?: string;
}

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
}

interface PromptRequestEvent extends CustomEvent {
  detail: {
    prompt: UserPrompt;
    resolve: (response: string) => void;
  };
}

declare global {
  interface Window {
    vscodeApi: VsCodeApi;
  }
  interface WindowEventMap {
    'prompt-request': PromptRequestEvent;
  }
}

interface TextContentPart {
  type: 'text';
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

  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    const { messages } = options;
    const lastMessage = messages[messages.length - 1];
    
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    const userContent = lastMessage.content
      .filter((part): part is TextContentPart => part.type === 'text')
      .map((part) => part.text)
      .join('');

    // @assistant-ui already provides full conversation history in messages
    // We just need to send the entire history to backend
    console.log('[VSCodeChatAdapter] Total messages in conversation:', messages.length);
    console.log('[VSCodeChatAdapter] Last message:', userContent.substring(0, 50) + '...');

    const messageId = Date.now().toString();
    let fullText = '';
    let isDone = false;
    let hasError = false;
    let errorMessage = '';

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      // Handle prompt requests (no messageId check needed)
      if (message.type === 'promptRequest') {
        console.log('[VSCodeChatAdapter] Received promptRequest:', message.prompt);
        const promptEvent = new CustomEvent('prompt-request', {
          detail: {
            prompt: message.prompt as UserPrompt,
            resolve: (response: string) => {
              console.log('[VSCodeChatAdapter] Sending user response:', response);
              this.vscode.postMessage({
                type: 'userPromptResponse',
                messageId: message.prompt.messageId,
                response
              });
            }
          }
        });
        window.dispatchEvent(promptEvent);
        return;
      }
      
      // Handle stream messages (require messageId match)
      if (message.messageId !== messageId) return;
      
      switch (message.type) {
        case 'streamToken':
          // Accumulate all text (reasoning + content)
          fullText += message.token;
          break;
        case 'streamEnd':
          isDone = true;
          break;
        case 'streamError':
          hasError = true;
          errorMessage = message.error || 'Unknown error';
          isDone = true;
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    try {
      // Send entire conversation history from @assistant-ui to backend
      // Convert messages to simple format
      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
          .filter((part): part is TextContentPart => part.type === 'text')
          .map(part => part.text)
          .join('')
      }));

      // Send message with history
      this.vscode.postMessage({
        type: 'sendMessage',
        messageId,
        text: userContent,
        history,  // Send full conversation history
        sessionId: this.sessionId
      });

      // Yield accumulated text periodically (filter out reasoning markers)
      let lastYieldedLength = 0;
      
      while (!isDone) {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (fullText.length > lastYieldedLength) {
          // Remove reasoning markers for display
          const displayText = fullText
            .replace(/<!-- reasoning:start -->/g, '')
            .replace(/<!-- reasoning:end -->/g, '');
          
          yield {
            content: [{ type: 'text', text: displayText }]
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
          .replace(/<!-- reasoning:start -->/g, '')
          .replace(/<!-- reasoning:end -->/g, '');
        
        yield {
          content: [{ type: 'text', text: displayText }]
        };
      }
    } finally {
      window.removeEventListener('message', handleMessage);
    }
  }
}

export function ChatView({ sessionId, sessionTitle }: ChatViewProps) {
  const vscode = useRef(window.vscodeApi);
  const [currentPrompt, setCurrentPrompt] = useState<UserPrompt | null>(null);
  const promptResolverRef = useRef<((response: string) => void) | null>(null);
  
  const adapter = useRef(new VSCodeChatAdapter(vscode.current, sessionId)).current;
  const runtime = useLocalRuntime(adapter);

  useEffect(() => {
    const handlePromptRequest = (event: PromptRequestEvent) => {
      console.log('[ChatView] Prompt request received:', event.detail.prompt);
      setCurrentPrompt(event.detail.prompt);
      promptResolverRef.current = event.detail.resolve;
    };

    window.addEventListener('prompt-request', handlePromptRequest as EventListener);
    return () => window.removeEventListener('prompt-request', handlePromptRequest as EventListener);
  }, []);

  const handlePromptResponse = (response: string) => {
    console.log('[ChatView] User responded:', response);
    if (promptResolverRef.current) {
      promptResolverRef.current(response);
      promptResolverRef.current = null;
    }
    setCurrentPrompt(null);
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="chat-container">
        <div className="chat-header">
          <h3>{sessionTitle || 'Chat'}</h3>
        </div>
        
        <ThreadPrimitive.Root className="chat-thread">
          <ThreadPrimitive.Viewport className="chat-messages">
            <ThreadPrimitive.Messages
              components={{
                UserMessage: () => (
                  <MessagePrimitive.Root className="message user">
                    <div className="message-avatar">
                      <img src={userIcon} alt="User" />
                    </div>
                    <div className="message-content">
                      <MessagePrimitive.Content 
                        components={{
                          Text: ({ text }) => <span>{text}</span>
                        }}
                      />
                    </div>
                  </MessagePrimitive.Root>
                ),
                AssistantMessage: () => (
                  <MessagePrimitive.Root className="message assistant">
                    <div className="message-avatar">
                      <img src={cappyIcon} alt="Cappy" />
                    </div>
                    <div className="message-content">
                      <MessagePrimitive.Content 
                        components={{
                          Text: ({ text }) => (
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                            >
                              {text}
                            </ReactMarkdown>
                          )
                        }}
                      />
                    </div>
                  </MessagePrimitive.Root>
                )
              }}
            />
          </ThreadPrimitive.Viewport>

          <div className="chat-composer">
            <ComposerPrimitive.Root>
              <ComposerPrimitive.Input 
                className="chat-input"
                placeholder="Digite sua mensagem..." 
                autoFocus
              />
              <ComposerPrimitive.Send className="chat-send-button">
                <span>➤</span>
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
          </div>
        </ThreadPrimitive.Root>

        {currentPrompt && (
          <PromptMessage 
            prompt={currentPrompt}
            onResponse={handlePromptResponse}
          />
        )}
      </div>
    </AssistantRuntimeProvider>
  );
}
