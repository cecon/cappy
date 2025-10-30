# Database Diagnostic Report
## Análise Completa do Banco de Dados Cappy

**Data:** 29 de outubro de 2025  
**Banco:** `.cappy/data/graph-store.db`  
**Status Geral:** ⚠️ **PARCIALMENTE SAUDÁVEL** (com warnings)

---

## 📊 Resumo Executivo

O banco de dados está funcional, mas existem alguns problemas de consistência e otimização que impactam o retrieval:

### Pontos Positivos ✅
- ✅ 5,401 chunk nodes com conteúdo (principal recurso para retrieval)
- ✅ 4,562 vetores com conteúdo completo (100% coverage)
- ✅ 14,822 edges conectando nodes (grafo rico em relacionamentos)
- ✅ Extensão sqlite-vec funcionando corretamente
- ✅ Queries de teste funcionando (retrieval operacional)

### Problemas Identificados ⚠️
- ⚠️ 313 edges órfãs (referenciando nodes inexistentes)
- ⚠️ 839 chunk nodes SEM entradas na tabela vectors (15.5% dos chunks)
- ⚠️ 1,837 entity nodes (filtrados no retrieval, mas ocupam espaço)
- ⚠️ 501 file nodes (filtrados no retrieval, mas ocupam espaço)

---

## 🔍 Análise Detalhada

### 1. Schema do Banco

**Tabelas Encontradas:**
```
- nodes (7,740 registros)
- edges (14,822 registros)
- vectors (4,562 registros)
- vec_vectors (sqlite-vec extension)
- vec_vectors_chunks
- vec_vectors_info
- vec_vectors_rowids
- vec_vectors_vector_chunks00
- sqlite_sequence
```

**Status:** ✅ Todas as tabelas essenciais presentes

---

### 2. Análise de Nodes

#### Distribuição por Tipo

| Tipo | Quantidade | % do Total | Status |
|------|-----------|-----------|--------|
| **chunk** | 5,401 | 69.8% | ✅ Conteúdo principal |
| entity | 1,837 | 23.7% | ⚠️ Filtrado no retrieval |
| file | 501 | 6.5% | ⚠️ Filtrado no retrieval |
| workspace | 1 | 0.01% | ✅ Metadata |
| **TOTAL** | **7,740** | 100% | |

#### Problema: Entity e File Nodes

**Issue:** 2,338 nodes (30.2%) são filtrados durante o retrieval mas ainda ocupam espaço no banco.

**Impacto:**
- Aumentam o tamanho do banco desnecessariamente
- Queries precisam filtrar esses nodes durante busca
- Performance de queries é afetada

**Solução Recomendada:**
- Manter nodes para estrutura do grafo
- Já implementado: filtro no `hybrid-retriever.ts` (linhas 526-535)
- Considerar: índice específico para `type='chunk'` se houver lentidão

```typescript
// Filtros já implementados:
const isEntityNode = node.id.startsWith('entity:');
if (isEntityNode) continue;

const isFileNode = node.type === 'file' && !node.metadata?.chunk_type;
if (isFileNode) continue;
```

---

### 3. Análise de Edges

**Total:** 14,822 edges  
**Status:** ⚠️ 313 edges órfãs (2.1%)

#### Top 10 Tipos de Relacionamento

| Tipo | Quantidade |
|------|-----------|
| CONTAINS | 5,109 |
| references | 4,894 |
| REFERENCES | 1,522 |
| uses | 725 |
| IMPORTS | 628 |
| IMPORTS_SYMBOL | 403 |
| IMPORTS_PKG | 313 |
| depends on | 141 |
| implements | 66 |
| calls | 58 |

#### Problema: 313 Edges Órfãs

**Issue:** 313 edges (2.1%) referenciam nodes que não existem mais.

**Causa Provável:**
- Nodes foram deletados mas edges não foram limpas
- Race condition durante updates incrementais
- Processo de scan interrompido

**Impacto:**
- Queries podem retornar resultados incompletos
- Performance ligeiramente degradada
- Inconsistência no grafo

**Solução Recomendada:**
```sql
-- Query para limpar edges órfãs
DELETE FROM edges 
WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = edges.from_id)
   OR NOT EXISTS (SELECT 1 FROM nodes WHERE id = edges.to_id);
```

---

### 4. Análise de Vectors

**Total:** 4,562 entradas  
**Status:** ⚠️ 839 chunks sem vectors (15.5%)

#### Métricas

- ✅ 4,562/4,562 vectors com conteúdo (100%)
- ✅ Embeddings armazenados em `vec_vectors` (sqlite-vec)
- ⚠️ 839 chunk nodes sem entrada em vectors

#### Problema: 839 Chunks sem Vectors

**Issue:** 839 chunk nodes (15.5% do total de 5,401 chunks) NÃO têm entrada na tabela vectors.

**Causa Provável:**
- Chunks criados mas embeddings não foram gerados
- Processo de embedding falhou/foi interrompido
- Tipos de arquivo não suportados pelo embedding

**Impacto:** 🔴 **CRÍTICO**
- Esses 839 chunks NÃO aparecerão nos resultados de retrieval
- Retrieval está operando com apenas 84.5% do conteúdo disponível
- Queries podem perder informação relevante

**Solução Recomendada:**
1. Identificar quais chunks não têm vectors:
```sql
SELECT n.id, n.label, n.metadata 
FROM nodes n
WHERE n.type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
  AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id)
LIMIT 10;
```

2. Re-processar esses chunks:
- Rodar scan incremental focado nesses arquivos
- Ou executar "Cappy: Reanalyze All Relationships"

---

### 5. Testes de Query

#### Query de Teste: "authentication user login"

**Resultado:** ✅ 5 matches encontrados

**Sample Match:**
```typescript
// chunk:GRAPH_MODULE_README.md:2:57-90
const graphService = createGraphService({ repository });
```

**Status:** Query retrieval está funcional para os chunks que têm vectors.

---

## 🎯 Problemas Priorizados

### 🔴 CRÍTICO - Resolver Imediatamente

#### 1. 839 Chunks Sem Vectors (15.5% do conteúdo)
**Impacto:** Retrieval incompleto  
**Ação:**
1. Executar comando: "Cappy: Scan Workspace" para reprocessar
2. Ou rodar script de re-embedding para chunks faltantes

### ⚠️ IMPORTANTE - Resolver em Breve

#### 2. 313 Edges Órfãs (2.1%)
**Impacto:** Performance e consistência  
**Ação:**
1. Criar script de limpeza de edges órfãs
2. Executar como parte de maintenance

#### 3. Considerar Otimização de Índices
**Impacto:** Performance de queries  
**Ação:**
1. Adicionar índice em `nodes.type` se queries estiverem lentas
2. Monitorar tempo de resposta

### ℹ️ OBSERVAÇÃO - Informativo

#### 4. Entity e File Nodes (30.2% dos nodes)
**Impacto:** Espaço em disco  
**Ação:** Nenhuma ação necessária - filtros já implementados

---

## 📋 Checklist de Manutenção

### Rotina Diária
- [ ] Verificar se novos arquivos foram indexados
- [ ] Confirmar que retrieval está retornando resultados

### Rotina Semanal
- [ ] Rodar `diagnose-db-simple.ts` para verificar saúde
- [ ] Checar se chunks sem vectors aumentaram
- [ ] Validar consistência de edges

### Rotina Mensal
- [ ] Limpar edges órfãs
- [ ] Re-indexar chunks problemáticos
- [ ] Vacuum do banco para otimizar espaço

### Em Caso de Problemas
- [ ] Rodar "Cappy: Reset Graph Database" (último recurso)
- [ ] Re-executar "Cappy: Scan Workspace"
- [ ] Verificar logs de erro

---

## 🛠️ Scripts Úteis

### Verificar Chunks Sem Vectors
```sql
SELECT COUNT(*) as chunks_without_vectors
FROM nodes n
WHERE n.type IN ('chunk', 'code_chunk', 'doc_chunk', 'markdown_section', 'document_section')
  AND NOT EXISTS (SELECT 1 FROM vectors WHERE chunk_id = n.id);
```

### Limpar Edges Órfãs
```sql
DELETE FROM edges 
WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = edges.from_id)
   OR NOT EXISTS (SELECT 1 FROM nodes WHERE id = edges.to_id);
```

### Listar Chunk Nodes com Mais Conteúdo
```sql
SELECT n.id, n.label, LENGTH(v.content) as content_length
FROM nodes n
INNER JOIN vectors v ON v.chunk_id = n.id
WHERE n.type = 'chunk'
ORDER BY LENGTH(v.content) DESC
LIMIT 10;
```

### Estatísticas de Relacionamentos
```sql
SELECT type, COUNT(*) as count
FROM edges
GROUP BY type
ORDER BY count DESC
LIMIT 20;
```

---

## 📚 Conclusões e Recomendações

### Conclusões

1. **Banco está funcional** mas com 15.5% de conteúdo não indexado para retrieval
2. **Filtros implementados** corretamente estão prevenindo que file/entity nodes contaminem retrieval
3. **Estrutura do grafo** está saudável com 14,822 relacionamentos
4. **Query retrieval** está operacional para conteúdo indexado

### Recomendações de Ação

#### Curto Prazo (Esta Semana)
1. ✅ **Implementar filtros de file nodes** (CONCLUÍDO no hybrid-retriever.ts)
2. 🔄 **Re-processar 839 chunks** sem vectors
3. 🔄 **Limpar 313 edges** órfãs

#### Médio Prazo (Este Mês)
1. Adicionar monitoramento automático de consistência
2. Criar job de manutenção periódica
3. Implementar métricas de qualidade do retrieval

#### Longo Prazo
1. Otimizar índices baseado em padrões de uso real
2. Considerar estratégias de particionamento para workspaces grandes
3. Implementar cache de queries frequentes

---

## 🔧 Como Usar o Script de Diagnóstico

```bash
# Executar diagnóstico
npx tsx scripts/diagnose-db-simple.ts

# Ver apenas problemas
npx tsx scripts/diagnose-db-simple.ts 2>&1 | grep -E "(ERROR|WARNING)"

# Salvar relatório
npx tsx scripts/diagnose-db-simple.ts > database-report.txt 2>&1
```

---

**Última atualização:** 29 de outubro de 2025  
**Autor:** Cappy Diagnostics System  
**Versão:** 1.0
