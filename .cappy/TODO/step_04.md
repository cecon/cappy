# Hashing e Identidades

> Data: 2025-10-03

## Objetivo
Garantir atualização incremental robusta.

### Regras
- **Arquivo**: `fileHash = blake3(conteúdo normalizado)`
- **Chunk**: `textHash = blake3(texto_do_chunk_normalizado)`
- **ID do Chunk**: `blake3(path + startLine + endLine + textHash)`
- **Simbolos**: `symbolId = fullyQualifiedName`; `contentHash = blake3(assinatura + doc + params + returns + examples)`

### Renomeio de arquivo
- `fileHash` não muda → atualize apenas `path` no metadado.

### Tombstones & GC
- Ao remover chunk/símbolo/doc, marque `status=deleted` e rode GC periódico (configurável).

## Tarefas
- Especificar normalização (LF vs CRLF, unicode, trim).
- Definir política de GC (ex.: 7–30 dias).

## Critérios de aceite
- Documentação de hashing e GC no SPEC.
