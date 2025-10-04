# Chunking (Markdown, Código, JSDoc/TypeDoc)

> Data: 2025-10-03

## Objetivo
Definir como quebrar fontes em chunks com ranges de linhas.

### Markdown
- Chunk por *heading* (H1–H6) com `startLine/endLine` até o próximo heading de mesmo/menor nível.
- Overlap opcional (2–3 linhas).

### Código
- Chunk por **bloco lógico** (função/método/classe via AST). Pegue `loc.start/loc.end`.
- Inclua breve docstring/JSDoc acima (3–5 linhas).

### JSDoc/TypeDoc (preferir JSON)
- Um **chunk por símbolo**.
- Campos mínimos: assinatura, descrição, params, returns, examples, `@see`.
- Mapear para `symbolId` e `path/linha` do fonte.

## Tarefas
- Especificar as regras de chunk por tipo de fonte.
- Definir limites: máx. linhas por chunk; máx. tokens em texto.

## Critérios de aceite
- SPEC com regras de chunking e exemplos.
