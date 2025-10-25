import type { Plugin } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
// (no-op type imports removed)

export function cappyDevServerPlugin(): Plugin {
  let workspaceRoot: string;
  let wss: WebSocketServer | null = null;
  let retryTimeout: NodeJS.Timeout | null = null;
  // Track connected frontend clients (browser dev UIs)
  const clients = new Set<WebSocket>();
  // Connection to the installed extension's DevServerBridge (ws://localhost:7002)
  let bridgeWs: WebSocket | null = null;
  let bridgeReconnectTimer: NodeJS.Timeout | null = null;
  const BRIDGE_PORT = 7002;

  return {
    name: 'cappy-dev-server',
    // Inject VS Code API mock script into all HTML pages in dev
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { src: '/@cappy/vscode-mock.js' },
            injectTo: 'head'
          }
        ]
      };
    },
    
  async configureServer(server) {
      workspaceRoot = process.cwd();
      
      console.log('🧢 [Cappy Dev Server] Backend disponível');
      console.log('📂 Workspace:', workspaceRoot);
      console.log('💡 Dica: Acesse http://localhost:3000/dev.html para o dashboard');

      // Fecha WebSocket existente antes de criar novo (hot reload)
      if (wss) {
        try {
          console.log('🔄 [Vite] Closing existing WebSocket before restart...');
          
          // Clear any pending retry
          if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
          }
          
          // Close the WebSocket server
          const closePromise = new Promise<void>((resolve) => {
            wss?.close(() => {
              console.log('✅ [Vite] Old WebSocket closed');
              resolve();
            });
          });
          await closePromise;
          
          // Wait a bit for the port to be fully released
          await new Promise(r => setTimeout(r, 500));
          
        } catch (err) {
          console.warn('⚠️ [Vite] Error while closing previous WebSocket:', err);
        } finally {
          wss = null;
        }
      }

      // Helper: attempt to free a port on Windows by finding PID via netstat and taskkill
      const tryFreePort = (port: number): boolean => {
        try {
          if (process.platform !== 'win32') return false;
          
          const currentPid = process.pid;
          const cmd = `netstat -ano | findstr :${port}`;
          const out = execSync(cmd, { encoding: 'utf8' });
          const lines = out.trim().split(/\r?\n/).filter(Boolean);
          let killedAny = false;
          
          for (const line of lines) {
            // PID is the last column
            const m = line.trim().match(/\s+(\d+)$/);
            const pid = m ? m[1] : null;
            
            if (pid) {
              // Don't kill ourselves!
              if (pid === String(currentPid)) {
                console.log(`⚠️ [Vite] PID ${pid} is current process, skipping...`);
                continue;
              }
              
              try {
                console.log(`🧨 [Vite] Killing PID ${pid} listening on port ${port}`);
                execSync(`taskkill /PID ${pid} /F`);
                killedAny = true;
              } catch (tkErr) {
                console.warn(`⚠️ [Vite] Failed to kill PID ${pid}:`, tkErr);
              }
            }
          }
          return killedAny;
        } catch {
          // netstat returned nothing or failed
          return false;
        }
      };

      // WebSocket Server na porta 7001 para comunicação com o frontend
      // Retry strategy: keep trying indefinitely with 3s delay
      let retryCount = 0;
      const startWebSocket = async (): Promise<void> => {
        try {
          wss = new WebSocketServer({ port: 7001 });
          console.log(`🔌 [Vite WebSocket] Listening on port 7001`);
          
          // Reset retry count on success
          retryCount = 0;
          
          // Clear any pending retry
          if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
          }

          // Setup event listeners
          setupWebSocketHandlers();
          return; // Success
        } catch (err: unknown) {
          const error = err as NodeJS.ErrnoException;
          if (error && error.code === 'EADDRINUSE') {
            retryCount++;
            
            // Only try to kill after 3 failed attempts (give time for graceful close)
            if (retryCount > 3) {
              console.warn(`⚠️ [Vite] Port 7001 still in use after ${retryCount} attempts. Attempting to kill the process...`);
              
              const freed = tryFreePort(7001);
              if (freed) {
                console.log('🧨 [Vite] Process killed, retrying in 1 second...');
                retryTimeout = setTimeout(() => startWebSocket(), 1000);
                return;
              }
            } else {
              console.warn(`⚠️ [Vite] Port 7001 is in use (attempt ${retryCount}), waiting for graceful close...`);
            }
            
            // Schedule retry
            retryTimeout = setTimeout(() => {
              console.log(`🔄 [Vite] Attempting to restart WebSocket server...`);
              startWebSocket();
            }, 1500);
            return;
          } else {
            // Other error - log and retry anyway
            console.error('❌ [Vite] WebSocket error:', error);
            retryTimeout = setTimeout(() => startWebSocket(), 3000);
            return;
          }
        }
      };

      const setupWebSocketHandlers = () => {
        if (!wss) return;

        // Error handler - just log, don't retry (retry is handled in startWebSocket)
        wss.on('error', (error: NodeJS.ErrnoException) => {
          console.error('❌ [Vite] WebSocket error:', error.code || error.message);
          // Don't close or retry here - let the error propagate naturally
        });

  // Tentar conectar com a extensão instalada (DevServerBridge na porta 7002)
  ensureBridgeConnection();

        wss.on('connection', (ws: WebSocket) => {
        console.log('👋 [Vite WebSocket] Client connected');
        clients.add(ws);

        ws.on('close', () => {
          clients.delete(ws);
        });

        ws.on('message', async (data: unknown) => {
          try {
            const dataStr = String(data);
            const message = JSON.parse(dataStr);
            console.log('📨 [Frontend→Vite]', message.type);

            // Decidir onde processar baseado no tipo
            if (message.type === 'debug/analyze') {
              // Se a extensão estiver conectada, envie via bridge (ela proxy para o Vite dev server)
              if (bridgeWs && bridgeWs.readyState === bridgeWs.OPEN) {
                bridgeWs.send(dataStr);
              } else {
                // Processar localmente
                await handleDebugAnalyzeWS(message, ws, workspaceRoot);
              }
            } else if (message.type === 'get-db-status') {
              if (bridgeWs && bridgeWs.readyState === bridgeWs.OPEN) {
                bridgeWs.send(dataStr);
              } else {
                // Resposta local padrão
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
              }
            } else if (message.type === 'sendMessage' || (typeof message.type === 'string' && message.type.startsWith('chat/')) || message.type === 'userPromptResponse') {
              if (bridgeWs && bridgeWs.readyState === bridgeWs.OPEN) {
                bridgeWs.send(dataStr);
              } else {
                // Sem ponte com a extensão, notificar indisponibilidade
                ws.send(JSON.stringify({
                  type: 'error',
                  payload: {
                    error: 'Extension bridge not connected (port 7002). Open VS Code with Cappy installed to enable LLM features.'
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
      };

      function ensureBridgeConnection() {
        if (bridgeWs && bridgeWs.readyState === bridgeWs.OPEN) {
          return;
        }

        // Avoid multiple timers
        if (bridgeReconnectTimer) {
          clearTimeout(bridgeReconnectTimer);
          bridgeReconnectTimer = null;
        }

        tryConnectBridge();
      }

      function tryConnectBridge() {
        if (bridgeWs && (bridgeWs.readyState === bridgeWs.OPEN || bridgeWs.readyState === bridgeWs.CONNECTING)) {
          return;
        }

        try {
          const ws = new WebSocket(`ws://localhost:${BRIDGE_PORT}`);
          bridgeWs = ws;

          ws.on('open', () => {
            console.log(`🔗 [Vite] Connected to extension DevBridge on port ${BRIDGE_PORT}`);
            // Inform connected clients
            for (const client of clients) {
              try { client.send(JSON.stringify({ type: 'bridge/status', payload: { connected: true, port: BRIDGE_PORT } })); } catch {}
            }
          });

          ws.on('message', (data) => {
            // Broadcast responses from extension to all connected frontend clients
            for (const client of clients) {
              try { client.send(String(data)); } catch {}
            }
          });

          const scheduleReconnect = () => {
            if (bridgeReconnectTimer) return;
            bridgeReconnectTimer = setTimeout(() => {
              bridgeReconnectTimer = null;
              console.log('🔄 [Vite] Reconnecting to extension DevBridge...');
              tryConnectBridge();
            }, 2000);
          };

          ws.on('close', () => {
            console.warn('⚠️ [Vite] Extension DevBridge connection closed');
            for (const client of clients) {
              try { client.send(JSON.stringify({ type: 'bridge/status', payload: { connected: false } })); } catch {}
            }
            scheduleReconnect();
          });

          ws.on('error', (err) => {
            console.warn('⚠️ [Vite] Extension DevBridge connection error:', (err as Error).message);
            scheduleReconnect();
          });

        } catch (err) {
          console.warn('⚠️ [Vite] Failed to connect to extension DevBridge:', (err as Error).message);
          bridgeReconnectTimer = setTimeout(() => {
            bridgeReconnectTimer = null;
            tryConnectBridge();
          }, 2000);
        }
      }

      // Start WebSocket server
      await startWebSocket();

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
    }
  };
}

// Handler para Graph API
async function handleGraphAPI(url: string, res: ServerResponse, workspaceRoot: string) {
  const dbPath = path.join(workspaceRoot, '.cappy', 'knowledge-graph.db.');
  
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
  const { EntityFilterPipeline } = await import('./src/nivel2/infrastructure/services/entity-filtering/entity-filter-pipeline.js');
    
    // Check file type
    const ext = path.extname(fileName).toLowerCase();
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.php'];
    
    if (!supportedExtensions.includes(ext)) {
      ws.send(JSON.stringify({
        type: 'debug/analyze-error',
        payload: {
          error: `Unsupported file type: ${ext}. Supported: ${supportedExtensions.join(', ')}`
        }
      }));
      return;
    }
    
    // Only parse TS/JS AST for TS/JS files
    const ast = ext === '.php' ? undefined : parse(content, {
      loc: true,
      range: true,
      comment: true,
      tokens: false,
      ecmaVersion: 'latest' as const,
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    });
    
  // Use ASTRelationshipExtractor for TS/JS
  const extractor = new ASTRelationshipExtractor(workspaceRoot);
    
    // Create temp file
    const tempDir = path.join(workspaceRoot, '.cappy-debug-temp');
    const tempFilePath = path.join(tempDir, fileName);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(tempFilePath, content, 'utf-8');
    
    try {
      let rawEntities: unknown[] = [];
      let signatures: unknown[] = [];
      let jsdocChunks: unknown[] = [];

      if (ext === '.php') {
        // PHP path: use PHPParser to extract full structure
        const { PHPParser } = await import('./src/nivel2/infrastructure/parsers/php-parser.js');
        const phpParser = new PHPParser();
        
        // Get complete PHP analysis
        const phpAnalysis = await phpParser.analyze(tempFilePath);
        
        // Also get PHPDoc chunks for pipeline
        const phpChunks = await phpParser.parseFile(tempFilePath);
        jsdocChunks = phpChunks;
        console.log(`📝🐘 [Debug WS] PHPDoc chunks extracted: ${phpChunks.length}`);
        console.log(` [Debug WS] PHP Analysis: ${phpAnalysis.classes.length} classes, ${phpAnalysis.interfaces.length} interfaces, ${phpAnalysis.traits.length} traits, ${phpAnalysis.functions.length} functions`);

        // Build entities from ALL PHP symbols
        rawEntities = [];
        
        // Classes as entities
        for (const cls of phpAnalysis.classes) {
          rawEntities.push({
            type: 'export' as const,
            name: cls.name,
            source: tempFilePath,
            specifiers: [],
            scope: 'module' as const,
            metadata: { 
              symbolKind: 'class', 
              fullName: cls.fullName,
              extends: cls.extends,
              implements: cls.implements,
              isAbstract: cls.isAbstract,
              isFinal: cls.isFinal
            }
          });
          
          // Class methods
          for (const method of cls.methods) {
            rawEntities.push({
              type: 'export' as const,
              name: `${cls.name}::${method.name}`,
              source: tempFilePath,
              specifiers: [],
              scope: 'module' as const,
              isPrivate: method.visibility !== 'public',
              metadata: { 
                symbolKind: 'method',
                visibility: method.visibility,
                isStatic: method.isStatic,
                className: cls.name
              }
            });
          }
          
          // Class properties
          for (const prop of cls.properties) {
            rawEntities.push({
              type: 'export' as const,
              name: `${cls.name}::$${prop.name}`,
              source: tempFilePath,
              specifiers: [],
              scope: 'module' as const,
              isPrivate: prop.visibility !== 'public',
              metadata: { 
                symbolKind: 'property',
                visibility: prop.visibility,
                type: prop.type,
                className: cls.name
              }
            });
          }
        }
        
        // Interfaces
        for (const iface of phpAnalysis.interfaces) {
          rawEntities.push({
            type: 'export' as const,
            name: iface.name,
            source: tempFilePath,
            specifiers: [],
            scope: 'module' as const,
            metadata: { 
              symbolKind: 'interface',
              fullName: iface.fullName,
              extends: iface.extends
            }
          });
        }
        
        // Traits
        for (const trait of phpAnalysis.traits) {
          rawEntities.push({
            type: 'export' as const,
            name: trait.name,
            source: tempFilePath,
            specifiers: [],
            scope: 'module' as const,
            metadata: { 
              symbolKind: 'trait',
              fullName: trait.fullName
            }
          });
        }
        
        // Functions
        for (const func of phpAnalysis.functions) {
          rawEntities.push({
            type: 'export' as const,
            name: func.name,
            source: tempFilePath,
            specifiers: [],
            scope: 'module' as const,
            metadata: { 
              symbolKind: 'function',
              returnType: func.returnType,
              parameters: func.parameters
            }
          });
        }
        
        // Uses (imports)
        for (const use of phpAnalysis.uses) {
          rawEntities.push({
            type: 'import' as const,
            name: use.fullName,
            source: use.fullName,
            specifiers: [use.alias],
            scope: 'module' as const,
            isExternal: true,
            metadata: { 
              alias: use.alias
            }
          });
        }
        
        // Store full PHP analysis for response
        signatures = [phpAnalysis];
        
        console.log(`📊 [Debug WS] Raw entities extracted from PHP: ${rawEntities.length}`);
      } else {
        // TS/JS path
        const analysis = await extractor.analyze(tempFilePath);
        signatures = extractSignatures(ast);
        jsdocChunks = extractJSDocChunks(ast, fileName);
        console.log(`📝 [Debug WS] JSDoc chunks extracted: ${jsdocChunks.length}`);

        rawEntities = [
          ...analysis.imports.map(imp => ({
            type: 'import' as const,
            name: imp.source,
            source: tempFilePath,
            specifiers: imp.specifiers || [],
            isExternal: imp.isExternal,
            packageResolution: imp.packageResolution
          })),
          ...analysis.exports.map(expName => ({
            type: 'export' as const,
            name: expName,
            source: tempFilePath,
            specifiers: [],
            isExternal: false,
            packageResolution: undefined
          })),
          ...analysis.calls.map(callName => ({
            type: 'call' as const,
            name: callName,
            source: tempFilePath,
            specifiers: [],
            isExternal: false,
            packageResolution: undefined
          })),
          ...analysis.typeRefs.map(typeRefName => ({
            type: 'typeRef' as const,
            name: typeRefName,
            source: tempFilePath,
            specifiers: [],
            isExternal: false,
            packageResolution: undefined
          }))
        ];
        console.log(`📊 [Debug WS] Raw entities extracted: ${rawEntities.length}`);
      }
      
      // 🔥 Inicializa GraphStore para discovery
      const { SQLiteAdapter } = await import('./src/nivel2/infrastructure/database/sqlite-adapter.js');
      const dbPath = path.join(workspaceRoot, '.cappy', 'knowledge-graph.db');
      const graphStore = new SQLiteAdapter(dbPath);
      
      // 🔥 Apply pipeline filtering com GraphStore e JSDoc chunks
      const pipeline = new EntityFilterPipeline(
        {
          skipLocalVariables: true,
          skipPrimitiveTypes: true,
          skipAssetImports: true,
          discoverExistingEntities: true,
          extractDocumentation: true  // ← ATIVA EXTRAÇÃO DE DOCS
        },
        graphStore
      );
      
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineResult = await pipeline.process(rawEntities as any, tempFilePath, jsdocChunks as any);
      
      console.log(`✅ [Debug WS] Pipeline completed:
        - Original: ${pipelineResult.original.length}
        - Filtered: ${pipelineResult.filtered.length}
        - Deduplicated: ${pipelineResult.deduplicated.length}
        - Normalized: ${pipelineResult.normalized.length}
        - Enriched: ${pipelineResult.enriched.length}`);
      
      // Build response
      const counts = { imports: 0, exports: 0, calls: 0, typeRefs: 0 };
      let entitiesList: unknown[] = [];
      if (ext === '.php') {
        // For PHP, use rawEntities summary and counts
        entitiesList = rawEntities;
        counts.exports = rawEntities.length;
      } else {
        // For TS/JS, expose analysis breakdown
        const analysis = await extractor.analyze(tempFilePath); // re-use to compute entities list for response
        counts.imports = analysis.imports.length;
        counts.exports = analysis.exports.length;
        counts.calls = analysis.calls.length;
        counts.typeRefs = analysis.typeRefs.length;
        entitiesList = [
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
        ];
      }

      const response = {
        fileName,
        fileSize,
        mimeType,
        ast,
        entities: entitiesList,
        signatures,
        pipeline: pipelineResult,
        metadata: {
          lines: content.split('\n').length,
          characters: content.length,
          hasErrors: false,
          mode: 'vite-websocket',
          importsCount: counts.imports,
          exportsCount: counts.exports,
          callsCount: counts.calls,
          typeRefsCount: counts.typeRefs
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
  const { ASTEntityExtractor } = await import('./src/nivel2/infrastructure/services/entity-extraction/core/ASTEntityExtractor');
  const { ASTEntityAdapter } = await import('./src/nivel2/infrastructure/services/entity-conversion/ASTEntityAdapter');
      const { EntityFilterPipeline } = await import('./src/nivel2/infrastructure/services/entity-filtering/entity-filter-pipeline.js');
      
      // Check file type
      const ext = path.extname(fileName).toLowerCase();
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.php'];
      
      if (!supportedExtensions.includes(ext)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ 
          error: `Unsupported file type: ${ext}. Supported: ${supportedExtensions.join(', ')}`
        }));
        return;
      }
      
      // Only parse TS/JS AST for TS/JS files
      const ast = ext === '.php' ? undefined : parse(content, {
        loc: true,
        range: true,
        comment: true,
        tokens: false,
        ecmaVersion: 'latest' as const,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      });
      
  // Use ASTEntityExtractor for TS/JS (NEW HEXAGONAL ARCHITECTURE)
  const extractor = new ASTEntityExtractor(workspaceRoot);
      
      // Create temp file
      const tempDir = path.join(workspaceRoot, '.cappy-debug-temp');
      const tempFilePath = path.join(tempDir, fileName);
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempFilePath, content, 'utf-8');
      
      try {
  let rawEntities: unknown[] = [];
  let signatures: unknown[] = [];
  let jsdocChunks: unknown[] = [];

        if (ext === '.php') {
          // PHP path: use PHPParser to extract full structure
          const { PHPParser } = await import('./src/nivel2/infrastructure/parsers/php-parser.js');
          const phpParser = new PHPParser();
          
          // Get complete PHP analysis
          const phpAnalysis = await phpParser.analyze(tempFilePath);
          
          // Also get PHPDoc chunks for pipeline
          const phpChunks = await phpParser.parseFile(tempFilePath);
          jsdocChunks = phpChunks;
          console.log(`📝🐘 [Debug API] PHPDoc chunks extracted: ${phpChunks.length}`);
          console.log(`🐘 [Debug API] PHP Analysis: ${phpAnalysis.classes.length} classes, ${phpAnalysis.interfaces.length} interfaces, ${phpAnalysis.traits.length} traits, ${phpAnalysis.functions.length} functions`);

          // Build entities from ALL PHP symbols
          rawEntities = [];
          
          // Classes as entities
          for (const cls of phpAnalysis.classes) {
            rawEntities.push({
              type: 'export' as const,
              name: cls.name,
              source: tempFilePath,
              specifiers: [],
              scope: 'module' as const,
              metadata: { 
                symbolKind: 'class', 
                fullName: cls.fullName,
                extends: cls.extends,
                implements: cls.implements,
                isAbstract: cls.isAbstract,
                isFinal: cls.isFinal
              }
            });
            
            // Class methods
            for (const method of cls.methods) {
              rawEntities.push({
                type: 'export' as const,
                name: `${cls.name}::${method.name}`,
                source: tempFilePath,
                specifiers: [],
                scope: 'module' as const,
                isPrivate: method.visibility !== 'public',
                metadata: { 
                  symbolKind: 'method',
                  visibility: method.visibility,
                  isStatic: method.isStatic,
                  className: cls.name
                }
              });
            }
            
            // Class properties
            for (const prop of cls.properties) {
              rawEntities.push({
                type: 'export' as const,
                name: `${cls.name}::$${prop.name}`,
                source: tempFilePath,
                specifiers: [],
                scope: 'module' as const,
                isPrivate: prop.visibility !== 'public',
                metadata: { 
                  symbolKind: 'property',
                  visibility: prop.visibility,
                  type: prop.type,
                  className: cls.name
                }
              });
            }
          }
          
          // Interfaces
          for (const iface of phpAnalysis.interfaces) {
            rawEntities.push({
              type: 'export' as const,
              name: iface.name,
              source: tempFilePath,
              specifiers: [],
              scope: 'module' as const,
              metadata: { 
                symbolKind: 'interface',
                fullName: iface.fullName,
                extends: iface.extends
              }
            });
          }
          
          // Traits
          for (const trait of phpAnalysis.traits) {
            rawEntities.push({
              type: 'export' as const,
              name: trait.name,
              source: tempFilePath,
              specifiers: [],
              scope: 'module' as const,
              metadata: { 
                symbolKind: 'trait',
                fullName: trait.fullName
              }
            });
          }
          
          // Functions
          for (const func of phpAnalysis.functions) {
            rawEntities.push({
              type: 'export' as const,
              name: func.name,
              source: tempFilePath,
              specifiers: [],
              scope: 'module' as const,
              metadata: { 
                symbolKind: 'function',
                returnType: func.returnType,
                parameters: func.parameters
              }
            });
          }
          
          // Uses (imports)
          for (const use of phpAnalysis.uses) {
            rawEntities.push({
              type: 'import' as const,
              name: use.fullName,
              source: use.fullName,
              specifiers: [use.alias],
              scope: 'module' as const,
              isExternal: true,
              metadata: { 
                alias: use.alias
              }
            });
          }
          
          // Store full PHP analysis for response
          signatures = [phpAnalysis];
          
          console.log(`📊 [Debug API] Raw entities extracted from PHP: ${rawEntities.length}`);
        } else {
          // ✨ Use NEW ASTEntityExtractor (with line numbers!)
          const astEntities = await extractor.extractFromFile(tempFilePath);
          console.log(`🔍 [ASTEntityExtractor] Starting extraction for: ${tempFilePath}`);
          console.log(`� [ASTEntityExtractor] File size: ${content.length} chars`);
          console.log(`✨ [ASTEntityExtractor] Extracted ${astEntities.length} entities from ${tempFilePath}`);
          
          // Convert ASTEntity[] → RawEntity[] using adapter
          rawEntities = ASTEntityAdapter.toRawEntities(astEntities);
          
          // Extract JSDoc chunks and signatures for visualization
          signatures = extractSignatures(ast);
          jsdocChunks = extractJSDocChunks(ast, fileName);
          console.log(`📝 [Debug API] JSDoc chunks extracted: ${jsdocChunks.length}`);
          console.log(`📊 [Debug API] Raw entities extracted: ${rawEntities.length}`);
        }
        
        // 🔥 Inicializa GraphStore para discovery
        const { SQLiteAdapter } = await import('./src/nivel2/infrastructure/database/sqlite-adapter.js');
        const dbPath = path.join(workspaceRoot, '.cappy', 'knowledge-graph.db');
        const graphStore = new SQLiteAdapter(dbPath);
        
        // 🔥 Inicializa EmbeddingService para JSDoc embeddings
        const { EmbeddingService } = await import('./src/nivel2/infrastructure/services/embedding-service.js');
        const embeddingService = new EmbeddingService();
        
        // 🔥 Apply pipeline filtering com GraphStore, EmbeddingService, JSDoc chunks E sourceCode
        const pipeline = new EntityFilterPipeline(
          {
            skipLocalVariables: true,
            skipPrimitiveTypes: true,
            skipAssetImports: true,
            discoverExistingEntities: true,
            extractDocumentation: true  // ← ATIVA EXTRAÇÃO DE DOCS
          },
          graphStore,
          embeddingService  // ← PASSA EMBEDDING SERVICE
        );
        
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipelineResult = await pipeline.process(rawEntities as any, tempFilePath, jsdocChunks as any, content);  // ← PASSA SOURCE CODE!
        
        console.log(`✅ [Debug API] Pipeline completed:
          - Original: ${pipelineResult.original.length}
          - Filtered: ${pipelineResult.filtered.length}
          - Deduplicated: ${pipelineResult.deduplicated.length}
          - Normalized: ${pipelineResult.normalized.length}
          - Enriched: ${pipelineResult.enriched.length}`);
        
        // Build response
        const counts = { imports: 0, exports: 0, calls: 0, typeRefs: 0 };
        let entitiesList: unknown[] = [];
        if (ext === '.php') {
          entitiesList = rawEntities;
          counts.exports = (rawEntities as unknown[]).length;
        } else {
          // Count entities by type from rawEntities (already has all info)
          entitiesList = rawEntities;
          for (const entity of rawEntities as Array<{ type: string }>) {
            if (entity.type === 'import') counts.imports++;
            else if (entity.type === 'export') counts.exports++;
            else if (entity.type === 'call') counts.calls++;
            else if (entity.type === 'typeRef') counts.typeRefs++;
          }
        }

        const response = {
          fileName,
          fileSize,
          mimeType,
          ast,
          entities: entitiesList,
          signatures,
          pipeline: pipelineResult,
          metadata: {
            lines: content.split('\n').length,
            characters: content.length,
            hasErrors: false,
            mode: 'vite-dev-server',
            importsCount: counts.imports,
            exportsCount: counts.exports,
            callsCount: counts.calls,
            typeRefsCount: counts.typeRefs
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

/**
 * Extrai chunks de documentação JSDoc do AST
 */
function extractJSDocChunks(ast: unknown, fileName: string): Array<{
  id: string;
  content: string;
  metadata: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    chunkType: 'jsdoc';
    symbolName?: string;
  };
}> {
  const chunks: Array<{
    id: string;
    content: string;
    metadata: {
      filePath: string;
      lineStart: number;
      lineEnd: number;
      chunkType: 'jsdoc';
      symbolName?: string;
    };
  }> = [];
  
  const visit = (node: unknown, parentName?: string): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    
    // Extrai comentários JSDoc
    if (n.leadingComments && Array.isArray(n.leadingComments)) {
      for (const comment of n.leadingComments) {
        const c = comment as Record<string, unknown>;
        if (c.type === 'CommentBlock' && typeof c.value === 'string') {
          const content = c.value.trim();
          
          // Verifica se é JSDoc (começa com **)
          if (content.startsWith('*')) {
            const symbolName = parentName || extractSymbolNameFromNode(n);
            const loc = c.loc as { start?: { line?: number }; end?: { line?: number } } | undefined;
            
            chunks.push({
              id: `jsdoc:${fileName}:${symbolName || chunks.length}`,
              content: `/**${content}*/`,
              metadata: {
                filePath: fileName,
                lineStart: loc?.start?.line || 0,
                lineEnd: loc?.end?.line || 0,
                chunkType: 'jsdoc',
                symbolName
              }
            });
          }
        }
      }
    }
    
    // Recursão
    for (const key in n) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'leadingComments') continue;
      const value = n[key];
      
      const currentName = extractSymbolNameFromNode(n) || parentName;
      
      if (Array.isArray(value)) {
        value.forEach(child => visit(child, currentName));
      } else if (typeof value === 'object') {
        visit(value, currentName);
      }
    }
  };
  
  visit(ast);
  return chunks;
}

/**
 * Extrai o nome do símbolo de um nó AST
 */
function extractSymbolNameFromNode(node: Record<string, unknown>): string | undefined {
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    const id = node.id as Record<string, unknown> | undefined;
    return id?.name as string | undefined;
  }
  if (node.type === 'VariableDeclarator') {
    const id = node.id as Record<string, unknown> | undefined;
    return id?.name as string | undefined;
  }
  return undefined;
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
