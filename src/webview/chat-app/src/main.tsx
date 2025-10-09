import React from 'react';
import { createRoot } from 'react-dom/client';
import ChatApp from './ui/ChatApp';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Chat root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <ChatApp />
  </React.StrictMode>
);
