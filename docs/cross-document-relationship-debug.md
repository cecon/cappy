# 🔗 Cross-Document Relationship Debugging

## 📋 Problema Reportado

As entidades do arquivo 1 não estão sendo relacionadas com entidades de outros arquivos quando novos documentos são adicionados ao CappyRAG.

## 🔍 Análise do Código

### ✅ O que JÁ estava implementado:

1. **Busca de entidades de outros documentos** (`relationshipExtractionService.ts:224-248`)
   ```typescript
   private async getEntitiesFromOtherDocuments(currentDocumentId: string): Promise<Entity[]>
   ```
   - Filtra entidades que NÃO são do documento atual
   - Retorna todas as entidades de documentos diferentes

2. **Inclusão no prompt da LLM** (linhas 68-75)
   - Lista até 10 entidades de outros documentos
   - Instrui a LLM a criar relacionamentos cross-document

3. **Busca cruzada durante parsing** (linhas 123-138)
   - Se entidade não encontrada no chunk atual, busca em outros documentos
   - Permite criar relacionamentos entre documentos

## 🐛 Possíveis Causas do Problema

### 1. **Falta de logs visíveis**
- O log original estava em apenas um lugar (linha 224)
- Não mostrava quais entidades estavam disponíveis
- Não indicava quando relacionamentos cross-doc eram criados

### 2. **Prompt da LLM pouco enfático**
- Não destacava a importância dos relacionamentos cross-doc
- Não tinha exemplos claros
- Podia ser ignorado pela LLM

### 3. **Nomes de entidades não correspondentes**
- LLM pode extrair "Microsoft Corp" em um doc e "Microsoft" em outro
- Sem similaridade fuzzy, não criaria o link

## ✅ Melhorias Implementadas

### 1. **Logs Detalhados Adicionados**

```typescript
// Linha 60-67: Log ao processar chunk
console.log(`\n🔍 [CappyRAG Cross-Doc] Processing chunk from document: ${chunk.documentId}`);
console.log(`   - Current chunk entities: ${entities.length}`);
console.log(`   - Entities from other docs: ${existingEntitiesInOtherDocs.length}`);
```

```typescript
// Linha 138-145: Log quando relacionamento cross-doc é criado
if (isCrossDocument) {
    console.log(`✅ Cross-document relationship found: ${sourceEntity.name} -> ${targetEntity.name} (${relData.type})`);
}
```

```typescript
// Linha 132-136: Log quando entidade não é encontrada
console.warn(`❌ Relationship skipped: Entity not found - ${relData.source} -> ${relData.target}`);
console.warn(`   Available current entities: ${entities.map(e => e.name).join(', ')}`);
```

### 2. **Prompt da LLM Melhorado**

**ANTES:**
```
CONTEXT - ENTITIES FROM OTHER DOCUMENTS:
${existingEntitiesInOtherDocs...}
```

**DEPOIS:**
```
CONTEXT - ENTITIES FROM OTHER DOCUMENTS (You MUST create relationships to these when relevant):
${existingEntitiesInOtherDocs.length > 0 
    ? existingEntitiesInOtherDocs.slice(0, 10).map(...)
    : '(No entities from other documents yet - this is the first document)'}

⚠️ IMPORTANT: Create relationships between entities in this chunk AND entities from other documents when they are related!
```

**TASK atualizada:**
```
2. **CRITICAL**: Find relationships to entities from other documents (cross-document links) - check if any entity in this chunk relates to entities listed in "ENTITIES FROM OTHER DOCUMENTS"

EXAMPLE CROSS-DOCUMENT RELATIONSHIP:
If this chunk mentions "TypeScript" and "ENTITIES FROM OTHER DOCUMENTS" contains "Microsoft", 
you should create: {"source": "TypeScript", "target": "Microsoft", "type": "developed_by", ...}
```

## 🧪 Como Testar

### Opção 1: Usar o script de teste automatizado

```bash
# No VS Code, abra o terminal e execute:
node test-cross-document-links.js
```

Este script:
1. Adiciona documento sobre "TypeScript" (menciona Microsoft)
2. Adiciona documento sobre "Angular" (menciona TypeScript e Microsoft)
3. Verifica se relacionamentos cross-doc foram criados
4. Mostra logs detalhados

### Opção 2: Teste manual no VS Code

1. **Limpe o banco de dados anterior:**
   ```
   Ctrl+Shift+P → "CappyRAG: Get Statistics"
   Anote quantos documentos existem
   ```

2. **Adicione o primeiro documento:**
   ```
   Ctrl+Shift+P → "CappyRAG: Add Document"
   ```
   
   Conteúdo:
   ```markdown
   # TypeScript Overview
   
   TypeScript is a programming language developed by Microsoft.
   It adds static typing to JavaScript.
   Visual Studio Code has excellent TypeScript support.
   ```

3. **Verifique os logs do Output:**
   ```
   Ctrl+Shift+P → "View: Toggle Output"
   Selecione "GitHub Copilot Language Server" ou "Extension Host"
   ```
   
   Procure por:
   ```
   🔍 [CappyRAG Cross-Doc] Processing chunk from document: doc_xxx
      - Current chunk entities: X
      - Entities from other docs: 0
   ```

4. **Adicione o segundo documento:**
   ```markdown
   # Angular Framework
   
   Angular is a web framework that uses TypeScript.
   Microsoft and Google collaborate on TypeScript tooling.
   Visual Studio Code is popular for Angular development.
   ```

5. **Verifique os logs novamente:**
   ```
   🔍 [CappyRAG Cross-Doc] Processing chunk from document: doc_yyy
      - Current chunk entities: X
      - Entities from other docs: Y  <-- Deve ser > 0!
      - Other doc entities: TypeScript (Technology), Microsoft (Organization), ...
   
   ✅ Cross-document relationship found: Angular -> TypeScript (uses)
   ✅ Cross-document relationship found: Angular -> Microsoft (developed_by)
   ```

6. **Visualize o grafo:**
   ```
   Ctrl+Shift+P → "CappyRAG: View Knowledge Graph"
   ```
   
   Você deve ver:
   - Nós de ambos documentos
   - Linhas conectando entidades entre documentos

## 🔍 O Que Procurar nos Logs

### ✅ Sucesso:
```
🔍 [CappyRAG Cross-Doc] Processing chunk from document: doc_abc123
   - Current chunk entities: 4
   - Entities from other docs: 3
   - Other doc entities: TypeScript (Technology), Microsoft (Organization), Visual Studio Code (Technology)

✅ Cross-document relationship found: Angular -> TypeScript (uses)
✅ Cross-document relationship found: Google -> Microsoft (collaborates_with)
```

### ❌ Problema:
```
🔍 [CappyRAG Cross-Doc] Processing chunk from document: doc_abc123
   - Current chunk entities: 4
   - Entities from other docs: 0  <-- PROBLEMA!
```

**Possíveis causas:**
- Banco de dados está vazio
- Primeiro documento não foi processado corretamente
- Tabela de entidades não foi criada

### ⚠️ Entidades não encontradas:
```
❌ Relationship skipped: Entity not found - TypeScript -> Microsoft
   Available current entities: Angular, Google, Framework
   Available other doc entities: 3 total
```

**Possível causa:**
- LLM usou nome diferente ("TypeScript Language" vs "TypeScript")
- Entidade não foi extraída corretamente no primeiro documento

## 🎯 Próximos Passos

1. **Recarregar VS Code:** `Ctrl+Shift+P` → "Reload Window"
2. **Executar teste:** `node test-cross-document-links.js`
3. **Verificar logs:** Output → Extension Host
4. **Reportar resultados:**
   - Se aparecer "Entities from other docs: 0" → problema no banco
   - Se aparecer "Entity not found" → problema de nomenclatura
   - Se aparecer "✅ Cross-document relationship found" → FUNCIONANDO!

## 📝 Arquivos Modificados

- `src/core/services/relationshipExtractionService.ts`
  - Linhas 60-67: Logs de debug adicionados
  - Linhas 68-75: Prompt melhorado
  - Linhas 84-93: Task e exemplo adicionados
  - Linhas 132-145: Logs de validação

- `test-cross-document-links.js` (novo)
  - Script automatizado de teste

## 🔧 Reversão Rápida

Se algo der errado:
```bash
git checkout src/core/services/relationshipExtractionService.ts
npm run compile
```
