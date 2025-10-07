# MCP Standalone Server Architecture - v2.9.66

## 📋 Summary

Refatoramos a arquitetura do MCP Server do Cappy para resolver o problema de dependência do módulo `vscode`. Agora o MCP server roda como processo standalone Node.js que comunica com a extensão via HTTP API.

## 🚨 Problem

**Antes (v2.9.65 e anteriores):**
```
MCP Client (VS Code/Copilot)
  ↓ stdio
extension.mcp.js (requires 'vscode' module)
  ❌ ERROR: Cannot find module 'vscode'
```

O arquivo `extension.mcp.ts` tentava usar `import * as vscode from 'vscode'`, mas MCP servers rodam como processos Node.js separados onde o módulo `vscode` não está disponível.

**Error log:**
```
Error: Cannot find module 'vscode'
Require stack:
- c:\Users\xxx\.vscode\extensions\eduardocecon.cappy-2.9.65\out\extension.mcp.js
```

## ✅ Solution

**Agora (v2.9.66+):**
```
MCP Client (VS Code/Copilot)
  ↓ stdio
Standalone MCP Server (Node.js)
  ↓ HTTP (localhost:38194)
Extension HTTP API
  ↓ vscode module
Extension Services (AddDocumentTool, etc.)
```

### Arquitetura em Camadas

1. **Standalone MCP Server** (`src/mcp-standalone/server.ts`)
   - Roda como processo Node.js puro
   - NÃO importa o módulo vscode
   - Implementa MCP protocol (stdio transport)
   - Comunica com extensão via HTTP

2. **Extension HTTP API** (`src/api/extensionHTTPAPI.ts`)
   - HTTP server rodando na extensão (porta 38194)
   - Expõe endpoints REST para as tools
   - Usa o módulo vscode livremente
   - Chama os serviços da extensão

3. **Extension Services** (`src/tools/*.ts`)
   - Implementação das funcionalidades
   - Acessa VS Code APIs normalmente
   - Usado tanto pelo HTTP API quanto pelo Copilot direto

## 📂 File Structure

```
src/
├── mcp-standalone/
│   └── server.ts                 # Standalone MCP server (NO vscode module)
├── api/
│   └── extensionHTTPAPI.ts       # HTTP API bridge
├── tools/
│   └── addDocumentTool.ts        # Extension services (uses vscode)
└── extension.ts                  # Main extension (starts HTTP API)

out/
├── mcp-standalone/
│   └── server.js                 # Compiled standalone server
└── api/
    └── extensionHTTPAPI.js       # Compiled HTTP API
```

## 🔧 Configuration

### VS Code `.vscode/mcp.json`
```json
{
  "servers": {
    "cappy": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/path/to/extension/out/mcp-standalone/server.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "CAPPY_API_PORT": "38194"
      },
      "description": "Cappy Memory - Context Orchestration and RAG System"
    }
  }
}
```

**Key Changes:**
- ✅ Points to `mcp-standalone/server.js` (not `extension.mcp.js`)
- ✅ Passes `CAPPY_API_PORT` environment variable
- ✅ Standalone server doesn't require vscode module

### Extension Activation

When the extension activates:
1. Starts HTTP API on port 38194 (or next available)
2. Sets `process.env.CAPPY_API_PORT`
3. MCP config manager creates `.vscode/mcp.json` with correct path
4. MCP server can now communicate with extension

## 🌐 HTTP API Endpoints

### `GET /api/health`
Health check for connectivity

### `POST /api/cappyrag/addDocument`
Add document to knowledge base

**Request:**
```json
{
  "filePath": "/path/to/file.md",
  "title": "Optional Title",
  "tags": ["tag1", "tag2"]
}
```

**Response:**
```json
{
  "success": true,
  "documentId": "doc_123",
  "metadata": {...},
  "processing": {
    "entitiesFound": 15,
    "relationshipsFound": 8
  }
}
```

### `POST /api/cappyrag/query` *(placeholder)*
Query knowledge base

### `GET /api/cappyrag/stats` *(placeholder)*
Get knowledge base statistics

## 🔄 Communication Flow

### Example: Adding a Document

```
1. User/Copilot: "Add document.md to knowledge base"
   ↓
2. VS Code calls MCP tool: cappyrag_add_document
   ↓
3. Standalone MCP Server receives request (via stdio)
   ↓
4. MCP Server makes HTTP request:
   POST http://localhost:38194/api/cappyrag/addDocument
   ↓
5. Extension HTTP API receives request
   ↓
6. HTTP API calls AddDocumentTool.addDocument()
   ↓
7. AddDocumentTool uses vscode module + processors
   ↓
8. Result flows back: HTTP → MCP Server → VS Code → User
```

## 📦 Build Process

### tsconfig.json (extension)
```json
{
  "compilerOptions": {
    "outDir": "out",
    "rootDir": "src"
  },
  "exclude": ["src/mcp-standalone/**"]
}
```

### tsconfig.mcp-standalone.json (standalone server)
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ES2020",
    "outDir": "out/mcp-standalone",
    "rootDir": "src/mcp-standalone"
  },
  "include": ["src/mcp-standalone/**/*"]
}
```

### package.json scripts
```json
{
  "scripts": {
    "compile": "tsc -p ./ && tsc -p ./tsconfig.mcp-standalone.json && npm run copy-assets"
  }
}
```

## 🧪 Testing

1. **Start Extension**: Open VS Code with Cappy installed
2. **Verify HTTP API**: Check console for "HTTP API listening on http://localhost:38194"
3. **Check MCP Config**: Verify `.vscode/mcp.json` was created with correct path
4. **Test Health**: `curl http://localhost:38194/api/health`
5. **Use Copilot**: Ask Copilot to add a document using Cappy tools

### Expected Logs

**Extension Console:**
```
🦫 Cappy: Starting activation...
🛠️ Cappy: CappyRAG MCP tools registered
🌐 Cappy: HTTP API started on port 38194
[MCP] Setting up MCP config for VS Code...
[MCP] Created mcp.json at: D:/workspace/.vscode/mcp.json
```

**MCP Server (stderr):**
```
🦫 Cappy MCP Server started successfully
```

## 🐛 Troubleshooting

### "Cannot find module 'vscode'" Error
- ✅ FIXED: Use `mcp-standalone/server.js` (not `extension.mcp.js`)
- Standalone server doesn't import vscode

### "ECONNREFUSED" Error
- Extension HTTP API not running
- Check extension activation logs
- Verify port 38194 not blocked

### "No output in .cappy/output.txt"
- Wrong context: This error is for CAPPY task commands
- Not related to MCP server

### MCP Server Not Starting
- Check `.vscode/mcp.json` path is correct
- Verify `out/mcp-standalone/server.js` exists after compile
- Check `CAPPY_API_PORT` env variable is passed

## 📚 Related Documentation

- `docs/mcp-auto-config.md` - MCP configuration details
- `docs/mcp-testing-guide.md` - Testing instructions
- `docs/cappyrag-implementation-complete.md` - CappyRAG architecture
- VS Code MCP Docs: https://modelcontextprotocol.io/docs/tools/vscode

## 🎯 Benefits

1. **✅ No vscode dependency in MCP server** - Runs as pure Node.js
2. **✅ Separation of concerns** - MCP protocol vs Extension logic
3. **✅ Easier testing** - Can test HTTP API independently
4. **✅ Better error handling** - Clear separation of errors
5. **✅ Future extensibility** - Can add more API endpoints easily
6. **✅ Works with any MCP client** - Not tied to VS Code internals

## 🔄 Migration from v2.9.65

If you have v2.9.65 or earlier:

1. **Uninstall old version**
2. **Delete `.vscode/mcp.json`** (will be recreated)
3. **Install v2.9.66+**
4. **Run `cappy.init`** to regenerate config
5. **Reload VS Code**

Old config pointed to `extension.mcp.js` (broken). New config points to `mcp-standalone/server.js` (working).

## 📊 Version History

- **v2.9.65**: MCP config structure fixed, but server still broken (vscode dependency)
- **v2.9.66**: Standalone MCP server + HTTP API architecture (WORKING)

## 🚀 Next Steps

1. ✅ Implement `cappyrag_query` endpoint
2. ✅ Implement `cappyrag_get_stats` endpoint
3. ✅ Add authentication/security for HTTP API
4. ✅ Add rate limiting
5. ✅ Create integration tests
6. ✅ Add telemetry for API usage
