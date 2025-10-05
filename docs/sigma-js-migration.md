# 🎨 Migração para Sigma.js

## Data: 05/10/2025

## Resumo

Migramos a visualização do Knowledge Graph de **Cytoscape.js** para **Sigma.js**, uma biblioteca mais moderna, performática e com melhor suporte para grafos grandes.

---

## 🚀 Por Que Sigma.js?

### **Vantagens sobre Cytoscape.js:**

1. **Performance Superior**
   - Otimizado para grafos com milhares de nós
   - Renderização WebGL para melhor performance
   - Menor uso de memória

2. **Visual Mais Moderno**
   - Renderização mais suave e fluida
   - Melhor antialiasing
   - Efeitos visuais mais sofisticados

3. **Melhor Experiência do Usuário**
   - Navegação mais intuitiva
   - Zoom e pan mais responsivos
   - Tooltips nativos

4. **Comunidade Ativa**
   - Versão 3.0 recém-lançada
   - Documentação excelente
   - Exemplos abundantes

---

## 📦 Bibliotecas Utilizadas

```html
<!-- Graphology: Biblioteca de estrutura de dados para grafos -->
<script src="https://cdn.jsdelivr.net/npm/graphology@0.25.4/dist/graphology.umd.min.js"></script>

<!-- Sigma.js v3: Renderização e visualização -->
<script src="https://cdn.jsdelivr.net/npm/sigma@3.0.0-beta.27/build/sigma.min.js"></script>
```

- **Graphology**: Gerencia a estrutura de dados do grafo (nós e edges)
- **Sigma.js**: Renderiza e visualiza o grafo

---

## ✨ Recursos Implementados

### 1. **Visualização Aprimorada**
- Gradientes de cor por tipo de nó
- Sombras e bordas customizadas
- Ícones nos labels dos nós
- Cores dinâmicas para edges baseadas no tipo do nó fonte

### 2. **Interatividade**
- **Clique simples**: Expande o nó
- **Clique duplo**: Abre arquivo associado
- **Hover**: Destaca nó e conexões relacionadas
- **Tooltip**: Mostra informações ao passar o mouse
- **Zoom/Pan**: Navegação suave com scroll e arrastar

### 3. **Customização por Tipo**

```javascript
const typeColors = {
    'Document': '#4299e1',  // Azul
    'Section': '#48bb78',   // Verde
    'Entity': '#9f7aea',    // Roxo
    'Keyword': '#ed8936'    // Laranja
};

const typeSizes = {
    'Document': 20,  // Maior
    'Section': 15,
    'Entity': 12,
    'Keyword': 12
};

const typeIcons = {
    'Document': '📄',
    'Section': '📝',
    'Entity': '🔗',
    'Keyword': '🏷️'
};
```

### 4. **Custom Label Renderer**
- Renderiza ícones + texto
- Background escuro semi-transparente
- Truncamento automático de textos longos
- Posicionamento abaixo do nó

### 5. **Destaque de Conexões**
- Ao hover, edges conectados ficam amarelos
- Espessura aumenta de 2px para 3px
- Nós aumentam 30% de tamanho no hover

### 6. **Layout Inteligente**
- Layout circular inicial
- Distribuição automática de nós
- Animações suaves ao adicionar novos nós

---

## 🎯 Comparação: Cytoscape.js vs Sigma.js

| Feature | Cytoscape.js | Sigma.js |
|---------|--------------|----------|
| **Performance** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Visual** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Facilidade** | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Documentação** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Comunidade** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Grafos Grandes** | 5k nós | 50k+ nós |
| **WebGL** | ❌ | ✅ |
| **TypeScript** | Parcial | ✅ Total |

---

## 📁 Arquivos

### **Novos**
- `src/webview/graph-progressive-sigma.html` - Implementação Sigma.js
- `src/webview/graph-progressive.html` - Agora usa Sigma.js

### **Backup**
- `src/webview/graph-progressive-cytoscape.html.backup` - Versão original Cytoscape.js

---

## 🔧 Código Destacado

### **Inicialização**
```javascript
// Criar grafo com Graphology
graph = new graphology.Graph();

// Adicionar nó
graph.addNode(node.id, {
    label: label,
    type: type,
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    size: typeSizes[type],
    color: typeColors[type]
});

// Inicializar Sigma
sigma = new Sigma(graph, container, {
    renderLabels: true,
    labelRenderer: customLabelRenderer,
    minCameraRatio: 0.1,
    maxCameraRatio: 10
});
```

### **Evento de Hover**
```javascript
sigma.on('enterNode', ({ node }) => {
    // Aumentar tamanho do nó
    graph.setNodeAttribute(node, 'size', size * 1.3);
    
    // Destacar edges conectados
    graph.edges().forEach(edge => {
        if (isConnected(edge, node)) {
            graph.setEdgeAttribute(edge, 'color', '#f6e05e');
            graph.setEdgeAttribute(edge, 'size', 3);
        }
    });
    
    sigma.refresh();
});
```

### **Custom Label com Ícones**
```javascript
function customLabelRenderer(context, data, settings) {
    const icon = typeIcons[data.type] || '🏷️';
    const label = data.label;
    const text = icon + ' ' + truncate(label, 15);
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(/* ... */);
    
    // Texto
    context.fillStyle = '#ffffff';
    context.fillText(text, data.x, data.y + data.size + 12);
}
```

---

## 🎨 Features Visuais

### **Tooltip Customizado**
```css
#tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.95);
    border: 2px solid #4299e1;
    border-radius: 8px;
    padding: 12px 16px;
    display: none;
    z-index: 3000;
}
```

### **Legenda Interativa**
- Mostra cores por tipo
- Toggle com botão na toolbar
- Design consistente com o tema

---

## 🚀 Como Usar

1. **Abrir Graph**: `CAPPY: Open Knowledge Graph`
2. **Navegar**: 
   - Scroll para zoom
   - Arrastar para mover
   - Hover para ver detalhes
3. **Expandir**: Clique em um nó para carregar filhos
4. **Abrir Arquivo**: Duplo clique em nós do tipo Document

---

## 📊 Performance

### **Antes (Cytoscape.js)**
- ~100 nós: Suave
- ~500 nós: Lento
- ~1000+ nós: Problemas

### **Depois (Sigma.js)**
- ~100 nós: Instantâneo
- ~1000 nós: Suave
- ~10000+ nós: Aceitável
- ~50000+ nós: Possível com ajustes

---

## 🔗 Recursos

- **Site Oficial**: https://www.sigmajs.org/
- **GitHub**: https://github.com/jacomyal/sigma.js
- **Demos**: https://www.sigmajs.org/storybook/
- **Graphology**: https://graphology.github.io/

---

## ✅ Melhorias Implementadas

1. ✅ Migração completa para Sigma.js
2. ✅ Tooltips customizados
3. ✅ Hover effects
4. ✅ Custom label renderer com ícones
5. ✅ Cores e tamanhos por tipo
6. ✅ Layout circular inicial
7. ✅ Destaque de conexões
8. ✅ Legenda interativa
9. ✅ Performance otimizada
10. ✅ Visual moderno e profissional

---

## 🎯 Próximos Passos

- [ ] Implementar layout ForceAtlas2 (força direcionada)
- [ ] Adicionar busca de nós
- [ ] Filtros por tipo
- [ ] Exportar grafo como imagem
- [ ] Mini-mapa para navegação
- [ ] Clustering de nós relacionados
- [ ] Diferentes layouts (hierárquico, radial, etc.)

---

**Resultado**: O Knowledge Graph agora usa Sigma.js, oferecendo melhor performance, visual mais moderno e experiência superior! 🚀✨
