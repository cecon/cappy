# Store - Persistência LanceDB

## Propósito
Gerenciar armazenamento vetorial e de grafo usando LanceDB in-process no globalStorage da extensão.

## Responsabilidades

### Coleções LanceDB (Steps 6-7)
- **chunks**: Schema principal com vector(384), path, textHash, etc.
- **nodes**: Elementos do grafo (Document, Section, Keyword, Symbol)
- **edges**: Conexões do grafo com pesos e tipos
- **(Opcional) neighbors**: Top-N similares pré-computados

### Embeddings (Step 6)
- Integração com transformers.js
- Modelo: all-MiniLM-L6-v2 (384 dimensões)
- Normalização L2 dos vetores
- Cache e reutilização de embeddings

### Índices Vetoriais
- HNSW/IVF conforme suporte LanceDB
- Configuração otimizada para busca Top-K
- Parâmetros ajustáveis (M, efConstruction)

### GlobalStorage Integration
- Caminho: `context.globalStorageUri.fsPath + '/mini-lightrag'`
- Estrutura: chunks/, nodes/, edges/, indexes/
- Backup e recovery automático

## Arquivos Futuros
- `lancedbClient.ts` - Cliente principal LanceDB
- `embeddingService.ts` - Serviço de embeddings
- `vectorIndex.ts` - Configuração de índices
- `storageManager.ts` - Gestão do globalStorage
