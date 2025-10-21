import { ChatView } from './components/ChatView'
import DocumentsPage from './components/pages/DocumentsPage'

console.log('[React App] Loading...')

function App() {
  // Detect which page to render based on data-page attribute
  const rootElement = document.getElementById('root')
  const page = rootElement?.getAttribute('data-page') || 'chat'
  
  console.log(`[React App] Rendering page: ${page}`)
  
  if (page === 'documents') {
    return <DocumentsPage />
  }
  
  return <ChatView />
}

export default App
