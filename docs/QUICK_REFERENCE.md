# 🚀 Guia Rápido - Comandos do Mini-LightRAG

## Visualizar Grafo de Conhecimento

### 📊 Comando Principal
```
Ctrl+Shift+P → Mini-LightRAG: Open Graph
```

ou

```typescript
await vscode.commands.executeCommand('miniRAG.openGraph');
```

## Todos os Comandos Disponíveis

### 🔍 Busca e Pesquisa
| Comando | Atalho | Descrição |
|---------|--------|-----------|
| `miniRAG.search` | - | Busca híbrida (vetor + grafo) |
| `miniRAG.indexWorkspace` | - | Indexar workspace completo |

### 📊 Visualização
| Comando | Atalho | Descrição |
|---------|--------|-----------|
| `miniRAG.openGraph` | - | **Abrir visualização do grafo** |

### 📄 Indexação
| Comando | Atalho | Descrição |
|---------|--------|-----------|
| `cappy.reindex` | - | Reconstruir todos os índices |
| `miniRAG.indexFile` | - | Indexar arquivo atual |
| `miniRAG.pauseWatcher` | - | Pausar watcher de arquivos |

## Status Atual

### ✅ Funcional Agora
- ✅ Comando registrado e disponível
- ✅ Webview abre corretamente
- ✅ Interface placeholder visível

### ⏳ Em Desenvolvimento
- ⏳ Carregamento de dados do grafo
- ⏳ Visualização interativa com Cytoscape.js
- ⏳ Filtros e busca no grafo
- ⏳ Exportação de imagens

## Como Testar Agora

1. **Abra o Command Palette**: `Ctrl+Shift+P`
2. **Digite**: `Mini-LightRAG: Open Graph`
3. **Pressione Enter**
4. **Você verá**: Um painel com placeholder informativo

## O Que Esperar

### Versão Atual (Placeholder)
```
🌐 Mini-LightRAG Graph

Graph visualization will be implemented here
This will show the semantic relationships between code elements

Configuration:
Max Nodes: 10000
Max Edges: 50000
```

### Versão Futura (Completa)
```
🌐 Mini-LightRAG Graph
┌─────────────────────────────────────┐
│  [Filtros] [Busca] [Layout] [Export]│
├─────────────────────────────────────┤
│                                     │
│     📄──→📑──→🏷️                    │
│     │         ↓                     │
│     └────→📑──→⚙️──→📑             │
│                ↓                    │
│              🏷️──→📑──→📄          │
│                                     │
└─────────────────────────────────────┘
  Nós: 45 | Arestas: 123 | FPS: 60
```

## Documentação Completa

Para mais detalhes, veja:
- **Visualização do Grafo**: `docs/graph-visualization.md`
- **Arquitetura Mini-LightRAG**: `SPEC.md`
- **Resumo de Atualizações**: `docs/REINDEX_UPDATE_SUMMARY.md`

## Configurações Recomendadas

```json
{
  "miniRAG.maxNodes": 10000,
  "miniRAG.maxEdges": 50000
}
```

## Atalhos Úteis

### Criar Seu Próprio Atalho
Adicione ao `keybindings.json`:

```json
{
  "key": "ctrl+shift+g",
  "command": "miniRAG.openGraph",
  "when": "editorTextFocus"
}
```

## Troubleshooting

### Comando não aparece?
1. Verifique se a extensão está instalada
2. Recarregue o VS Code: `Developer: Reload Window`

### Nada acontece ao executar?
1. Abra o Developer Console: `Help > Toggle Developer Tools`
2. Verifique erros no Console
3. Reporte na issue do projeto

## Roadmap

- [ ] **Q4 2025**: Visualização básica com Cytoscape.js
- [ ] **Q1 2026**: Filtros e busca interativa
- [ ] **Q2 2026**: Exportação e compartilhamento
- [ ] **Q3 2026**: Machine Learning para sugestões

---

💡 **Dica**: Este comando faz parte do sistema Mini-LightRAG, uma arquitetura híbrida de busca semântica com grafo de conhecimento, totalmente local e privada!
