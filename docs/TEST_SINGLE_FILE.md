# 🧪 Teste do Pipeline AST → Vector → Graph

## Arquivo de teste criado

✅ **test-sample-simple.ts** - Arquivo TypeScript com:
- 2 funções simples (add, multiply)
- 1 interface (User)
- 1 função que usa a interface (createUser)
- 1 classe (Calculator) com métodos que chamam as funções
- 1 type alias (Config)
- 1 constante (defaultConfig)

## Como executar o teste

### Passo 1: Recarregar o VS Code
1. Pressione **Ctrl+Shift+P** (ou Cmd+Shift+P no Mac)
2. Digite: `Developer: Reload Window`
3. Pressione Enter

### Passo 2: Abrir o Console de Debug
1. Pressione **Ctrl+Shift+U** para abrir o Output
2. Selecione **Debug Console** na barra superior
   - Ou vá em: View → Debug Console

### Passo 3: Executar o comando
1. Pressione **Ctrl+Shift+P**
2. Digite: `Cappy: Process Single File (Test)`
3. Pressione Enter
4. Selecione o arquivo: **test-sample-simple.ts**

## O que vai acontecer

O comando vai executar todo o pipeline e mostrar no console:

### 1️⃣ Parsing (AST)
```
🔍 PROCESSING FILE: test-sample-simple.ts
📦 CHUNKS EXTRACTED: X

Chunk 1/X:
  ID: ...
  Type: jsdoc
  Symbol: add
  Lines: 8-14
  Content Preview: Calculates the sum of two numbers...
```

### 2️⃣ Extração de Relacionamentos
```
🕸️ EXTRACTING RELATIONSHIPS
📊 RELATIONSHIPS FOUND: X

Relationship 1/X:
  Type: REFERENCES
  From: Calculator.add
  To: add (function)
  Properties: { referenceType: 'function_call', symbolName: 'add' }
```

### 3️⃣ Indexação no Vector Store (SQLite)
```
🤖 INDEXING IN VECTOR STORE (SQLite with sqlite-vec)
🤖 Generating embeddings for X chunks...
✅ Indexed test-sample-simple.ts successfully
```

### 4️⃣ Criação no Graph Store (SQLite)
```
📊 CREATING GRAPH RELATIONSHIPS (SQLite)
✅ Created X relationships in graph tables
```

### 5️⃣ Verificação
```
✅ VERIFICATION
🔍 Testing search with query: "add"

📊 Search Results:
   - Direct matches: X (busca semântica via sqlite-vec)
   - Related chunks: X (travessia de grafo via SQL JOINs)
   
   Top match:
     - Symbol: add
     - Type: jsdoc
     - File: test-sample-simple.ts
```

## Estrutura de dados esperada

### Chunks (SQLite com sqlite-vec)
- **JSDoc chunks**: Documentação extraída de cada símbolo
- **Code chunks**: Código de cada função/classe (se habilitado)
- **Vectors**: Embeddings de 384 dimensões armazenados com sqlite-vec (Xenova/all-MiniLM-L6-v2)

### Nodes (SQLite - Tabelas `graph_nodes` e `graph_edges`)
- **File node**: test-sample-simple.ts na tabela `graph_nodes`
- **Chunk nodes**: Um para cada chunk extraído na tabela `graph_nodes`
- **Relationships** na tabela `graph_edges`:
  - `CONTAINS`: File → Chunks
  - `DOCUMENTS`: JSDoc → Code
  - `REFERENCES`: Code → Code (chamadas de função)

## Relacionamentos esperados

1. **Calculator.add** → **add** (REFERENCES)
   - Classe Calculator usa função add
   
2. **Calculator.multiply** → **multiply** (REFERENCES)
   - Classe Calculator usa função multiply
   
3. **createUser** retorna **User** (TYPE_REFERENCE)
   - Função usa interface User

## Verificação manual

Após o processamento, você pode verificar os dados:

### SQLite Database
```
.cappy/data/cappy.db
```

Você pode inspecionar as tabelas:
- `document_chunks` - Chunks com embeddings (sqlite-vec)
- `graph_nodes` - Nós do grafo
- `graph_edges` - Relacionamentos
- `file_metadata` - Metadados dos arquivos

## Próximos passos após o teste

Se tudo funcionar:
1. ✅ AST Parser funcionando
2. ✅ Extração de relacionamentos funcionando
3. ✅ Vector Store (SQLite + sqlite-vec) funcionando
4. ✅ Graph Store (SQLite tabelas relacionais) funcionando
5. ✅ Hybrid Search funcionando

Você pode então:
- Processar arquivos mais complexos
- Executar scan completo do workspace
- Testar queries de busca híbrida
- Visualizar o grafo no Cappy Graph
