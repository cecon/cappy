import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'highlight.js/styles/vs2015.css'
import App from './App.tsx'

console.log('[React Main] Starting...')
console.log('[React Main] Root element:', document.getElementById('root'))

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found!')
  }
  
  console.log('[React Main] Creating React root...')
  const root = createRoot(rootElement)
  
  console.log('[React Main] Rendering App...')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  console.log('[React Main] App rendered successfully!')
} catch (error) {
  console.error('[React Main] Error:', error)
}
