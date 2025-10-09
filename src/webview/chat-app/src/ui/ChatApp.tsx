import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgentContextItem,
  AgentTool,
  ChatMessage,
  LLMModel,
  StreamingState
} from '../types';

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage: (message: unknown) => void };
  }
}

type ConversationEntry = {
  role: 'user' | 'assistant';
  content: string;
};

type VsCodeApi = ReturnType<NonNullable<Window['acquireVsCodeApi']>>;

const toMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const QUICK_ACTIONS: Record<string, string> = {
  explain: 'Explain the current code selection',
  'create-task': 'Create a new Cappy task for: ',
  analyze: 'Analyze the project structure and dependencies',
  search: 'Search the codebase for: '
};

type QuickActionKey = keyof typeof QUICK_ACTIONS;

const ATTACH_OPTIONS: Array<{ type: 'currentFile' | 'selection' | 'activeTask'; icon: string; label: string; description: string }> = [
  {
    type: 'currentFile',
    icon: '📄',
    label: 'Current File',
    description: 'Add the current file to context'
  },
  {
    type: 'selection',
    icon: '✂️',
    label: 'Selection',
    description: 'Add current selection'
  },
  {
    type: 'activeTask',
    icon: '📝',
    label: 'Active Task',
    description: 'Add current Cappy task'
  }
];

const CONTEXT_ICONS: Record<string, string> = {
  file: '📄',
  selection: '✂️',
  task: '📝',
  project: '📁',
  search: '🔍',
  prevention: '🛡️'
};

const TOOL_DEFAULT_ICON = '🛠️';

const ChatApp: React.FC = () => {
  const vscodeRef = useRef<VsCodeApi | undefined>();
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<ConversationEntry[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [contextItems, setContextItems] = useState<AgentContextItem[]>([]);
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('copilot-gpt-4');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingState, setStreamingState] = useState<StreamingState>({ active: false, fullText: '' });

  const hasMessages = messages.length > 0;

  const contextInfo = useMemo(() => {
    const count = contextItems.length;
    if (count === 0) {
      return '';
    }
    const plural = count > 1 ? 'items' : 'item';
    return `${count} context ${plural} attached`;
  }, [contextItems]);

  const scrollToBottom = useCallback(() => {
    const container = chatMessagesRef.current;
    if (!container) {
      return;
    }
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, []);

  const ensureVscodeApi = useCallback(() => {
    if (!vscodeRef.current && typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
      vscodeRef.current = window.acquireVsCodeApi();
    }
    return vscodeRef.current;
  }, []);

  const postMessage = useCallback((message: unknown) => {
    const vscode = ensureVscodeApi();
    vscode?.postMessage(message);
  }, [ensureVscodeApi]);

  const updateStreamingMessage = useCallback((messageId: string, updater: (text: string) => string) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) {
          return message;
        }
        const nextContent = updater(message.content);
        return {
          ...message,
          content: nextContent,
          streaming: false
        };
      })
    );
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const timestamp = Date.now();
    const messageId = toMessageId('user');
    const newMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: trimmed,
      timestamp
    };

    const updatedHistory = [...conversationRef.current, { role: 'user', content: trimmed }];
    conversationRef.current = updatedHistory.slice(-20);

    setMessages((prev) => [...prev, newMessage]);
    setInputValue('');
    setCharCount(0);
    setShowAttachPanel(false);
    setShowToolsPanel(false);

    postMessage({
      type: 'agentQuery',
      prompt: trimmed,
      model: selectedModel,
      context: contextItems,
      history: conversationRef.current.slice(-10),
      tools: availableTools
    });

    setIsTyping(true);
    setStreamingState({ active: false, fullText: '' });

    scrollToBottom();
  }, [availableTools, contextItems, inputValue, postMessage, scrollToBottom, selectedModel]);

  const handleQuickAction = useCallback((action: QuickActionKey) => {
    const nextValue = QUICK_ACTIONS[action] ?? '';
    setInputValue(nextValue);
    setCharCount(nextValue.length);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleModelSelection = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDropdown(false);
  }, []);

  const handleToolSelection = useCallback((toolName: string) => {
    const prefix = `@${toolName} `;
    setInputValue((prev) => (prev.startsWith(prefix) ? prev : `${prefix}${prev}`));
    setTimeout(() => inputRef.current?.focus(), 0);
    setShowToolsPanel(false);
  }, []);

  const handleAttachContext = useCallback((type: typeof ATTACH_OPTIONS[number]['type']) => {
    postMessage({
      type: 'attachContext',
      contextType: type
    });
    setShowAttachPanel(false);
  }, [postMessage]);

  const removeContextItem = useCallback((index: number) => {
    setContextItems((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  useEffect(() => {
    if (!vscodeRef.current) {
      ensureVscodeApi();
    }
    postMessage({ type: 'requestInitialData' });
  }, [ensureVscodeApi, postMessage]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data as { type?: string; [key: string]: unknown };
      if (!message?.type) {
        return;
      }

      switch (message.type) {
        case 'modelsList': {
          const models = message.models as LLMModel[];
          setAvailableModels(models);
          if (models.length > 0) {
            setSelectedModel((current) => {
              if (models.some((m) => m.id === current)) {
                return current;
              }
              return models[0].id;
            });
          }
          break;
        }
        case 'contextUpdate': {
          setContextItems(message.context as AgentContextItem[]);
          break;
        }
        case 'toolsUpdate': {
          setAvailableTools(message.tools as AgentTool[]);
          break;
        }
        case 'streamStart': {
          setIsTyping(true);
          const streamMessageId = toMessageId('assistant');
          const streamMessage: ChatMessage = {
            id: streamMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            streaming: true
          };
          setMessages((prev) => [...prev, streamMessage]);
          setStreamingState({ active: true, messageId: streamMessageId, fullText: '' });
          scrollToBottom();
          break;
        }
        case 'streamChunk': {
          const data = message.data as { fullText?: string };
          setStreamingState((prev) => {
            if (!prev.active || !prev.messageId) {
              return prev;
            }
            const nextText = data?.fullText ?? '';
            updateStreamingMessage(prev.messageId, () => nextText);
            return { ...prev, fullText: nextText };
          });
          scrollToBottom();
          break;
        }
        case 'agentResponse': {
          const response = message.data as {
            content: string;
            toolResults?: Array<{ toolName: string; data: unknown }>;
            newContext?: AgentContextItem[];
          };

          setIsTyping(false);
          setStreamingState({ active: false, fullText: '' });

          if (response.newContext && response.newContext.length > 0) {
            setContextItems((prev) => [...prev, ...response.newContext!]);
          }

          if (streamingState.active && streamingState.messageId) {
            updateStreamingMessage(streamingState.messageId, () => response.content ?? '');
            setMessages((prev) =>
              prev.map((message) =>
                message.id === streamingState.messageId
                  ? { ...message, streaming: false }
                  : message
              )
            );
          } else {
            const assistantMessage: ChatMessage = {
              id: toMessageId('assistant'),
              role: 'assistant',
              content: response.content ?? '',
              timestamp: Date.now()
            };
            setMessages((prev) => [...prev, assistantMessage]);
          }

          conversationRef.current = [...conversationRef.current, { role: 'assistant', content: response.content ?? '' }].slice(-20);

          if (response.toolResults && response.toolResults.length > 0) {
            setMessages((prev) => [
              ...prev,
              ...response.toolResults!.map((toolResult) => ({
                id: toMessageId('tool'),
                role: 'tool',
                content: '',
                timestamp: Date.now(),
                metadata: toolResult
              }))
            ]);
          }

          scrollToBottom();
          break;
        }
        case 'error': {
          setIsTyping(false);
          setStreamingState({ active: false, fullText: '' });

          const errorMessage: ChatMessage = {
            id: toMessageId('error'),
            role: 'assistant',
            content: `❌ ${message.message}`,
            timestamp: Date.now()
          };
          setMessages((prev) => [...prev, errorMessage]);
          scrollToBottom();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, [scrollToBottom, streamingState.active, streamingState.messageId, updateStreamingMessage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showModelDropdown && !target.closest('.model-selector')) {
        setShowModelDropdown(false);
      }
      if (showToolsPanel && !target.closest('.tools-panel') && !target.closest('#toolsButton')) {
        setShowToolsPanel(false);
      }
      if (showAttachPanel && !target.closest('.attach-panel') && !target.closest('#attachButton')) {
        setShowAttachPanel(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showAttachPanel, showModelDropdown, showToolsPanel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handleSend();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSend]);

  useEffect(() => {
    if (inputRef.current) {
      const textarea = inputRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    if (!hasMessages) {
      return;
    }
    scrollToBottom();
  }, [hasMessages, scrollToBottom]);

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="model-info">
          <div className={`model-selector ${showModelDropdown ? 'open' : ''}`}>
            <button
              type="button"
              className={`model-button${showModelDropdown ? ' open' : ''}`}
              id="modelButton"
              onClick={() => setShowModelDropdown((prev) => !prev)}
            >
              <span className="model-icon">🤖</span>
              <span className="model-name" id="modelName">
                {availableModels.find((model) => model.id === selectedModel)?.name ?? 'Select model'}
              </span>
              <span className="model-arrow">▼</span>
            </button>
            {showModelDropdown && (
              <div className="model-dropdown" id="modelDropdown">
                {availableModels.length === 0 && (
                  <div className="model-empty">No models detected</div>
                )}
                {availableModels.map((model) => (
                  <div
                    key={model.id}
                    className={`model-option${model.id === selectedModel ? ' selected' : ''}${model.available ? '' : ' disabled'}`}
                    data-model={model.id}
                    onClick={() => model.available && handleModelSelection(model.id)}
                  >
                    <span className="option-icon">{providerIcon(model.provider)}</span>
                    <div className="option-info">
                      <div className="option-name">{model.name}</div>
                      <div className="option-desc">{model.available ? 'Available' : 'Not configured'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className={`context-indicator ${contextItems.length > 0 ? 'active' : ''}`}>
          📄 {contextItems.length > 0 ? `${contextItems.length} Context Item${contextItems.length > 1 ? 's' : ''}` : 'No Context'}
        </div>
      </header>

      <div className="chat-messages" id="chatMessages" ref={chatMessagesRef}>
        {!hasMessages && (
          <div className="welcome-container">
            <div className="cappy-avatar">
              <span className="avatar-icon">🦫</span>
            </div>
            <div className="welcome-text">
              <h3>Hi, I'm Cappy</h3>
              <p>
                I'm an AI coding assistant that can help you with your development tasks. I have access to your project
                context and Cappy tools.
              </p>
            </div>
            <div className="quick-actions">
              {(Object.keys(QUICK_ACTIONS) as QuickActionKey[]).map((action) => (
                <button
                  key={action}
                  className="quick-action"
                  data-action={action}
                  type="button"
                  onClick={() => handleQuickAction(action)}
                >
                  <span className="action-icon">{quickActionIcon(action)}</span>
                  <span className="action-text">{quickActionLabel(action)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages
          .filter((message) => message.id !== 'welcome-message')
          .map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

        {isTyping && !streamingState.active && (
          <div className="typing-indicator" id="typing-indicator">
            <div className="message-header">
              <div className="message-avatar">🦫</div>
              <div className="message-author">Cappy</div>
            </div>
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <footer className="chat-input-container">
        <div className="chat-attachments" id="chatAttachments">
          {contextItems.map((item, index) => (
            <div className="attachment-pill" key={`${item.type}-${index}`}>
              <span>
                {CONTEXT_ICONS[item.type] ?? '📎'} {item.name}
              </span>
              <button
                type="button"
                className="attachment-remove"
                onClick={() => removeContextItem(index)}
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="chat-input-wrapper">
          <div className="chat-input-area">
            <button
              type="button"
              className="attach-button"
              id="attachButton"
              title="Attach context"
              onClick={() => setShowAttachPanel((prev) => !prev)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" />
              </svg>
            </button>
            <textarea
              id="chatInput"
              ref={inputRef}
              placeholder="Ask Cappy..."
              rows={1}
              maxLength={8000}
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value);
                setCharCount(event.target.value.length);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className="send-button"
              id="sendButton"
              disabled={inputValue.trim().length === 0}
              onClick={handleSend}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M.5 1.163A1 1 0 011.97.28l12.868 6.837a1 1 0 010 1.766L1.969 15.72A1 1 0 01.5 14.837V10.33a1 1 0 01.816-.983L8.5 8 1.316 6.653A1 1 0 01.5 5.67V1.163z" />
              </svg>
            </button>
          </div>
          <div className="input-footer">
            <div className="context-info" id="contextInfo">
              {contextInfo}
            </div>
            <div className="input-actions">
              <button
                type="button"
                className="tool-button"
                id="toolsButton"
                title="Available tools"
                onClick={() => setShowToolsPanel((prev) => !prev)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" />
                </svg>
                Tools
              </button>
              <span className={`char-count${charCount > 7500 ? ' warning' : ''}`} id="charCount">
                {charCount}/8000
              </span>
            </div>
          </div>
        </div>
      </footer>

      {showToolsPanel && (
        <aside className="tools-panel" id="toolsPanel">
          <div className="tools-header">
            <h4>Available Tools</h4>
            <button type="button" className="close-tools" id="closeTools" onClick={() => setShowToolsPanel(false)}>
              ✕
            </button>
          </div>
          <div className="tools-list">
            {availableTools.length === 0 && <div className="tool-empty">No tools available</div>}
            {availableTools.map((tool) => (
              <div
                key={tool.name}
                className="tool-item"
                data-tool={tool.name}
                onClick={() => handleToolSelection(tool.name)}
              >
                <div className="tool-icon">{tool.icon || TOOL_DEFAULT_ICON}</div>
                <div className="tool-info">
                  <div className="tool-name">{tool.displayName}</div>
                  <div className="tool-desc">{tool.description}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {showAttachPanel && (
        <aside className="attach-panel" id="attachPanel">
          <div className="attach-header">
            <h4>Add Context</h4>
            <button type="button" className="close-attach" id="closeAttach" onClick={() => setShowAttachPanel(false)}>
              ✕
            </button>
          </div>
          <div className="attach-options">
            {ATTACH_OPTIONS.map((option) => (
              <div
                key={option.type}
                className="attach-option"
                data-type={option.type}
                onClick={() => handleAttachContext(option.type)}
              >
                <div className="attach-icon">{option.icon}</div>
                <div className="attach-info">
                  <div className="attach-name">{option.label}</div>
                  <div className="attach-desc">{option.description}</div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
};

interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { role, content, streaming } = message;
  const { avatar, author } = messageMetadata(role);

  if (role === 'system' && !content) {
    return null;
  }

  if (role === 'tool' && message.metadata && 'toolName' in message.metadata) {
    const toolName = (message.metadata as { toolName?: string }).toolName ?? 'Tool';
    const data = (message.metadata as { data?: unknown }).data ?? content;
    return (
      <div className="message tool">
        <div className="message-header">
          <div className="message-avatar">🛠️</div>
          <div className="message-author">{toolName}</div>
        </div>
        <div className="message-content">
          <pre>{formatToolResult(data)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${role}${streaming ? ' streaming' : ''}`}>
      <div className="message-header">
        <div className="message-avatar">{avatar}</div>
        <div className="message-author">{author}</div>
      </div>
      <div className="message-content" dangerouslySetInnerHTML={{ __html: formatMessage(content) }} />
    </div>
  );
};

function providerIcon(provider: LLMModel['provider']) {
  switch (provider) {
    case 'openai':
      return '🧠';
    case 'anthropic':
      return '🎭';
    case 'azure':
      return '☁️';
    case 'local':
      return '🦙';
    default:
      return '🤖';
  }
}

function messageMetadata(role: ChatMessage['role']) {
  switch (role) {
    case 'user':
      return { avatar: '👤', author: 'You' };
    case 'assistant':
      return { avatar: '🦫', author: 'Cappy' };
    case 'tool':
      return { avatar: '🛠️', author: 'Tool' };
    default:
      return { avatar: 'ℹ️', author: 'System' };
  }
}

function formatMessage(content: string) {
  const codeBlocks: string[] = [];

  let working = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const placeholder = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    codeBlocks.push(`<pre class="code-block"><code>${escapeHtml(code)}</code></pre>`);
    return placeholder;
  });

  working = escapeHtml(working);

  working = working
    .replace(/`([^`]+)`/g, (_match, code) => `<code class="inline-code">${code}</code>`)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');

  codeBlocks.forEach((block, index) => {
    working = working.replace(`@@CODE_BLOCK_${index}@@`, block);
  });

  return working;
}

function formatToolResult(data: unknown) {
  if (typeof data === 'string') {
    return data;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return String(data);
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#039;';
      default:
        return char;
    }
  });
}

function quickActionIcon(action: QuickActionKey) {
  switch (action) {
    case 'explain':
      return '💡';
    case 'create-task':
      return '📝';
    case 'analyze':
      return '📊';
    case 'search':
      return '🔍';
    default:
      return '✨';
  }
}

function quickActionLabel(action: QuickActionKey) {
  switch (action) {
    case 'explain':
      return 'Explain this code';
    case 'create-task':
      return 'Create a task';
    case 'analyze':
      return 'Analyze project';
    case 'search':
      return 'Search codebase';
    default:
      return 'Run action';
  }
}

export default ChatApp;
