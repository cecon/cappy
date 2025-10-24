import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './graph.generated.css';
import App from './nivel1/ui/graph/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
