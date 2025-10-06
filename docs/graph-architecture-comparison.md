# Arquitetura de Visualização - Knowledge Graph

## Implementação Atual (v2.9.61)

### 🚀 Abordagem: Navegação entre Páginas

```
Dashboard Principal (htmlTemplate.ts)
├─ Tab "Knowledge Graph" = Launch Card
│  ├─ Preview de stats
│  └─ Botão "Open Knowledge Graph"
└─ Clique → Navega para graph-page.html

Graph Page (graph-page.html)
├─ Header com "← Back to Dashboard"
├─ D3.js carregado diretamente (inline)
├─ Force-directed graph full-screen
└─ Clique em Back → Retorna ao dashboard
```

**Funcionamento:**
1. Dashboard mostra launch card com preview de stats
2. Usuário clica em "Open Knowledge Graph"
3. Extension substitui HTML inteiro por `graph-page.html`
4. D3.js inline roda diretamente (sem iframe!)
5. Usuário clica "← Back to Dashboard"
6. Extension restaura dashboard HTML
7. Dados recarregados automaticamente

**Vantagens:**
✅ **Simplicidade máxima** - zero iframe  
✅ **D3.js direto** - sem data URI  
✅ **Performance excelente** - menos overhead  
✅ **UX clara** - página dedicada  
✅ **Sem isolamento desnecessário**  
✅ **Fácil manutenção**  

**Desvantagens:**
⚠️ Estado perdido ao navegar (aceitável)  
⚠️ Recarrega dados ao voltar (rápido)  

---

## Alternativa Descartada: Iframe com Data URI

**Por que foi descartada:**
- Complexidade desnecessária
- Data URI com base64 muito verboso
- Dois contextos JavaScript
- postMessage overhead
- Difícil de debugar

---

## Arquitetura Anterior (v2.9.60): Iframe com Data URI

### 🚀 Conceito

```
Dashboard Principal (dashboard.html)
├─ Tabs: Documents | Query | Queue
├─ Tab "Knowledge Graph" = Botão "Open Graph"
└─ Menu superior persistente

Knowledge Graph Page (graph-page.html)
├─ D3.js carregado diretamente
├─ Botão "← Back to Dashboard"
└─ Menu superior persistente
```

### Implementação (Como era proposto, agora é realidade!)

#### 1. Dashboard com Launch Card ✅ IMPLEMENTADO

```html
<!-- Knowledge Graph Tab -->
<div id="graph-tab" class="tab-content">
    <div class="launch-card">
        <h3>Interactive Knowledge Graph</h3>
        <p>Explore with D3.js force-directed visualization</p>
        
        <!-- Stats Preview -->
        <div class="stats-preview">
            <span>441 Nodes</span>
            <span>733 Edges</span>
        </div>
        
        <button onclick="openGraphPage()">
            📊 Open Knowledge Graph
        </button>
    </div>
</div>

<script>
function openGraphPage() {
    vscode.postMessage({ command: 'openGraphPage' });
}
</script>
```

#### 2. Graph Page Dedicada ✅ IMPLEMENTADO

```html
<!-- graph-page.html -->
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
    <!-- OU D3.js inline para evitar CDN -->
</head>
<body>
    <!-- Header com navegação -->
    <div class="header">
        <button onclick="goBack()">
            ← Back to Dashboard
        </button>
        <h1>Knowledge Graph</h1>
        <div class="actions">
            <button onclick="resetView()">Reset</button>
            <button onclick="exportImage()">Export</button>
        </div>
    </div>

    <!-- Graph SVG Container -->
    <svg id="graph"></svg>

    <script>
        // D3.js carregado DIRETAMENTE (sem iframe!)
        const svg = d3.select('#graph');
        
        // Receber dados
        window.addEventListener('message', event => {
            if (event.data.command === 'graphData') {
                renderGraph(event.data.data);
            }
        });
        
        // Request data on load
        vscode.postMessage({ command: 'getGraphData' });
        
        function goBack() {
            vscode.postMessage({ command: 'backToDashboard' });
        }
    </script>
</body>
</html>
```

#### 3. Extension Handler ✅ IMPLEMENTADO

```typescript
// index.ts
let currentPanel: vscode.WebviewPanel | undefined;
let currentPage: 'dashboard' | 'graph' = 'dashboard';

// Dashboard message handler
case 'openGraphPage':
    currentPage = 'graph';
    const graphHtml = getGraphPageHTML(context);
    panel.webview.html = graphHtml;
    break;

case 'backToDashboard':
    currentPage = 'dashboard';
    const dashboardHtml = getDashboardHTML(context);
    panel.webview.html = dashboardHtml;
    break;

// Graph page loads
function getGraphPageHTML(context: vscode.ExtensionContext): string {
    const graphPagePath = path.join(context.extensionPath, 'out', 'webview', 'graph-page.html');
    let html = fs.readFileSync(graphPagePath, 'utf8');
    
    // Inject D3.js inline se necessário
    const d3Path = path.join(context.extensionPath, 'out', 'webview', 'd3.v7.min.js');
    const d3Content = fs.readFileSync(d3Path, 'utf8');
    html = html.replace('<!-- D3_PLACEHOLDER -->', `<script>${d3Content}</script>`);
    
    return html;
}
```

### Comparação: Iframe vs Navegação

| Aspecto | Iframe (v2.9.60 - Descartada) | Navegação (v2.9.61 - **ATUAL**) |
|---------|----------------|-------------------------|
| **Complexidade** | Média (data URI) | Baixa (HTML simples) |
| **Isolamento** | Total (sandbox) | Parcial (mesma webview) |
| **Performance** | Boa (lazy load) | Excelente (direto) |
| **Comunicação** | postMessage | postMessage |
| **D3.js Loading** | Inline + data URI | Inline direto |
| **UX** | Aba no dashboard | Página dedicada |
| **Back Button** | N/A | Necessário |
| **Estado** | Perdido ao voltar | Perdido ao voltar |
| **Desenvolvimento** | Complexo | Simples |
| **Manutenção** | Média | Fácil |

### Quando Usar Cada Abordagem?

#### Use Iframe quando:
- ✅ Quer isolamento máximo
- ✅ Componente é "embutido" na página
- ✅ Não quer navegação full-screen
- ✅ Precisa de sandbox adicional
- ✅ Quer evitar conflitos garantidamente

#### Use Navegação (ESCOLHIDA) quando:
- ✅ Componente precisa de espaço full-screen
- ✅ Quer simplicidade máxima
- ✅ Não se importa com isolamento parcial
- ✅ Quer melhor performance
- ✅ Aceita recarregar dados ao voltar

### ✅ Implementação Concluída (v2.9.61)

**Passo 1**: ✅ `graph-page.html` criado e funcionando
**Passo 2**: ✅ Launch card adicionado ao dashboard
**Passo 3**: ✅ Handlers `openGraphPage` e `backToDashboard` implementados
**Passo 4**: ✅ Navegação testada e funcional
**Passo 5**: ⏳ State management (não necessário por enquanto)

### State Management para Navegação

```typescript
// Manter estado ao navegar
interface AppState {
    currentPage: 'dashboard' | 'graph';
    dashboardTab: string;
    graphFilters: GraphFilters;
    graphZoom: ZoomState;
}

const state: AppState = {
    currentPage: 'dashboard',
    dashboardTab: 'documents',
    graphFilters: {...},
    graphZoom: {...}
};

// Ao navegar, salvar estado
function openGraphPage() {
    state.currentPage = 'graph';
    state.dashboardTab = getCurrentTab();
    saveState(state);
    navigateToGraph();
}

// Ao voltar, restaurar estado
function backToDashboard() {
    const savedState = loadState();
    state.currentPage = 'dashboard';
    navigateToDashboard();
    setCurrentTab(savedState.dashboardTab);
}
```

---

## Conclusão

**✅ Navegação entre páginas ADOTADA (v2.9.61)** porque:
1. ✅ **Simplicidade** - código mais limpo e fácil de manter
2. ✅ **Performance** - D3.js direto sem overhead
3. ✅ **UX superior** - página dedicada full-screen
4. ✅ **Sem complexidade** - zero iframe, zero data URI
5. ✅ **Melhor debugabilidade** - um contexto JavaScript

**Por que abandonamos iframe:**
1. ❌ Data URI muito complexo (base64, escape de caracteres)
2. ❌ Dois contextos JavaScript dificultando debug
3. ❌ postMessage overhead desnecessário
4. ❌ Isolamento era overkill para este caso
5. ❌ Código mais difícil de manter

**Resultado:** Graph agora é uma **página dedicada** que oferece melhor experiência, código mais simples, e performance superior!

---

## Arquivos

### Atual (v2.9.61) ✅
- `src/webview/graph-page.html` - **Página dedicada full-screen**
- `src/webview/d3.v7.min.js` - D3.js inline (279 KB)
- `src/commands/cappyrag/templates/htmlTemplate.ts` - Launch card
- `src/commands/cappyrag/templates/dashboard.js` - `openGraphPage()` function
- `src/commands/cappyrag/index.ts` - Handlers `openGraphPage` e `backToDashboard`

### Anterior (v2.9.60) ❌ Descartada
- `src/webview/graph-d3.html` - Template iframe (não usado mais)
- `src/commands/cappyrag/templates/dashboard.js` - Código iframe removido
- Data URI approach - Complexidade desnecessária

---

**Versão**: 2.9.61  
**Data**: 6 de Outubro de 2025  
**Status**: ✅ Navegação entre páginas implementada e funcionando perfeitamente!
