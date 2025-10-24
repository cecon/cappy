import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/graph/graph.css';
import App from './ui/graph/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
