import { ChatView } from './nivel1/ui/pages/chat/ChatView.tsx'
import DocumentsPage from './nivel1/ui/pages/knowledge-base/DocumentsPage.tsx'

console.log('[React App] Loading...')

function App() {
  // Detect which page to render based on data-page attribute
  const rootElement = document.getElementById('root')
  const page = (rootElement?.dataset.page) || 'chat'
  
  console.log(`[React App] Rendering page: ${page}`)
  
  if (page === 'documents') {
    return <DocumentsPage />
  }
  
  return <ChatView />
}

export default App
