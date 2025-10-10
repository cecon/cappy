import { useEffect, useRef, useState } from 'react';
import './ChatView.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatViewProps {
  sessionId?: string;
  sessionTitle?: string;
}

// VS Code API for webview communication
interface VsCodeApi {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
}

// VS Code API is acquired once in the HTML and stored globally
declare global {
  interface Window {
    vscodeApi: VsCodeApi;
  }
}

export function ChatView({ sessionId, sessionTitle }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const vscode = useRef(window.vscodeApi);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'sessionLoaded':
          setMessages(message.messages || []);
          break;
        case 'streamStart':
          setIsStreaming(true);
          setMessages(prev => [...prev, {
            id: message.messageId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
          }]);
          break;
        case 'streamToken':
          setMessages(prev => prev.map(msg => 
            msg.id === message.messageId 
              ? { ...msg, content: msg.content + message.token }
              : msg
          ));
          break;
        case 'streamEnd':
          setIsStreaming(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSendMessage = () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send to extension
    vscode.current.postMessage({
      type: 'sendMessage',
      sessionId,
      content: input
    });

    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>{sessionTitle || 'Chat'}</h3>
        {isStreaming && <span className="streaming-indicator">●</span>}
      </div>
      
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">{msg.content}</div>
              <div className="message-timestamp">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Cappy..."
          disabled={isStreaming}
          rows={3}
        />
        <button 
          className="chat-send-button"
          onClick={handleSendMessage}
          disabled={!input.trim() || isStreaming}
        >
          {isStreaming ? '⏸' : '▶'}
        </button>
      </div>
    </div>
  );
}
