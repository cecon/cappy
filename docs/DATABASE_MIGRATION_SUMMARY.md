# 🔄 Migração de Banco de Dados: LanceDB/Kuzu → SQLite

## 📋 Resumo da Atualização

**Data:** 17 de outubro de 2025  
**Status:** ✅ Documentação atualizada

---

## 🎯 Mudança Principal

O CAPPY Framework migrou de **LanceDB** e **Kuzu** para **SQLite** com extensões especializadas:

- **SQLite** como banco de dados principal
- **sqlite-vec** para embeddings e busca vetorial
- **Tabelas relacionais** para estrutura de grafo

---

## 🗄️ Nova Arquitetura de Dados

### Vector Storage
**Antes:** LanceDB (vector database separado)  
**Agora:** SQLite + sqlite-vec extension

### Graph Storage
**Antes:** Kuzu (graph database separado)  
**Agora:** SQLite com tabelas relacionais (nodes, edges, relations)

---

## 📚 Arquivos de Documentação Atualizados

### Arquitetura
- ✅ `docs/architecture/hexagonal-graph-design.md`
  - Secondary adapters agora usam SQLite
  - Fluxo de dados atualizado
  - Checklist de implementação revisado
  - Tecnologias e roadmap atualizados

### Implementação de Grafo
- ✅ `docs/graph-implementation-progress.md`
  - SQLiteGraphRepository no lugar de LanceDBGraphRepository
  - Estrutura de arquivos atualizada
  - Exemplos de uso com SQLite
  - Testes atualizados

- ✅ `docs/graph-migration-progress.md`
  - Use cases atualizados para SQLite
  - Adapters revisados
  - Próximos passos ajustados

- ✅ `docs/GRAPH_MODULE_README.md`
  - Quick Start com SQLite
  - Estrutura de arquivos atualizada
  - Exemplos de código revisados

### Gerenciamento de Arquivos
- ✅ `docs/FILE_CHANGE_MANAGEMENT.md`
  - Schema completo migrado para SQLite
  - Tabelas com sqlite-vec para embeddings
  - Comparação atualizada
  - Referências à sqlite-vec adicionadas

### Extração de Código
- ✅ `docs/CODE_SIGNATURE_EXTRACTION.md`
  - Comentários sobre armazenamento atualizados
  - Tabela de comparação revisada
  - Conclusão menciona SQLite + sqlite-vec

### Chat e Ferramentas
- ✅ `docs/architecture/adapters/CHAT_TOOLS_SPEC.md`
  - IntelligentRetrieverTool usa SQLite + sqlite-vec
  
- ✅ `docs/architecture/adapters/SPEC.md`
  - Adapter secundário com SQLite

### Análises
- ✅ `docs/LIGHTRAG_ANALYSIS.md`
  - Tabela de comparação atualizada
  - Vector Storage e Graph Storage com SQLite

- ✅ `docs/METADATA_STORAGE_DECISION.md`
  - Título atualizado para SQLite
  - Exemplos de queries SQL nativas
  - Analytics com SQLite
  - Transações SQLite

---

## 🔑 Benefícios da Nova Abordagem

### 1. Simplicidade
- **Um único banco de dados** para tudo
- Menos dependências externas
- Mais fácil de distribuir e instalar

### 2. Performance
- **SQLite é extremamente rápido** para leitura
- Suporte nativo a índices e queries complexas
- sqlite-vec otimizado para busca vetorial

### 3. Portabilidade
- **Arquivo único** (`.sqlite`)
- Funciona em qualquer plataforma
- Zero configuração de servidor

### 4. Maturidade
- **SQLite é amplamente testado** e estável
- Documentação extensa
- Comunidade ativa

### 5. Integração
- **Queries SQL nativas** (mais familiar)
- JOINs eficientes entre tabelas
- Transações ACID completas

---

## 📊 Estrutura de Dados no SQLite

### Tabelas Principais

#### 1. **document_chunks** (com sqlite-vec)
```sql
CREATE VIRTUAL TABLE document_chunks USING vec0(
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  line_end INTEGER NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_preview TEXT,
  embedding FLOAT[384],  -- sqlite-vec
  file_type TEXT,
  language TEXT,
  metadata_json TEXT,
  indexed_at TEXT,
  file_modified_at TEXT,
  status TEXT,
  entities TEXT
);
```

#### 2. **graph_nodes**
```sql
CREATE TABLE graph_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  metadata_json TEXT
);
```

#### 3. **graph_edges**
```sql
CREATE TABLE graph_edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  FOREIGN KEY (source_id) REFERENCES graph_nodes(id),
  FOREIGN KEY (target_id) REFERENCES graph_nodes(id)
);
```

#### 4. **file_metadata**
```sql
CREATE TABLE file_metadata (
  file_path TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  structure_hash TEXT,
  indexing_mode TEXT NOT NULL,
  total_tokens INTEGER,
  total_chunks INTEGER,
  total_entities INTEGER,
  total_relations INTEGER,
  embedding_tokens INTEGER,
  embedding_cost_usd REAL,
  line_count INTEGER,
  byte_size INTEGER,
  indexed_at TEXT,
  last_modified TEXT,
  status TEXT,
  error_message TEXT
);
```

---

## 🔧 Extensões SQLite Utilizadas

### sqlite-vec
- **Propósito:** Busca vetorial eficiente
- **Features:**
  - Suporte a vetores de alta dimensionalidade
  - Busca por similaridade (cosine, euclidean, dot product)
  - Índices otimizados para performance
  - Integração nativa com SQLite

- **GitHub:** https://github.com/asg017/sqlite-vec
- **Instalação:** Via npm ou download direto

---

## 🚀 Próximos Passos

### Implementação (Code)
1. ⏳ Criar `SQLiteAdapter` em `src/adapters/secondary/database/`
2. ⏳ Implementar `SQLiteGraphRepository` em `src/adapters/secondary/graph/`
3. ⏳ Migrar serviços existentes para usar SQLite
4. ⏳ Adicionar sqlite-vec para busca vetorial
5. ⏳ Testes de integração completos

### Migração de Dados (se necessário)
1. ⏳ Script de export de LanceDB/Kuzu
2. ⏳ Script de import para SQLite
3. ⏳ Validação de integridade
4. ⏳ Backup automático

---

## 📖 Referências

- **SQLite:** https://www.sqlite.org/
- **sqlite-vec:** https://github.com/asg017/sqlite-vec
- **SQLite JSON1:** https://www.sqlite.org/json1.html (para metadata_json)
- **SQLite FTS5:** https://www.sqlite.org/fts5.html (full-text search)

---

## ✅ Checklist de Conclusão

- [x] Documentação de arquitetura atualizada
- [x] Documentação de implementação atualizada
- [x] Exemplos de código revisados
- [x] Tabelas de comparação atualizadas
- [x] Referências técnicas adicionadas
- [ ] Código implementado
- [ ] Testes criados
- [ ] Migração de dados (se aplicável)
- [ ] Documentação do usuário final

---

**Nota:** Esta atualização mantém a compatibilidade conceitual com a arquitetura existente, apenas mudando a camada de infraestrutura (adapters). O domain layer e use cases permanecem inalterados, demonstrando o poder da Clean Architecture! 🎯
