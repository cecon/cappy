# 🎨 Cappy WebUI - LightRAG Inspired Interface

## 📋 Overview

Interface web completa para o Cappy inspirada no [LightRAG WebUI](https://github.com/HKUDS/LightRAG/tree/main/lightrag_webui), com menu de navegação superior e sistema de tabs.

## 🏗️ Arquitetura

```
src/
├── components/
│   ├── ui/                    # Componentes base (Button, Card, Tabs, etc.)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Tabs.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── Header.tsx         # Menu superior com navegação
│   │   ├── ThemeToggle.tsx    # Toggle dark/light
│   │   └── StatusBar.tsx      # Barra de status inferior
│   └── pages/
│       ├── DocumentsPage.tsx  # Upload e gerenciamento de documentos
│       ├── GraphPage.tsx      # Visualização do grafo
│       ├── RetrievalPage.tsx  # Testes de busca/retrieval
│       └── ApiPage.tsx        # Documentação da API
├── hooks/
│   ├── useTheme.ts
│   └── useVSCode.ts          # Comunicação com VS Code
├── stores/
│   ├── settings.ts           # Zustand store para configurações
│   └── graph.ts              # Estado do grafo
└── App.tsx                   # Componente principal com tabs
```

## 🎯 Features

### 1. **Header com Navegação** (Inspirado no LightRAG)
- Logo do Cappy
- 4 Tabs principais:
  - 📁 Documents
  - 🌐 Knowledge Graph
  - 🔍 Retrieval
  - 📡 API
- Toggle de tema (light/dark)
- Indicador de status

### 2. **Documents Page**
- Upload de arquivos (drag & drop)
- Lista de documentos indexados
- Status de processamento
- Botões: Scan, Reprocess, Clear

### 3. **Knowledge Graph Page**
- Visualização do grafo (D3.js/Reagraph)
- Controles de layout
- Busca de nodes/edges
- Filtros (tipos, confiança)
- Exportação

### 4. **Retrieval Page**
- Query input
- Modos: local, global, hybrid, mix
- Resultados com destaque
- Histórico de queries

### 5. **API Page**
- Documentação interativa
- Exemplos de código
- Status da API

## 🎨 Design System

### Cores (VS Code Theme Compatible)
```css
/* Light Theme */
--background: hsl(0 0% 100%)
--foreground: hsl(222.2 84% 4.9%)
--primary: hsl(142.1 76.2% 36.3%)  /* Emerald */
--secondary: hsl(210 40% 96.1%)

/* Dark Theme */
--background: hsl(222.2 84% 4.9%)
--foreground: hsl(210 40% 98%)
--primary: hsl(142.1 70.6% 45.3%)
--secondary: hsl(217.2 32.6% 17.5%)
```

### Typography
- Font Family: var(--vscode-font-family)
- Header: 14px
- Body: 13px
- Small: 11px

### Spacing
- Header Height: 40px
- Tab Height: 32px
- Padding: 16px, 12px, 8px
- Gap: 16px, 12px, 8px

## 📦 Componentes UI Base

### Button
```tsx
<Button variant="primary" size="sm" onClick={...}>
  Click me
</Button>
```
Variants: primary, secondary, outline, ghost, destructive

### Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Tabs
```tsx
<Tabs defaultValue="documents">
  <TabsList>
    <TabsTrigger value="documents">Documents</TabsTrigger>
    <TabsTrigger value="graph">Graph</TabsTrigger>
  </TabsList>
  <TabsContent value="documents">...</TabsContent>
  <TabsContent value="graph">...</TabsContent>
</Tabs>
```

## 🔌 Integração com VS Code

### Comunicação via postMessage
```typescript
// WebView → Extension
vscode.postMessage({ 
  type: 'loadGraph',
  payload: { maxNodes: 500 }
});

// Extension → WebView
window.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  switch (type) {
    case 'graph-data':
      setGraphData(payload);
      break;
  }
});
```

### Mensagens Suportadas
- `loadGraph` - Carrega dados do grafo
- `searchGraph` - Busca no grafo
- `uploadDocument` - Faz upload de documento
- `indexWorkspace` - Indexa o workspace
- `openFile` - Abre arquivo no editor

## 🚀 Stack Tecnológico

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **D3.js / Reagraph** - Graph visualization
- **Radix UI** - Accessible components
- **Lucide React** - Icons

## 📝 TODO

- [ ] Implementar Header com tabs
- [ ] Criar DocumentsPage com upload
- [ ] Criar GraphPage com D3.js
- [ ] Criar RetrievalPage
- [ ] Criar ApiPage
- [ ] Implementar tema dark/light
- [ ] Integrar com GraphService
- [ ] Testes E2E

## 🔗 Referências

- [LightRAG WebUI](https://github.com/HKUDS/LightRAG/tree/main/lightrag_webui)
- [Radix UI](https://www.radix-ui.com/)
- [Reagraph](https://reagraph.dev/)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)

---

**Status:** 🟡 Em desenvolvimento  
**Versão:** 1.0.0  
**Última atualização:** 12/10/2025
