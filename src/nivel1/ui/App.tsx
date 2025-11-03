import { ChatView } from './pages/chat/ChatView.tsx'
import DocumentsPage from './pages/dashboard/pages/DocumentsPage'

/**
 * Main App component - handles both Chat and Documents views
 * Determines which component to render based on data-page attribute
 */
function App() {
  // Check data-page attribute to determine which view to render
  const rootElement = document.getElementById('root')
  const page = rootElement?.dataset.page || 'chat'
  
  console.log('[App] Rendering App with page:', page)
  
  if (page === 'documents') {
    console.log('[App] Rendering DocumentsPage...')
    return <DocumentsPage />
  }
  
  console.log('[App] Rendering ChatView...')
  return <ChatView />
}

export default App
