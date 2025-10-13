import { useEffect, useRef, useState } from 'react';
import { 
  AssistantRuntimeProvider, 
  useLocalRuntime, 
  type ChatModelAdapter, 
  type ChatModelRunOptions, 
  type ChatModelRunResult,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useMessage
} from '@assistant-ui/react';
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

// Custom events for prompt handling
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

// Custom adapter to connect VS Code backend with assistant-ui
class VSCodeChatAdapter implements ChatModelAdapter {
  private vscode: VsCodeApi;
  private sessionId?: string;
  
  constructor(vscode: VsCodeApi, sessionId?: string) {
    this.vscode = vscode;
    this.sessionId = sessionId;
  }

  private async promptUser(promptData: UserPrompt): Promise<string> {
    // Use custom event to communicate with React component
    return new Promise<string>((resolve) => {
      const event = new CustomEvent('prompt-request', {
        detail: {
          prompt: promptData,
          resolve
        }
      }) as PromptRequestEvent;
      
      window.dispatchEvent(event);
    });
  }

  async *run(options: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult, void> {
    const { messages } = options;
    
    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    // Extract text content from the message
    const userContent = lastMessage.content
      .filter((part) => part.type === 'text')
      .map((part) => ('text' in part ? part.text : ''))
      .join('');

    const messageId = Date.now().toString();
    const streamQueue: string[] = [];
    const reasoningQueue: string[] = [];
    let isDone = false;
    let hasError = false;
    let errorMessage = '';

    // Set up message listener
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.messageId !== messageId) return;
      
      console.log('[VSCodeChatAdapter] Received message:', message.type, message);
      
      switch (message.type) {
        case 'thinking':
          // Support custom reasoning text from backend
          reasoningQueue.push(message.text || '🧠 Pensando...');
          break;
        case 'streamStart':
          console.log('[VSCodeChatAdapter] Stream started');
          break;
        case 'streamToken':
          console.log('[VSCodeChatAdapter] Token received:', message.token.substring(0, 50));
          streamQueue.push(message.token);
          break;
        case 'streamEnd':
          console.log('[VSCodeChatAdapter] Stream ended');
          isDone = true;
          break;
        case 'streamError':
          console.error('[VSCodeChatAdapter] Stream error:', message.error);
          hasError = true;
          errorMessage = message.error || 'Unknown error';
          isDone = true;
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    try {
      // Send message to backend with messageId
      console.log('[VSCodeChatAdapter] Sending message to backend, messageId:', messageId);
      this.vscode.postMessage({
        type: 'sendMessage',
        sessionId: this.sessionId,
        content: userContent,
        messageId: messageId  // ✅ CRITICAL: Send messageId so backend uses the same one
      });

      // Stream tokens
      let accumulatedText = '';
      let accumulatedReasoning = '';
      let hasYieldedReasoning = false;
      let isInReasoningBlock = false;
      let isInPromptBlock = false;
      let reasoningBuffer = '';
      let promptBuffer = '';
      let loopCount = 0;
      const maxLoops = 60000; // 60s timeout (60000 * 10ms)
      
      while (!isDone && loopCount < maxLoops) {
        loopCount++;
        // Check if we have reasoning to show from initial thinking event
        if (reasoningQueue.length > 0 && !hasYieldedReasoning) {
          const reasoning = reasoningQueue.shift()!;
          accumulatedReasoning += reasoning;
          
          yield {
            content: [
              {
                type: 'reasoning' as const,
                text: accumulatedReasoning
              }
            ]
          };
          hasYieldedReasoning = true;
        }
        
        // Stream content tokens
        if (streamQueue.length > 0) {
          const token = streamQueue.shift()!;
          
          // Check for reasoning markers in stream
          if (token.includes('<!-- reasoning:start -->')) {
            isInReasoningBlock = true;
            reasoningBuffer = '';
            continue;
          }
          
          if (token.includes('<!-- reasoning:end -->')) {
            isInReasoningBlock = false;
            if (reasoningBuffer) {
              accumulatedReasoning += reasoningBuffer;
              hasYieldedReasoning = true;
              reasoningBuffer = '';
            }
            continue;
          }
          
          // Check for user prompt markers
          if (token.includes('<!-- userPrompt:start -->')) {
            isInPromptBlock = true;
            promptBuffer = '';
            continue;
          }
          
          if (token.includes('<!-- userPrompt:end -->')) {
            isInPromptBlock = false;
            if (promptBuffer) {
              // Parse prompt JSON
              try {
                const promptData = JSON.parse(promptBuffer.trim());
                
                // Wait for user response
                const response = await this.promptUser(promptData);
                
                // Send response back to backend
                this.vscode.postMessage({
                  type: 'userPromptResponse',
                  messageId: promptData.messageId,
                  response: response
                });
                
                promptBuffer = '';
              } catch (error) {
                console.error('Failed to parse prompt:', error);
                promptBuffer = '';
              }
            }
            continue;
          }
          
          // If we're in a prompt block, accumulate to prompt buffer
          if (isInPromptBlock) {
            promptBuffer += token;
            continue;
          }
          
          // If we're in a reasoning block, accumulate to reasoning buffer
          if (isInReasoningBlock) {
            reasoningBuffer += token;
            // Yield updated reasoning
            yield {
              content: [
                {
                  type: 'reasoning' as const,
                  text: accumulatedReasoning + reasoningBuffer
                },
                {
                  type: 'text' as const,
                  text: accumulatedText
                }
              ]
            };
            continue;
          }
          
          // Regular text token
          accumulatedText += token;
          
          const content: Array<{ type: 'reasoning' | 'text'; text: string }> = [];
          
          // Include reasoning if we had it
          if (hasYieldedReasoning) {
            content.push({
              type: 'reasoning' as const,
              text: accumulatedReasoning
            });
          }
          
          // Add text content
          content.push({
            type: 'text' as const,
            text: accumulatedText
          });
          
          yield { content };
        } else {
          // Wait for next token
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      if (loopCount >= maxLoops) {
        console.error('[VSCodeChatAdapter] Timeout waiting for response');
        throw new Error('Timeout waiting for response from backend');
      }

      if (hasError) {
        throw new Error(errorMessage);
      }
    } finally {
      window.removeEventListener('message', handleMessage);
    }
  }
}

export function ChatView({ sessionId, sessionTitle }: ChatViewProps) {
  console.log('[ChatView] Component mounting...')
  console.log('[ChatView] sessionId:', sessionId, 'sessionTitle:', sessionTitle)
  
  const vscode = useRef(window.vscodeApi);
  console.log('[ChatView] VSCode API:', vscode.current ? 'available' : 'MISSING')
  
  // State for current prompt
  const [currentPrompt, setCurrentPrompt] = useState<UserPrompt | null>(null);
  const promptResolverRef = useRef<((response: string) => void) | null>(null);
  
  // Create adapter
  const adapter = useRef(new VSCodeChatAdapter(vscode.current, sessionId)).current;
  
  // Create runtime with adapter (adapter is first parameter)
  const runtime = useLocalRuntime(adapter);

  // Listen for prompt requests from adapter
  useEffect(() => {
    const handlePromptRequest = (event: PromptRequestEvent) => {
      setCurrentPrompt(event.detail.prompt);
      promptResolverRef.current = event.detail.resolve;
    };

    window.addEventListener('prompt-request', handlePromptRequest as EventListener);
    return () => window.removeEventListener('prompt-request', handlePromptRequest as EventListener);
  }, []);

  // Handle prompt response
  const handlePromptResponse = (response: string) => {
    if (promptResolverRef.current) {
      promptResolverRef.current(response);
      promptResolverRef.current = null;
    }
    setCurrentPrompt(null);
  };

  // Listen for session loaded messages to update runtime
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'sessionLoaded' && message.messages) {
        // Convert messages to assistant-ui format and update runtime
        console.log('[ChatView] Session loaded with', message.messages.length, 'messages');
        // Note: assistant-ui manages messages internally, we don't need to manually load history
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="chat-container">
        <div className="chat-header">
          <h3>{sessionTitle || 'Chat'}</h3>
        </div>
        
        <ThreadPrimitive.Root>
          <ThreadPrimitive.Viewport className="chat-messages">
            <ThreadPrimitive.Messages
              components={{
                UserMessage: () => (
                  <MessagePrimitive.Root className="message user">
                    <div className="message-avatar">
                      <img src={userIcon} alt="User" />
                    </div>
                    <div className="message-content">
                      <MessagePrimitive.Content />
                    </div>
                  </MessagePrimitive.Root>
                ),
                AssistantMessage: () => {
                  const message = useMessage();
                  
                  return (
                    <MessagePrimitive.Root className="message assistant">
                      <div className="message-avatar">
                        <img src={cappyIcon} alt="Cappy" />
                      </div>
                      <div className="message-content">
                        {message.content.map((part: any, idx: number) => {
                          if ('type' in part && part.type === 'reasoning') {
                            return (
                              <div key={idx} className="message-reasoning" style={{
                                backgroundColor: '#2a2d3a',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                marginBottom: '8px',
                                fontSize: '0.9em',
                                fontStyle: 'italic',
                                color: '#a0a0a0',
                                borderLeft: '3px solid #4a90e2'
                              }}>
                                <span style={{ marginRight: '6px' }}>🧠</span>
                                {'text' in part ? part.text : ''}
                              </div>
                            );
                          }
                          if (part.type === 'text') {
                            return (
                              <div key={idx} className="message-text">
                                {'text' in part ? part.text : ''}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </MessagePrimitive.Root>
                  );
                },
              }}
            />
            
            {/* Render prompt message if there's one pending */}
            {currentPrompt && (
              <div style={{ padding: '16px' }}>
                <PromptMessage
                  prompt={currentPrompt}
                  onResponse={handlePromptResponse}
                />
              </div>
            )}
          </ThreadPrimitive.Viewport>

          <ComposerPrimitive.Root className="chat-input-container">
            <ComposerPrimitive.Input
              className="chat-input"
              placeholder="Ask Cappy..."
              rows={3}
            />
            <ComposerPrimitive.Send className="chat-send-button">
              ▶
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </div>
    </AssistantRuntimeProvider>
  );
}
