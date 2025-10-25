/**
 * @fileoverview Graph visualization application entry point
 * @module graph-main
 * @author Cappy Team
 * @since 3.0.0
 * 
 * This is the main entry point for the graph visualization page.
 * It initializes the React application with the Graph UI components.
 * 
 * @example
 * ```html
 * <!-- In graph.html -->
 * <script type="module" src="/src/nivel1/graph-main.tsx"></script>
 * ```
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/graph/graph.css';
import App from './ui/graph/App';

/**
 * Initialize and render the Graph visualization application
 * 
 * Renders the main App component wrapped in React.StrictMode for
 * additional development checks and warnings.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
