# Indexação Incremental (Prepare/Commit)

> Data: 2025-10-03

## Objetivo
Atualizar somente o que mudou sem inconsistências.

### Fases
1. **Detectar mudanças**: watcher/varredura compara `fileHash` antigo vs novo.
2. **Re-chunk** e comparar conjunto de `textHash` por arquivo/símbolo.
3. **Prepare**:
   - Upsert de **novos**/alterados chunks em LanceDB (em área staging lógica).
   - Recalcular arestas do grafo **apenas** para itens alterados.
4. **Commit**:
   - Ativar versão do documento (rótulo/flag) e tombstonar os removidos.
5. **GC** periódico dos tombstones.

## Tarefas
- Especificar política de staging/commit (sinalização por `docVersion`).

## Critérios de aceite
- SPEC com diagrama de estados (novo/alterado/removido/renomeado).
