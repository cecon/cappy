import { ChatView } from './pages/chat/ChatView.tsx'
import DocumentsPage from './pages/dashboard/pages/DocumentsPage.tsx'

function App() {
  // Detect which page to render based on data-page attribute
  const rootElement = document.getElementById('root')
  const page = (rootElement?.dataset.page) || 'chat'
  
  // Render selected page
  
  if (page === 'documents') {
    return <DocumentsPage />
  }
  
  return <ChatView />
}

export default App
