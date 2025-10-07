# 🦫 Cappy v2.9.67 - ES Modules Fix for MCP Server

**Release Date:** October 7, 2025  
**Type:** Critical Hotfix  
**Status:** ✅ Published to Marketplace

---

## 🚨 Issue Fixed

### "SyntaxError: Cannot use import statement outside a module"

**Error Log:**
```
SyntaxError: Cannot use import statement outside a module
    at Module._compile (node:internal/modules/cjs/loader:1495:20)
    at Module._extensions..js (node:internal/modules/cjs/loader:1623:10)
```

**Root Cause:** The standalone MCP server was compiled as ES2020 modules but the parent `package.json` declared `"type": "commonjs"`, causing Node.js to treat `.js` files as CommonJS.

---

## ✅ Solution

Created a separate `package.json` in `out/mcp-standalone/` with `"type": "module"` to tell Node.js to treat the standalone server as ES modules.

### File Structure
```
out/
├── mcp-standalone/
│   ├── package.json    ← NEW: {"type": "module"}
│   └── server.js       ← ES module syntax now works
└── extension.js        ← CommonJS (unchanged)
```

---

## 🔧 Changes

### 1. Added Build Script

**package.json:**
```json
{
  "scripts": {
    "copy-mcp-package": "node -e \"const fs=require('fs');fs.mkdirSync('out/mcp-standalone',{recursive:true});fs.writeFileSync('out/mcp-standalone/package.json',JSON.stringify({type:'module'},null,2))\"",
    "compile": "tsc -p ./ && tsc -p ./tsconfig.mcp-standalone.json && npm run copy-assets && npm run copy-mcp-package"
  }
}
```

This script automatically creates `out/mcp-standalone/package.json` during build.

### 2. TypeScript Config Unchanged

**tsconfig.mcp-standalone.json** remains as ES2020:
```json
{
  "compilerOptions": {
    "module": "ES2020",
    "target": "ES2020"
  }
}
```

### 3. Source Code Unchanged

**src/mcp-standalone/server.ts** keeps ES6 import syntax:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
```

---

## 🧪 Testing

### 1. Verify Compilation
```powershell
npm run compile
# Should create out/mcp-standalone/package.json
```

### 2. Check Package File
```powershell
cat out/mcp-standalone/package.json
# Expected: {"type": "module"}
```

### 3. Test MCP Server
1. Reload VS Code (`Ctrl+Shift+P` → `Developer: Reload Window`)
2. Open Output panel → filter for "MCP" logs
3. Should see: `🦫 Cappy MCP Server started successfully`
4. No more "SyntaxError: Cannot use import statement" errors

### 4. Test in Copilot
Ask Copilot to use Cappy tools:
```
Add document.md to Cappy knowledge base
```
Should work without errors.

---

## 📊 Comparison

| Version | Module System | Status |
|---------|---------------|--------|
| v2.9.65 | ❌ Mixed (caused vscode error) | Broken |
| v2.9.66 | ❌ Mixed (syntax error) | Broken |
| v2.9.67 | ✅ Explicit ES modules | **Working** |

---

## 🔄 Migration

### From v2.9.66

**No action needed** - just upgrade:
```powershell
code --install-extension eduardocecon.cappy
```

The extension will automatically include the correct `package.json` in the MCP standalone folder.

### Verify Installation

After installing v2.9.67:
1. Reload VS Code
2. Check logs: `Output` → `Cappy`
3. Look for: `🦫 Cappy MCP Server started successfully`
4. No syntax errors should appear

---

## 📈 Technical Details

### Why ES Modules?

The MCP SDK (`@modelcontextprotocol/sdk`) uses ES module syntax internally. When importing from it, we need to match the module system:

```typescript
// MCP SDK uses ES modules
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
```

### Why Not Convert to CommonJS?

While possible, it would require:
1. Changing all `import` to `require()`
2. Changing all `export` to `module.exports`
3. Dealing with async imports
4. Fighting TypeScript's module system

**Easier solution:** Tell Node.js to treat the standalone folder as ES modules.

### Node.js Module Resolution

Node.js determines module type by:
1. File extension (`.mjs` = ES, `.cjs` = CommonJS)
2. Nearest `package.json` with `"type"` field
3. Default: CommonJS

By adding `out/mcp-standalone/package.json`, we override the root `package.json` for just that folder.

---

## 🐛 Troubleshooting

### Still Getting Syntax Error?

1. **Clear extension cache:**
   ```powershell
   code --uninstall-extension eduardocecon.cappy
   code --install-extension eduardocecon.cappy
   ```

2. **Verify package.json exists:**
   ```powershell
   ls ~/.vscode/extensions/eduardocecon.cappy-*/out/mcp-standalone/package.json
   ```

3. **Check file contents:**
   ```powershell
   cat ~/.vscode/extensions/eduardocecon.cappy-*/out/mcp-standalone/package.json
   # Should be: {"type": "module"}
   ```

### MCP Server Not Starting?

Check VS Code logs:
```
View → Output → Select "MCP" from dropdown
```

Look for:
- ✅ `🦫 Cappy MCP Server started successfully` (good)
- ❌ `SyntaxError: Cannot use import statement` (still broken)
- ❌ `Cannot find module 'vscode'` (wrong architecture - shouldn't happen in v2.9.67)

---

## 📚 Related Issues

### History of MCP Server Fixes

1. **v2.9.65:** MCP config had wrong structure → Fixed structure
2. **v2.9.66:** MCP server required vscode module → Created standalone + HTTP API
3. **v2.9.67:** Syntax error with ES modules → Added package.json to standalone folder ✅

---

## 🎯 What Works Now

- ✅ MCP server starts without errors
- ✅ HTTP API running on localhost:38194
- ✅ `cappyrag_add_document` tool functional
- ✅ Copilot integration working
- ✅ Cross-document relationships working
- ✅ No vscode dependency errors
- ✅ No ES module syntax errors

---

## 📦 Build Details

**Version:** 2.9.67  
**Size:** 121.22 MB (10,187 files)  
**Build Date:** October 7, 2025  
**Node.js:** v20.19.5  
**TypeScript:** 4.9.4  

**Key Files:**
- `out/mcp-standalone/server.js` - ES module
- `out/mcp-standalone/package.json` - Module type declaration
- `out/api/extensionHTTPAPI.js` - HTTP bridge (CommonJS)
- `out/extension.js` - Main extension (CommonJS)

---

## 🚀 Next Steps

With the MCP server now fully functional, upcoming features:

### v2.9.68+ Roadmap

1. **Implement Query Tool**
   - `POST /api/cappyrag/query`
   - Semantic search endpoint
   - Result filtering and ranking

2. **Implement Stats Tool**
   - `GET /api/cappyrag/stats`
   - Document/entity/relationship counts
   - Storage metrics

3. **Add More MCP Tools**
   - List all documents
   - Delete documents
   - Update metadata
   - Bulk operations

4. **Security & Performance**
   - API authentication
   - Rate limiting
   - Request caching
   - Connection pooling

---

## ✅ Verification Checklist

After installing v2.9.67:

- [ ] Extension activates without errors
- [ ] HTTP API starts: Check for "HTTP API listening on port 38194"
- [ ] MCP server starts: Check for "🦫 Cappy MCP Server started successfully"
- [ ] No "Cannot use import statement" errors in logs
- [ ] File exists: `out/mcp-standalone/package.json`
- [ ] File contains: `{"type": "module"}`
- [ ] Health check works: `curl http://localhost:38194/api/health`
- [ ] Copilot can use `cappyrag_add_document` tool

---

## 📞 Support

- **Issues:** https://github.com/cecon/cappy/issues
- **Marketplace:** https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy
- **Docs:** See `docs/mcp-standalone-architecture.md`

---

**Installation:**
```powershell
code --install-extension eduardocecon.cappy
```

**Marketplace:** https://marketplace.visualstudio.com/items?itemName=eduardocecon.cappy

**Previous Version:** [v2.9.66](RELEASE-2.9.66.md) - Standalone architecture  
**License:** MIT
