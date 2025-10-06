# D3.js Iframe Loading Solution for VS Code

## Problema
Carregar D3.js (279 KB minified) em um iframe dentro de uma webview do VS Code apresentou múltiplos desafios devido às restrições de Content Security Policy (CSP) e limitações do ambiente sandboxed.

## Tentativas Anteriores

### 1. CDN Loading (❌ Falhou)
```html
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
```
**Problema:** VS Code CSP bloqueia carregamento de recursos externos via CDN.

### 2. Blob URL (❌ Falhou)
```javascript
const blob = new Blob([htmlContent], { type: 'text/html' });
const blobUrl = URL.createObjectURL(blob);
iframe.src = blobUrl;
```
**Problema:** Mesmo com `frame-src blob:;` na CSP, havia inconsistências no carregamento.

### 3. iframe.srcdoc (❌ Falhou)
```javascript
iframe.srcdoc = htmlWithInlineD3;
```
**Problema:** D3.js minificado (279 KB) causava erro de parsing: "Uncaught SyntaxError: Invalid or unexpected token".

### 4. iframe.contentDocument.write() (❌ Falhou)
```javascript
const iframeDoc = iframe.contentDocument;
iframeDoc.open();
iframeDoc.write(htmlWithInlineD3);
iframeDoc.close();
```
**Problema:** Mesmo erro de parsing - "Failed to execute 'write' on 'Document': Invalid or unexpected token".

## Solução Final: Data URI (✅ Funciona)

```javascript
// Dashboard.js
case 'graphD3HTML':
    const iframe = document.getElementById('graph-d3-iframe');
    if (iframe) {
        // Convert HTML to base64 data URI
        const base64Html = btoa(unescape(encodeURIComponent(message.data)));
        iframe.src = 'data:text/html;base64,' + base64Html;
        iframe.style.display = 'block';
        
        iframe.onload = function() {
            console.log('[Graph] D3.js iframe loaded via data URI');
            setTimeout(() => {
                vscode.postMessage({ command: 'getGraphData' });
            }, 500);
        };
    }
    break;
```

### CSP Configuration
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               style-src ${webview.cspSource} 'unsafe-inline'; 
               script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; 
               frame-src data:;">
```

## Por que Data URI Funciona?

1. **Sem parsing intermediário**: O navegador carrega diretamente o base64 decodificado
2. **CSP compatível**: `frame-src data:;` é suportado pelo VS Code
3. **Isolamento mantido**: O iframe ainda roda em sandbox, mas com conteúdo completo
4. **Sem escape issues**: Base64 encoding elimina problemas com caracteres especiais

## Arquitetura Final

```
Extension Backend (index.ts)
    ↓
1. Lê graph-d3.html
2. Lê d3.v7.min.js (279 KB)
3. Injeta D3.js inline no HTML
    ↓
Dashboard.js (webview)
    ↓
4. Recebe HTML completo via postMessage
5. Converte para base64 data URI
6. Carrega no iframe
    ↓
Graph D3.js (iframe)
    ↓
7. D3.js inicializa
8. Recebe dados via postMessage
9. Renderiza force-directed graph
```

## Fluxo de Comunicação

```javascript
// Extension → Dashboard
panel.webview.postMessage({ 
    command: 'graphD3HTML', 
    data: htmlWithInlineD3 
});

// Dashboard → Iframe
iframe.contentWindow.postMessage({
    command: 'graphData',
    data: { nodes: [...], edges: [...] }
}, '*');

// Iframe → Dashboard (via window.parent)
window.parent.postMessage({
    command: 'nodeClick',
    nodeId: '...'
}, '*');
```

## Vantagens da Solução

✅ **Funciona 100% offline** - D3.js embutido, sem CDN  
✅ **Sem problemas de CSP** - data URI é permitido  
✅ **Sem parsing errors** - base64 evita caracteres problemáticos  
✅ **Mantém isolamento** - iframe sandbox preservado  
✅ **Performance adequada** - carregamento único do HTML  
✅ **Compatível VS Code** - testado em ambiente real  

## Arquivos Modificados

1. **src/webview/d3.v7.min.js** - D3.js v7 local (279 KB)
2. **src/webview/graph-d3.html** - Template HTML com placeholder para D3.js
3. **src/commands/cappyrag/index.ts** - Injeta D3.js inline e envia HTML
4. **src/commands/cappyrag/templates/dashboard.js** - Converte para data URI
5. **src/commands/cappyrag/templates/htmlTemplate.ts** - CSP com `frame-src data:;`

## Versão
Implementado na versão **2.9.59** do Cappy Framework.

## Referências
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Data URIs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs)
- [D3.js Documentation](https://d3js.org/)
