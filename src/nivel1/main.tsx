/**
 * @fileoverview Main application entry point
 * @module main
 * @author Cappy Team
 * @since 3.0.0
 * 
 * This is the main entry point for the Cappy application.
 * It initializes the React application with the main UI components,
 * error handling, and console logging for debugging.
 * 
 * @example
 * ```html
 * <!-- In index.html -->
 * <script type="module" src="/src/nivel1/main.tsx"></script>
 * ```
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/vs2015.css'
import './ui/index.css'
import App from './ui/App.tsx'

/**
 * Initialize and render the main application
 * 
 * Creates a React root element and renders the App component
 * wrapped in StrictMode for additional development checks.
 * Includes error handling for missing root element.
 * 
 * @throws {Error} When root element is not found in the DOM
 */
try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found!')
  }
  
  const root = createRoot(rootElement)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  console.error('[React Main] Error:', error)
}
