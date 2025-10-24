import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export function cappyDevServerPlugin(): Plugin {
  let workspaceRoot: string;
  let wss: WebSocketServer;
  let extensionWs: WebSocket | null = null;

  return {
    name: 'cappy-dev-server',
    
    configureServer(server) {
      workspaceRoot = process.cwd();
      
      console.log('🧢 [Cappy Dev Server] Backend disponível');
      console.log('📂 Workspace:', workspaceRoot);
      console.log('💡 Dica: Acesse http://localhost:3000/dev.html para o dashboard');

      // WebSocket Server na porta 7001 para comunicação com o frontend
      wss = new WebSocketServer({ port: 7001 });
      console.log('🔌 [Vite WebSocket] Listening on port 7001');

      // Tentar conectar com extensão na porta 7002
      function connectToExtension() {
        try {
          extensionWs = new WebSocket('ws://localhost:7002');
          
          extensionWs.on('open', () => {
            console.log('✅ [Vite] Connected to extension on port 7002');
          });

          extensionWs.on('message', (data) => {
            // Forward mensagens da extensão para todos os clientes conectados
            const message = data.toString();
            console.log('📨 [Extension→Frontend]', JSON.parse(message).type);
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(message);
              }
            });
          });

          extensionWs.on('close', () => {
            console.log('🔌 [Vite] Extension disconnected');
            extensionWs = null;
            // Tentar reconectar após 5s
            setTimeout(connectToExtension, 5000);
          });

          extensionWs.on('error', () => {
            console.log('⚠️ [Vite] Extension not available (LLM features disabled)');
            extensionWs = null;
          });

        } catch {
          console.log('⚠️ [Vite] Could not connect to extension');
          extensionWs = null;
        }
      }

      // Tentar conectar com extensão
      connectToExtension();

      wss.on('connection', (ws) => {
        console.log('👋 [Vite WebSocket] Client connected');

        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📨 [Frontend→Vite]', message.type);

            // Decidir onde processar baseado no tipo
            if (message.type === 'debug/analyze') {
              // Processar localmente
              await handleDebugAnalyzeWS(message, ws, workspaceRoot);
            } else if (message.type === 'get-db-status') {
              // Processar localmente
              ws.send(JSON.stringify({
                type: 'db-status',
                payload: {
                  isConnected: true,
                  nodeCount: 0,
                  relationshipCount: 0,
                  status: 'ready',
                  mode: 'development'
                }
              }));
            } else if (message.type === 'sendMessage' || message.type.startsWith('chat/')) {
              // Proxy para extensão (LLM)
              if (extensionWs && extensionWs.readyState === WebSocket.OPEN) {
                console.log('🔀 [Vite] Proxying to extension:', message.type);
                extensionWs.send(data.toString());
              } else {
                ws.send(JSON.stringify({
                  type: 'error',
                  payload: {
                    error: 'Extension not connected. LLM features require VS Code extension.'
                  }
                }));
              }
            } else {
              console.warn('⚠️ [Vite] Unknown message type:', message.type);
            }

          } catch (error) {
            console.error('❌ [Vite WebSocket] Error:', error);
            ws.send(JSON.stringify({
              type: 'error',
              payload: { error: String(error) }
            }));
          }
        });

        ws.on('close', () => {
          console.log('👋 [Vite WebSocket] Client disconnected');
        });
      });

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

          if (url === '/debug/analyze' && req.method === 'POST') {
            await handleDebugAnalyze(req, res, workspaceRoot);
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

// Handler para Debug Analyze API
// WebSocket version
async function handleDebugAnalyzeWS(message: { payload: { fileName: string; fileSize: number; mimeType: string; content: string } }, ws: WebSocket, workspaceRoot: string) {
  try {
    const { fileName, fileSize, mimeType, content } = message.payload;
    console.log('🐛 [Debug WS] Analyzing file:', fileName);
    
    // Dynamically import the parser and extractor
    const { parse } = await import('@typescript-eslint/parser');
    const { ASTRelationshipExtractor } = await import('./src/nivel2/infrastructure/services/ast-relationship-extractor.js');
    
    // Check file type
    const ext = path.extname(fileName).toLowerCase();
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    if (!supportedExtensions.includes(ext)) {
      ws.send(JSON.stringify({
        type: 'debug/analyze-error',
        payload: {
          error: `Unsupported file type: ${ext}. Supported: ${supportedExtensions.join(', ')}`
        }
      }));
      return;
    }
    
    // Parse AST
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: true,
      tokens: false,
      ecmaVersion: 'latest' as const,
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });
    
    // Use ASTRelationshipExtractor
    const extractor = new ASTRelationshipExtractor(workspaceRoot);
    
    // Create temp file
    const tempDir = path.join(workspaceRoot, '.cappy-debug-temp');
    const tempFilePath = path.join(tempDir, fileName);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(tempFilePath, content, 'utf-8');
    
    try {
      // Analyze
      const analysis = await extractor.analyze(tempFilePath);
      
      // Extract signatures
      const signatures = extractSignatures(ast);
      
      // Build response
      const response = {
        fileName,
        fileSize,
        mimeType,
        ast,
        entities: [
          ...analysis.imports.map(imp => ({
            type: 'import',
            source: imp.source,
            specifiers: imp.specifiers,
            isExternal: imp.isExternal,
            packageResolution: imp.packageResolution
          })),
          ...analysis.exports.map(exp => ({
            type: 'export',
            name: exp
          })),
          ...analysis.calls.map(call => ({
            type: 'call',
            name: call
          })),
          ...analysis.typeRefs.map(ref => ({
            type: 'typeRef',
            name: ref
          }))
        ],
        signatures,
        metadata: {
          lines: content.split('\n').length,
          characters: content.length,
          hasErrors: false,
          mode: 'vite-websocket',
          importsCount: analysis.imports.length,
          exportsCount: analysis.exports.length,
          callsCount: analysis.calls.length,
          typeRefsCount: analysis.typeRefs.length
        }
      };
      
      ws.send(JSON.stringify({
        type: 'debug/analyze-result',
        payload: response
      }));
      
      console.log('✅ [Debug WS] Analysis complete');
      
    } finally {
      // Cleanup
      try {
        fs.unlinkSync(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
    
  } catch (error) {
    console.error('❌ [Debug WS] Error:', error);
    ws.send(JSON.stringify({
      type: 'debug/analyze-error',
      payload: {
        error: error instanceof Error ? error.message : String(error)
      }
    }));
  }
}

// HTTP version
async function handleDebugAnalyze(req: IncomingMessage, res: ServerResponse, workspaceRoot: string) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', async () => {
    try {
      const { fileName, fileSize, mimeType, content } = JSON.parse(body);
      console.log('🐛 [Debug API] Analyzing file:', fileName);
      
      // Dynamically import the parser and extractor
      const { parse } = await import('@typescript-eslint/parser');
      const { ASTRelationshipExtractor } = await import('./src/nivel2/infrastructure/services/ast-relationship-extractor.js');
      
      // Check file type
      const ext = path.extname(fileName).toLowerCase();
      const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
      
      if (!supportedExtensions.includes(ext)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ 
          error: `Unsupported file type: ${ext}. Supported: ${supportedExtensions.join(', ')}`
        }));
        return;
      }
      
      // Parse AST
      const ast = parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: false,
        ecmaVersion: 'latest' as const,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      });
      
      // Use ASTRelationshipExtractor
      const extractor = new ASTRelationshipExtractor(workspaceRoot);
      
      // Create temp file
      const tempDir = path.join(workspaceRoot, '.cappy-debug-temp');
      const tempFilePath = path.join(tempDir, fileName);
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempFilePath, content, 'utf-8');
      
      try {
        // Analyze
        const analysis = await extractor.analyze(tempFilePath);
        
        // Extract signatures
        const signatures = extractSignatures(ast);
        
        // Build response
        const response = {
          fileName,
          fileSize,
          mimeType,
          ast,
          entities: [
            ...analysis.imports.map(imp => ({
              type: 'import',
              source: imp.source,
              specifiers: imp.specifiers,
              isExternal: imp.isExternal,
              packageResolution: imp.packageResolution
            })),
            ...analysis.exports.map(exp => ({
              type: 'export',
              name: exp
            })),
            ...analysis.calls.map(call => ({
              type: 'call',
              name: call
            })),
            ...analysis.typeRefs.map(ref => ({
              type: 'typeRef',
              name: ref
            }))
          ],
          signatures,
          metadata: {
            lines: content.split('\n').length,
            characters: content.length,
            hasErrors: false,
            mode: 'vite-dev-server',
            importsCount: analysis.imports.length,
            exportsCount: analysis.exports.length,
            callsCount: analysis.calls.length,
            typeRefsCount: analysis.typeRefs.length
          }
        };
        
        res.end(JSON.stringify(response));
        console.log('✅ [Debug API] Analysis complete');
        
      } finally {
        // Cleanup
        try {
          fs.unlinkSync(tempFilePath);
        } catch {
          // Ignore cleanup errors
        }
      }
      
    } catch (error) {
      console.error('❌ [Debug API] Error:', error);
      res.statusCode = 500;
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  });
}

function extractSignatures(ast: unknown): unknown[] {
  const signatures: unknown[] = [];
  
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    
    if (n.type === 'FunctionDeclaration' && n.id) {
      const id = n.id as Record<string, unknown>;
      const params = n.params as unknown[];
      signatures.push({
        type: 'function',
        name: id.name,
        params: params?.map((p: unknown) => {
          const param = p as Record<string, unknown>;
          return param.name || param.type;
        }) || [],
        async: n.async || false
      });
    } else if (n.type === 'ClassDeclaration' && n.id) {
      const id = n.id as Record<string, unknown>;
      const superClass = n.superClass as Record<string, unknown> | undefined;
      signatures.push({
        type: 'class',
        name: id.name,
        superClass: superClass?.name || null
      });
    } else if (n.type === 'VariableDeclaration') {
      const declarations = n.declarations as unknown[];
      declarations?.forEach((decl: unknown) => {
        const d = decl as Record<string, unknown>;
        const id = d.id as Record<string, unknown>;
        if (id?.name) {
          signatures.push({
            type: 'variable',
            name: id.name,
            kind: n.kind
          });
        }
      });
    }
    
    for (const key in n) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = n[key];
      if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (typeof value === 'object') {
        visit(value);
      }
    }
  };
  
  visit(ast);
  return signatures;
}

// Script que mockeia a API do VS Code
function getVSCodeMockScript(): string {
  return `
// Mock da API do VS Code para desenvolvimento
console.log('🧢 [Cappy] VS Code API Mock loaded');

// WebSocket connection to Vite dev server (port 7001)
let ws = null;
let wsReady = false;

function connectToViteServer() {
  try {
    ws = new WebSocket('ws://localhost:7001');
    
    ws.onopen = () => {
      console.log('✅ [Cappy] Connected to Vite dev server');
      wsReady = true;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [Vite→Frontend]', data.type);
        window.postMessage(data, '*');
      } catch (error) {
        console.error('❌ [WebSocket] Parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ [Cappy] WebSocket error:', error);
      wsReady = false;
    };
    
    ws.onclose = () => {
      console.log('🔌 [Cappy] WebSocket disconnected, reconnecting...');
      wsReady = false;
      ws = null;
      setTimeout(connectToViteServer, 1000);
    };
  } catch (error) {
    console.error('❌ [Cappy] Could not connect:', error);
    wsReady = false;
  }
}

// Attempt connection on load
connectToViteServer();

// Fallback: HTTP API call
async function fallbackAPICall(message) {
  console.log('💬 [Fallback] Using HTTP API');
  
  if (message.type === 'debug/analyze') {
    // Handle debug analyze request via Vite dev server
    try {
      const response = await fetch('http://localhost:6001/api/debug/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.payload)
      });
      
      if (!response.ok) {
        const error = await response.text();
        window.postMessage({
          type: 'debug/analyze-error',
          payload: { error }
        }, '*');
        return;
      }
      
      const result = await response.json();
      window.postMessage({
        type: 'debug/analyze-result',
        payload: result
      }, '*');
    } catch (error) {
      window.postMessage({
        type: 'debug/analyze-error',
        payload: { error: error.message }
      }, '*');
    }
    return;
  }
  
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

const vsCodeApi = {
  postMessage: async (message) => {
    console.log('📤 [Frontend→Vite] postMessage:', message.type);
    
    try {
      // Always use WebSocket (connects to Vite dev server on port 7001)
      if (wsReady && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        console.log('✅ [WebSocket] Message sent successfully');
      } else {
        console.error('❌ [WebSocket] Not ready. Waiting for connection...');
      }
    } catch (error) {
      console.error('❌ postMessage failed:', error);
    }
  },
  setState: (state) => {
    sessionStorage.setItem('vscode-state', JSON.stringify(state));
  },
  getState: () => {
    const state = sessionStorage.getItem('vscode-state');
    return state ? JSON.parse(state) : undefined;
  }
};

window.acquireVsCodeApi = () => vsCodeApi;
window.vscodeApi = vsCodeApi;
`;
}
