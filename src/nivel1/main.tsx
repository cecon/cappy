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
console.log('[React Main] 🚀 Starting initialization...')
console.log('[React Main] Document ready state:', document.readyState)
console.log('[React Main] Body exists:', !!document.body)

try {
  const rootElement = document.getElementById('root')
  console.log('[React Main] Root element:', rootElement)
  
  if (!rootElement) {
    console.error('[React Main] ❌ Root element not found in DOM!')
    throw new Error('Root element not found!')
  }
  
  console.log('[React Main] ✅ Root element found, creating React root...')
  const root = createRoot(rootElement)
  
  console.log('[React Main] 🎨 Rendering App component...')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  console.log('[React Main] ✅ App component rendered successfully!')
} catch (error) {
  console.error('[React Main] ❌ Error during initialization:', error)
  // Show error in UI if possible
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: monospace;">
        <h2>❌ Cappy Chat - Initialization Error</h2>
        <pre>${error instanceof Error ? error.message : String(error)}</pre>
        <p>Check the developer console for more details.</p>
      </div>
    `
  }
}
