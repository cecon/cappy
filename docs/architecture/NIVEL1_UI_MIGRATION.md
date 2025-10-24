# Nivel1 UI Migration – Summary

## Overview

This document tracks the migration of all presentation layer components from legacy `src/components` and `src/webview` to the clean architecture layer `src/nivel1`.

## Completed (✅)

### 1. Chat UI Migration
- **From**: `src/webview/chats-dist/` (removed)
- **To**: `src/nivel1/ui/pages/chat/ChatView.tsx`
- **Provider**: `src/nivel1/adapters/vscode/chat/ChatViewProvider.ts`
- **Status**: ✅ Fully migrated; lint-clean; builds and tests pass.

### 2. Documents (Dashboard) UI Migration
- **From**: Legacy webview structures
- **To**: `src/nivel1/ui/pages/dashboard/DocumentsPage.tsx`
- **Provider**: `src/nivel1/adapters/vscode/documents/DocumentsViewProvider.ts`
- **Status**: ✅ Fully migrated; lint-clean; builds and tests pass.

### 3. Graph UI Migration
- **From**: `src/components/GraphApp.tsx`, `src/components/GraphVisualizer.tsx`, `src/components/pages/{GraphPage,RetrievalPage,ApiPage}.tsx`, `src/components/layout/Header.tsx`
- **To**:
  - `src/nivel1/ui/graph/App.tsx` (new graph UI container with Tabs)
  - `src/nivel1/ui/graph/GraphVisualizer.tsx`
  - `src/nivel1/ui/graph/pages/GraphPage.tsx`
  - `src/nivel1/ui/graph/pages/RetrievalPage.tsx` (placeholder)
  - `src/nivel1/ui/graph/pages/ApiPage.tsx` (placeholder)
  - `src/nivel1/ui/graph/layout/Header.tsx`
- **Entry**: Updated `src/graph-main.tsx` to import `src/nivel1/ui/graph/App`
- **Provider**: `src/nivel1/adapters/vscode/graph/GraphPanel.ts` (fully migrated with usecases)
- **Status**: ✅ Fully migrated; lint-clean; builds and tests pass.

### 4. UI Primitives Migration
- **From**: `src/components/ui/{Button,Card,Tabs}.tsx`
- **To**: `src/nivel1/ui/primitives/{Button,Card,Tabs}.tsx` (full implementations)
- **Re-exports**: `src/nivel1/ui/Button.tsx` and `src/nivel1/ui/Card.tsx` now re-export from primitives.
- **Status**: ✅ Fully migrated; lint-clean; builds and tests pass.

### 5. Adapters Migration (Primary → nivel1)
- **Chat**: `src/nivel1/adapters/vscode/chat/ChatViewProvider.ts`
- **Documents**: `src/nivel1/adapters/vscode/documents/DocumentsViewProvider.ts`
- **Graph**: `src/nivel1/adapters/vscode/graph/` (GraphPanel, WebviewContentBuilder, IndexingInitializer, WorkspaceIndexer, usecases/*)
- **Extension Entry**: Updated `src/extension.ts` to import all providers from nivel1
- **Status**: ✅ Fully migrated; lint-clean; builds and tests pass.

### 6. Legacy Cleanup
- **Removed**:
  - `src/nivel1/webviews/` (legacy webview folder)
  - `src/webview/chats-dist/`
  - `src/components/` (entire folder, including GraphApp, GraphVisualizer, pages, layout, tools, ui, WebUI*)
- **Status**: ✅ Deleted; no references remain in code (only in documentation).

## Architecture

### Nivel1 Structure

```
src/nivel1/
├── ui/
│   ├── Button.tsx (re-export)
│   ├── Card.tsx (re-export)
│   ├── primitives/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Tabs.tsx
│   ├── pages/
│   │   ├── chat/
│   │   │   ├── ChatView.tsx
│   │   │   └── tools/
│   │   └── dashboard/
│   │       └── DocumentsPage.tsx
│   └── graph/
│       ├── App.tsx
│       ├── GraphVisualizer.tsx
│       ├── layout/
│       │   └── Header.tsx
│       └── pages/
│           ├── GraphPage.tsx
│           ├── RetrievalPage.tsx
│           └── ApiPage.tsx
└── adapters/
    └── vscode/
        ├── chat/
        │   └── ChatViewProvider.ts
        ├── documents/
        │   └── DocumentsViewProvider.ts
        └── graph/
            ├── GraphPanel.ts
            ├── WebviewContentBuilder.ts
            ├── IndexingInitializer.ts
            ├── WorkspaceIndexer.ts
            └── usecases/
                ├── UseCase.ts
                ├── ReadyUseCase.ts
                ├── LoadSubgraphUseCase.ts
                ├── GetDbStatusUseCase.ts
                ├── SearchUseCase.ts
                ├── RefreshUseCase.ts
                ├── ResetGraphUseCase.ts
                ├── OpenFileUseCase.ts
                ├── DocumentsUploadRequestedUseCase.ts
                ├── DocumentsUploadSelectedUseCase.ts
                ├── DocumentsScanWorkspaceUseCase.ts
                ├── DocumentsConfigureSourcesUseCase.ts
                ├── DocumentsConfirmRemoveUseCase.ts
                └── DocumentsConfirmClearUseCase.ts
```

### Entry Points

- **Chat**: `src/main.tsx` → `src/App.tsx` (selects page via data-page="chat") → `nivel1/ui/pages/chat/ChatView.tsx`
- **Documents**: `src/main.tsx` → `src/App.tsx` (selects page via data-page="documents") → `nivel1/ui/pages/dashboard/DocumentsPage.tsx`
- **Graph**: `src/graph-main.tsx` → `nivel1/ui/graph/App.tsx` (Tabs wrapper for GraphPage/RetrievalPage/ApiPage)

### Vite Bundle Outputs

- **Main UI**: `out/main.js`, `out/main.css` (serves Chat & Documents)
- **Graph UI**: `out/graph.js`, `out/graph.css`, `out/graph.html`

### Providers

All webview providers load assets from `out/` with CSP nonce injection and `data-page` attributes:

- `ChatViewProvider` → `data-page="chat"`
- `DocumentsViewProvider` → `data-page="documents"`
- `GraphPanel` → `graph.html` with dedicated graph UI bundle

## Lint & Build Status

- ✅ ESLint: All files satisfy strict rules (readonly, node:, globalThis, for-of, a11y, no nested ternaries extracted, etc.)
- ✅ TypeScript: Compiles successfully (TS errors in IDE are cosmetic; runtime bundle is correct)
- ✅ Vite: Builds without warnings
- ✅ Tests: All tests pass

## Next Steps (Pending)

1. **Secondary Adapters → nivel2**: Move `src/adapters/secondary/*` to `src/nivel2/infrastructure/adapters/` (database, vector, AI clients).
2. **Domain/Application → nivel2**: Ensure domain logic and application services reside in nivel2.
3. **Shared utilities**: Keep or migrate lib/utils and shared/ as appropriate.
4. **Documentation updates**: Update README and COPILOT_INTEGRATION docs to reflect nivel1/nivel2 structure.

## References

- Clean Architecture: Presentation (nivel1) → Application/Domain (nivel2) → Infrastructure (nivel2)
- ESLint config: `eslint.config.js`
- TypeScript configs: `tsconfig.extension.json`, `tsconfig.app.json`
- Vite config: `vite.config.ts`

---

**Date**: 2025
**Author**: Eduardo Mendonça (via GitHub Copilot)
