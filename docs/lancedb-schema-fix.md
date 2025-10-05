# LanceDB Schema Fix - Arrays Vazios

## Problema

Ao tentar criar tabelas LanceDB com dados vazios `[]`, o erro ocorria:

```
Error: Failed to infer data type for field tags at row 0.
Consider providing an explicit schema.
```

## Causa

LanceDB não consegue inferir o tipo de campos como:
- `tags: []` (array de strings vazio)
- `documentIds: []` (array de strings vazio)
- `entities: []` (array de strings vazio)
- `relationships: []` (array de strings vazio)

## Solução

Usar **Apache Arrow Schema explícito** ao criar tabelas vazias:

```typescript
import * as arrow from 'apache-arrow';

// Definir schema explícito
const schema = new arrow.Schema([
    new arrow.Field('id', new arrow.Utf8(), false),
    new arrow.Field('title', new arrow.Utf8(), false),
    new arrow.Field('tags', new arrow.List(new arrow.Field('item', new arrow.Utf8())), false),
    // ... outros campos
]);

// Criar tabela vazia com schema
const emptyData: LightRAGDocument[] = [];
this.documentsTable = await this.connection.createTable('documents', emptyData, { schema });
```

## Tipos Arrow Usados

| Campo TypeScript | Tipo Arrow | Exemplo |
|------------------|-----------|---------|
| `string` | `new arrow.Utf8()` | `id: string` |
| `number` | `new arrow.Float64()` | `fileSize: number` |
| `string[]` | `new arrow.List(new arrow.Field('item', new arrow.Utf8()))` | `tags: string[]` |

## Tabelas Corrigidas

1. **Documents Table**
   - `tags: string[]` → Schema explícito
   
2. **Entities Table**
   - `documentIds: string[]` → Schema explícito
   
3. **Relationships Table**
   - `documentIds: string[]` → Schema explícito
   
4. **Chunks Table**
   - `entities: string[]` → Schema explícito
   - `relationships: string[]` → Schema explícito

## Arquivos Modificados

- `src/store/lightragLanceDb.ts`:
  - Adicionado import `apache-arrow`
  - Método `initializeDocumentsTable()` → Schema explícito
  - Método `initializeEntitiesTable()` → Schema explícito
  - Método `initializeRelationshipsTable()` → Schema explícito
  - Método `initializeChunksTable()` → Schema explícito

## Dependências

- `apache-arrow`: Já incluído como peer dependency de `@lancedb/lancedb@^0.22.1`
- Não é necessário adicionar ao `package.json` (evita conflitos de versão)

## Versão

Corrigido na versão **2.9.26**

## Testes

1. Abrir dashboard: `Ctrl+Shift+P` → "Cappy: Open LightRAG Dashboard"
2. Verificar que não há erro ao inicializar
3. Upload de documento deve funcionar normalmente
4. Database criado em `.cappy/lightrag-lancedb/`

## Referências

- [LanceDB Schema Documentation](https://lancedb.github.io/lancedb/javascript/interfaces/CreateTableOptions/)
- [Apache Arrow TypeScript API](https://arrow.apache.org/docs/js/)
