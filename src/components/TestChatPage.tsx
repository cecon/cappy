import React from 'react';
import { Chat } from '../components/chat-new';

interface TestChatPageProps {
  title?: string;
}

export const testChatPage: React.FC<TestChatPageProps> = ({ title = "Cappy Chat - LangGraph + Assistant UI" }) => {
  return (
    <div style={{ 
      height: '100vh', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        marginBottom: '20px',
        color: '#333',
        fontSize: '24px'
      }}>
        {title}
      </h1>
      
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        height: 'calc(100vh - 120px)',
        backgroundColor: '#f9f9f9'
      }}>
        <Chat className="test-chat" />
      </div>
      
      <div style={{
        marginTop: '10px',
        fontSize: '12px',
        color: '#666',
        textAlign: 'center'
      }}>
        Powered by LangGraph SDK + Assistant UI | Terminal Tool Available
      </div>
    </div>
  );
};

export default testChatPage;