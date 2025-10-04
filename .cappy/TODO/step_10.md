# Integração na Extensão VS Code (Comandos/Lifecycle)

> Data: 2025-10-03

## Objetivo
Encaixar o mini-LightRAG no seu projeto de extensão.

### Comandos mínimos
- `miniRAG.indexWorkspace`
- `miniRAG.search`
- `miniRAG.openGraph`
- (Opcional) `miniRAG.indexFile`, `miniRAG.pauseWatcher`

### Storage
- Usar `context.globalStorageUri.fsPath` para base LanceDB e cache de modelos.

### Configurações (settings)
- Modelo (fast/quality), topK, limites (GB, nós/arestas), globs de exclusão (`node_modules`, `.git`, `dist`, binários).

### Critérios de aceite
- Comandos registrados
- Configs documentadas
- Caminhos de storage definidos
