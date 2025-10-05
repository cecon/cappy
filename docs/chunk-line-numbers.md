# 📍 Adição de Número de Linhas aos Chunks

## Data: 05/10/2025

## Resumo

Adicionamos informações de **número de linha inicial e final** (`startLine` e `endLine`) a cada chunk processado no CAPPY. Isso facilita enormemente a navegação e referência aos chunks, permitindo saber exatamente onde cada chunk está localizado no arquivo original.

---

## ✨ Mudanças Implementadas

### 1. **Schema do LanceDB Atualizado**

Adicionados dois novos campos opcionais à tabela `chunks`:

```typescript
export interface CappyRAGChunk {
    id: string;
    documentId: string;
    content: string;
    startPosition: number;      // Posição do caractere inicial
    endPosition: number;        // Posição do caractere final
    startLine?: number;         // 🆕 Linha inicial (1-indexed)
    endLine?: number;           // 🆕 Linha final (1-indexed)
    chunkIndex: number;
    entities: string[];
    relationships: string[];
    created: string;
    vector?: number[];
}
```

### 2. **Schema Arrow do LanceDB**

```typescript
const schema = new arrow.Schema([
    // ... campos existentes
    new arrow.Field('startLine', new arrow.Float64(), true),   // 🆕 Opcional
    new arrow.Field('endLine', new arrow.Float64(), true),     // 🆕 Opcional
    // ... outros campos
]);
```

### 3. **Nova Interface ChunkWithPosition**

Criada interface para representar chunks com posições completas:

```typescript
export interface ChunkWithPosition {
    content: string;
    startPosition: number;
    endPosition: number;
    startLine: number;      // 🆕
    endLine: number;        // 🆕
    index: number;
}
```

### 4. **Método chunkDocument Melhorado**

Atualizado para calcular automaticamente o número de linhas:

```typescript
private chunkDocument(content: string, chunkSize: number): ChunkWithPosition[] {
    const chunks: ChunkWithPosition[] = [];
    
    for (let i = 0; i < content.length; i += chunkSize) {
        const startPos = i;
        const endPos = Math.min(i + chunkSize, content.length);
        const chunkContent = content.substring(startPos, endPos);
        
        // 🆕 Calcular número de linhas
        const textBeforeChunk = content.substring(0, startPos);
        const startLine = textBeforeChunk.split('\n').length;
        const linesInChunk = chunkContent.split('\n').length;
        const endLine = startLine + linesInChunk - 1;
        
        chunks.push({
            content: chunkContent,
            startPosition: startPos,
            endPosition: endPos,
            startLine: startLine,      // 🆕
            endLine: endLine,          // 🆕
            index: Math.floor(i / chunkSize)
        });
    }
    
    return chunks;
}
```

### 5. **Processamento de Chunks Atualizado**

O processamento agora registra e salva as informações de linha:

```typescript
// Durante o processamento
console.log(`[Processor] Analyzing chunk ${i + 1}/${chunks.length} (lines ${chunk.startLine}-${chunk.endLine})`);

// Ao salvar no banco
await db.addChunk({
    documentId: doc.documentId,
    content: chunk.content,
    startPosition: chunk.startPosition,
    endPosition: chunk.endPosition,
    startLine: chunk.startLine,      // 🆕
    endLine: chunk.endLine,          // 🆕
    chunkIndex: chunk.index,
    entities: Array.from(allEntities.values()),
    relationships: allRelationships
});
```

### 6. **Visualização no MCP Server**

Os resultados de busca agora mostram as linhas:

```typescript
const lineInfo = chunk.startLine && chunk.endLine 
    ? ` (Lines ${chunk.startLine}-${chunk.endLine})` 
    : '';
response += `${i + 1}. **Document:** ${chunk.documentId}${lineInfo}\n`;
```

---

## 🎯 Benefícios

1. **Navegação Precisa**: Saber exatamente onde cada chunk está no arquivo
2. **Debugging Facilitado**: Identificar rapidamente chunks problemáticos
3. **Melhor Rastreabilidade**: Logs mostram linhas sendo processadas
4. **Context Awareness**: Ao buscar chunks, saber o contexto exato
5. **Integração com Editor**: Pode-se futuramente criar links diretos para as linhas
6. **Auditoria**: Histórico completo de onde veio cada informação

---

## 📊 Exemplo de Uso

### Antes:
```
Analyzing chunk 5/10
Document: README.md
Position: 5000-6000
```

### Depois:
```
Analyzing chunk 5/10 (lines 125-150)
Document: README.md (Lines 125-150)
Position: 5000-6000
```

---

## 🔄 Compatibilidade

- ✅ **Retrocompatível**: Campos são opcionais (`?`)
- ✅ **Chunks antigos**: Continuam funcionando sem `startLine/endLine`
- ✅ **Novos chunks**: Automaticamente incluem informações de linha
- ✅ **Migração**: Não é necessária (campos opcionais)

---

## 📝 Arquivos Modificados

1. **`src/store/cappyragLanceDb.ts`**
   - Adicionados campos `startLine?` e `endLine?` à interface `CappyRAGChunk`
   - Atualizado schema Arrow para incluir os novos campos

2. **`src/services/backgroundProcessor.ts`**
   - Criada interface `ChunkWithPosition`
   - Modificado método `chunkDocument()` para calcular linhas
   - Atualizado processamento para usar nova estrutura
   - Logs agora mostram informações de linha

3. **`src/tools/mcpServer.ts`**
   - Atualizada visualização de resultados para mostrar linhas

---

## 🚀 Próximos Passos Possíveis

- [ ] Adicionar comando "Go to Line" para navegar direto ao chunk
- [ ] Mostrar linhas no dashboard visual
- [ ] Usar linhas para criar links clicáveis
- [ ] Estatísticas por faixa de linhas
- [ ] Destacar linhas no editor ao visualizar chunk

---

## 🔍 Como Testar

1. Recarregue a extensão
2. Adicione um novo documento via "CappyRAG: Add Document"
3. Verifique os logs - verá "lines X-Y"
4. Use o MCP Server para buscar - verá "(Lines X-Y)" nos resultados
5. Chunks novos terão informações de linha automaticamente

---

**Resultado**: Agora cada chunk sabe exatamente em quais linhas do arquivo original ele está! 📍✨
