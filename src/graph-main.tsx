import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './graph.generated.css';
import GraphApp from './components/GraphApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GraphApp />
  </StrictMode>,
);
