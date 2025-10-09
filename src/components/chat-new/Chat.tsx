import React, { useState, useCallback } from 'react';
import { AssistantProvider, AssistantMessage, ComposerPrimitive } from '@assistant-ui/react';
import { LangGraphRuntime, Message } from '../../services/langgraph/runtime';
import './Chat.css';

interface ChatProps {
  className?: string;
}

export const chatComponent: React.FC<ChatProps> = ({ className }) => {
  const [runtime] = useState(() => new LangGraphRuntime());
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await runtime.processMessage(content);
      setMessages(runtime.getMessages());
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setIsLoading(false);
    }
  }, [runtime, isLoading]);

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
        <ComposerPrimitive.Root onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const message = formData.get('message') as string;
          if (message) {
            handleSendMessage(message);
            e.currentTarget.reset();
          }
        }}>
          <ComposerPrimitive.Input 
            name="message"
            placeholder="Digite sua mensagem..." 
            disabled={isLoading}
          />
          <ComposerPrimitive.Send disabled={isLoading}>
            {isLoading ? 'Enviando...' : 'Enviar'}
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
};

export default chatComponent;