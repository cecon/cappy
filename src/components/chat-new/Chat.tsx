import React, { useState, useCallback, useEffect, useRef } from 'react';
import './Chat.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface ChatProps {
  className?: string;
}

// Declare vscode API available in webview context
declare global {
  interface Window {
    vscodeApi?: any;
    logMessage?: (message: string) => void;
    logError?: (message: string) => void;
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export default function Chat({ className }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'chatResponse': {
          // Add assistant response to messages
          const assistantMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: message.content,
            createdAt: new Date()
          };
          setMessages(prev => [...prev, assistantMsg]);
          setIsLoading(false);
          break;
        }
        case 'error':
          window.logError?.(message.message);
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) {
      return;
    }

    // Add user message immediately
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      createdAt: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setInputValue('');

    // Send message to extension for processing
    window.vscodeApi?.postMessage({
      type: 'sendMessage',
      content
    });
  }, [isLoading]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleSendMessage(inputValue);
    }
  }, [inputValue, handleSendMessage]);

  return (
    <div className={`chat-container ${className || ''}`}>
      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={message.role === 'user' ? 'user-message' : 'assistant-message'}
          >
            <strong>{message.role === 'user' ? 'Você' : 'Assistant'}:</strong>
            <p>{message.content}</p>
            <small>{message.createdAt.toLocaleTimeString()}</small>
          </div>
        ))}
        {isLoading && (
          <div className="assistant-message">
            <strong>Assistant:</strong>
            <p>Digitando...</p>
          </div>
        )}
      </div>
      
      <div className="composer-container">
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            name="message"
            placeholder="Digite sua mensagem..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
          <button type="submit" disabled={isLoading || !inputValue.trim()}>
            {isLoading ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
}