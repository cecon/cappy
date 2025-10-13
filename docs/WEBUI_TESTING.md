# WebUI Integration - Testing Guide

## ✅ What Was Done

### 1. **Separate Entry Points Created**
- `src/main.tsx` → Chat View (existing)
- `src/graph-main.tsx` → Graph WebView (NEW)
- `graph.html` → Entry HTML for Graph (NEW)

### 2. **Vite Configuration Updated**
- Two build targets:
  - `main` → Chat bundle (132.84 kB)
  - `graph` → Graph bundle (48.80 kB)
- Shared dependencies in `index.js` (197.38 kB)

### 3. **GraphPanel.ts Updated**
- Loads `out/graph.html` at runtime
- Replaces relative paths with webview URIs
- Adds CSP (Content Security Policy)
- Injects nonce for security

### 4. **WebUI Components Created**
Inspired by LightRAG interface:
- **Header** with top navigation (Documents, Knowledge Graph, Retrieval, API)
- **4 Pages**:
  - `DocumentsPage` → Upload/scan documents
  - `GraphPage` → Graph visualization (placeholder for D3.js)
  - `RetrievalPage` → Query testing
  - `ApiPage` → API documentation
- **UI Components**: Tabs, Button, Card (Radix UI + Tailwind)
- **Theme**: VS Code compatible (dark/light)

---

## 🧪 How to Test

### Step 1: Build the Extension
```bash
npm run build
```
✅ Expected output:
```
out/graph.html     0.44 kB
out/graph.js      48.80 kB
out/main.js      132.84 kB
out/index.js     197.38 kB
out/style.css      8.68 kB
```

### Step 2: Launch Extension in Debug Mode
1. Press **F5** in VS Code
2. A new VS Code window will open (Extension Development Host)

### Step 3: Open the Graph Panel
1. Press **Ctrl+Shift+P** (or **Cmd+Shift+P** on Mac)
2. Type: `Cappy: Open Knowledge Graph`
3. Press Enter

### Step 4: Verify WebUI Loaded
You should see:
- ✅ Top navigation bar with 4 tabs (emerald green accent)
- ✅ "Documents" tab active by default
- ✅ Empty state with "Upload Documents" button
- ✅ Status bar at bottom showing "Ready" (green dot)

### Step 5: Test Navigation
Click each tab:
1. **Documents** → Upload interface
2. **Knowledge Graph** → Graph placeholder (says "React + Reagraph visualization will be integrated here")
3. **Retrieval** → Query testing interface with mode buttons (Local/Global/Hybrid/Mix)
4. **API** → API documentation with 4 endpoint examples

---

## 🐛 Troubleshooting

### Problem: Blank webview or old HTML
**Solution**: 
```bash
npm run build
```
Then restart the Extension Development Host (Ctrl+R in debug window)

### Problem: CSP errors in console
Check `GraphPanel.ts` CSP configuration includes:
```
style-src 'unsafe-inline'
script-src 'nonce-{nonce}'
```

### Problem: "Could not load built React app"
Check if `out/graph.html` exists:
```bash
ls -la out/graph.html
```

### Problem: Styles not loading
Verify `out/style.css` is being generated:
```bash
ls -la out/style.css
```

---

## 📋 Next Steps

### 1. Connect Graph to Backend
- Implement `useGraphData` hook
- Call `GraphService.loadGraph()` on mount
- Display real nodes/edges in GraphPage

### 2. Add D3.js Visualization
```bash
npm install reagraph
```
- Create `GraphVisualization` component
- Integrate with GraphPage
- Handle node/edge interactions

### 3. Implement Document Upload
- Add drag & drop functionality
- Connect to `IndexingService`
- Show upload progress

### 4. Add Theme Toggle
- Implement theme switcher in Header
- Persist preference
- Sync with VS Code theme

---

## 🎯 Current Architecture

```
Extension (Ctrl+Shift+P)
    ↓
GraphPanel.ts (loads graph.html)
    ↓
graph-main.tsx (React entry)
    ↓
WebUIApp.tsx (main component)
    ↓
    ├── Header (navigation)
    ├── DocumentsPage
    ├── GraphPage
    ├── RetrievalPage
    └── ApiPage
```

**Communication**:
- WebView → Extension: `vscode.postMessage()`
- Extension → WebView: `panel.webview.postMessage()`

---

## ✅ Success Criteria

- [ ] WebView opens without errors
- [ ] All 4 tabs are clickable and switch content
- [ ] VS Code theme colors are applied
- [ ] Status bar shows "Ready"
- [ ] No CSP violations in console
- [ ] Navigation is smooth (no flickering)

---

## 🚀 Ready to Test!

Press **F5** and open Command Palette → `Cappy: Open Knowledge Graph`
