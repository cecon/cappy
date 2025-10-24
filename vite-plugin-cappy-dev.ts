import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';

export function cappyDevServerPlugin(): Plugin {
  let workspaceRoot: string;

  return {
    name: 'cappy-dev-server',
    
    configureServer(server) {
      workspaceRoot = process.cwd();
      
      console.log('🧢 [Cappy Dev Server] Backend disponível');
      console.log('📂 Workspace:', workspaceRoot);
      console.log('💡 Dica: Acesse http://localhost:3000/dev.html para o dashboard');

      // Log de todas as requisições para debug
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        
        // Log apenas requisições que não são do HMR/Vite
        if (!url.includes('/@vite') && 
            !url.includes('/@fs') && 
            !url.includes('/@id') &&
            !url.includes('.css') &&
            !url.includes('node_modules')) {
          console.log('🔍 [Request]', req.method, url);
        }
        
        next();
      });

      // API REST para backend
      server.middlewares.use('/api', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        const url = req.url || '';
        console.log('📡 [API]', req.method, url);

        try {
          if (url === '/health') {
            res.end(JSON.stringify({ status: 'ok', workspace: workspaceRoot }));
            return;
          }

          if (url.startsWith('/graph')) {
            await handleGraphAPI(url, res, workspaceRoot);
            return;
          }

          if (url.startsWith('/tasks')) {
            await handleTasksAPI(url, res, workspaceRoot);
            return;
          }

          if (url.startsWith('/chat')) {
            await handleChatAPI(url, req, res);
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        } catch (error) {
          console.error('❌ [API Error]', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });

      // Serve script de mock da API do VS Code
      server.middlewares.use((req, res, next) => {
        if (req.url === '/@cappy/vscode-mock.js') {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(getVSCodeMockScript());
          return;
        }
        
        // Ignorar requisições de extensões do browser (manifest.json, etc)
        if (req.url?.includes('manifest.json') || 
            req.url?.includes('.crx') ||
            req.url?.endsWith('.map')) {
          res.statusCode = 204; // No Content
          res.end();
          return;
        }
        
        next();
      });
    },
    
    transformIndexHtml(html) {
      // Injeta o mock no início de cada página
      return html.replace('<head>', '<head>\n    <script type="module" src="/@cappy/vscode-mock.js"></script>');
    }
  };
}

// Handler para Graph API
async function handleGraphAPI(url: string, res: ServerResponse, workspaceRoot: string) {
  const dbPath = path.join(workspaceRoot, '.cappy', 'knowledge-graph.db');
  
  if (url === '/graph/status') {
    const exists = fs.existsSync(dbPath);
    res.end(JSON.stringify({ 
      type: 'db-status',
      exists, 
      path: dbPath 
    }));
    return;
  }

  if (url === '/graph/load') {
    res.end(JSON.stringify({
      type: 'subgraph',
      nodes: [],
      edges: []
    }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Graph endpoint not found' }));
}

// Handler para Tasks API
async function handleTasksAPI(url: string, res: ServerResponse, workspaceRoot: string) {
  const tasksDir = path.join(workspaceRoot, '.cappy', 'tasks');
  
  if (url === '/tasks/list') {
    try {
      const files = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];
      const tasks = files
        .filter(f => f.endsWith('.xml'))
        .map(f => ({
          id: f.replace('.xml', ''),
          name: f,
          path: path.join(tasksDir, f)
        }));
      
      res.end(JSON.stringify({ tasks }));
    } catch (error) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(error) }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Tasks endpoint not found' }));
}

// Handler para Chat API
async function handleChatAPI(url: string, req: IncomingMessage, res: ServerResponse) {
  if (url === '/chat/send') {
    // Read request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const message = JSON.parse(body);
        console.log('💬 [Chat API] Received message:', message.text);
        
        // Set headers for SSE (Server-Sent Events)
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });
        
        // Try to use VS Code Language Model API
        try {
          // Dynamic import to avoid issues when vscode is not available
          const vscode = await import('vscode');
          
          const models = await vscode.lm.selectChatModels({
            vendor: 'copilot',
            family: 'gpt-4o'
          });
          
          if (models.length === 0) {
            throw new Error('No Copilot model available');
          }
          
          const model = models[0];
          console.log('🤖 [Chat API] Using model:', model.name);
          
          // Build messages from history
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const messages: any[] = [];
          
          if (message.history && Array.isArray(message.history)) {
            for (const msg of message.history) {
              messages.push(vscode.LanguageModelChatMessage.User(msg.content));
            }
          }
          
          // Add current message
          messages.push(vscode.LanguageModelChatMessage.User(message.text));
          
          // Stream response
          const stream = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
          
          for await (const chunk of stream.text) {
            // Send as postMessage format
            const data = JSON.stringify({ type: 'textDelta', text: chunk });
            res.write(`data: ${data}\\n\\n`);
          }
          
          // Send done message
          const doneData = JSON.stringify({ type: 'done' });
          res.write(`data: ${doneData}\\n\\n`);
          res.end();
          
        } catch (vscodeError) {
          console.warn('⚠️ [Chat API] VS Code API not available, using fallback:', vscodeError);
          
          // Fallback to mock response
          const responses = [
            'Olá! ',
            'Sou o Cappy rodando ',
            'no modo de desenvolvimento. ',
            '\\n\\nVocê disse: "' + (message.text || '') + '"\\n\\n',
            'Não consegui acessar o Copilot. ',
            'Certifique-se de que está rodando dentro do VS Code. 🎭'
          ];
          
          for (const text of responses) {
            await new Promise(resolve => setTimeout(resolve, 50));
            const data = JSON.stringify({ type: 'textDelta', text });
            res.write(`data: ${data}\\n\\n`);
          }
          
          const doneData = JSON.stringify({ type: 'done' });
          res.write(`data: ${doneData}\\n\\n`);
          res.end();
        }
        
      } catch (error) {
        console.error('❌ [Chat API] Error:', error);
        const errorData = JSON.stringify({ 
          type: 'error', 
          error: error instanceof Error ? error.message : String(error) 
        });
        res.write(`data: ${errorData}\\n\\n`);
        res.end();
      }
    });
    
    return;
  }
  
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Chat endpoint not found' }));
}

// Script que mockeia a API do VS Code
function getVSCodeMockScript(): string {
  return `
// Mock da API do VS Code para desenvolvimento
console.log('🧢 [Cappy] VS Code API Mock loaded');

// WebSocket connection to running extension
let ws = null;
let wsReady = false;

// Try to connect to extension's WebSocket server
function connectToExtension() {
  try {
    ws = new WebSocket('ws://localhost:7001');
    
    ws.onopen = () => {
      console.log('✅ [Cappy] Connected to VS Code extension via WebSocket');
      wsReady = true;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [WebSocket] Received:', data.type);
        window.postMessage(data, '*');
      } catch (error) {
        console.error('❌ [WebSocket] Parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.warn('⚠️ [Cappy] WebSocket error, will use fallback:', error);
      wsReady = false;
    };
    
    ws.onclose = () => {
      console.log('🔌 [Cappy] WebSocket disconnected, using fallback');
      wsReady = false;
      ws = null;
    };
  } catch (error) {
    console.warn('⚠️ [Cappy] Could not connect to extension:', error);
    wsReady = false;
  }
}

// Attempt connection on load
connectToExtension();

// Fallback: HTTP API call
async function fallbackAPICall(message) {
  console.log('💬 [Fallback] Using HTTP API');
  
  if (message.type === 'sendMessage') {
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          window.postMessage(data, '*');
        }
      }
    }
  } else {
    // Other message types
    const endpoint = mapMessageToEndpoint(message);
    const response = await fetch('/api' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    const data = await response.json();
    window.postMessage(data, '*');
  }
}

function mapMessageToEndpoint(message) {
  const { type } = message;
  
  if (type === 'loadGraph') return '/graph/load';
  if (type === 'load-subgraph') return '/graph/subgraph';
  if (type === 'get-db-status') return '/graph/status';
  if (type === 'getDocuments') return '/documents/list';
  if (type === 'getTasks') return '/tasks/list';
  
  return '/unknown';
}

window.acquireVsCodeApi = () => ({
  postMessage: async (message) => {
    console.log('📤 [VS Code Mock] postMessage:', message);
    
    try {
      // Prefer WebSocket if connected (real extension running)
      if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        console.log('🔌 [WebSocket] Sending via extension');
        ws.send(JSON.stringify(message));
      } else {
        // Fallback to HTTP API
        await fallbackAPICall(message);
      }
    } catch (error) {
      console.error('❌ API call failed:', error);
      window.postMessage({ type: 'error', error: String(error) }, '*');
    }
  },
  setState: (state) => {
    sessionStorage.setItem('vscode-state', JSON.stringify(state));
  },
  getState: () => {
    const state = sessionStorage.getItem('vscode-state');
    return state ? JSON.parse(state) : undefined;
  }
});
`;
}
