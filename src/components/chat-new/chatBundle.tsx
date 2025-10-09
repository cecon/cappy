import React from 'react';
import ReactDOM from 'react-dom/client';
import Chat from './Chat';

// Mount the React component when DOM is ready
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Chat />
    </React.StrictMode>
  );
} else {
  console.error('Root element not found');
}
