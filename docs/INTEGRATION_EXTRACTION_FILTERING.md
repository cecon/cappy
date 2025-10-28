# 🎯 Integração entity-extraction + entity-filtering

## ✅ Status: IMPLEMENTADO

**Data**: 25/10/2025  
**Branch**: graph2

---

## 📊 Resumo Executivo

### Objetivo
Integrar os sistemas `entity-extraction/` e `entity-filtering/` que estavam duplicando código, eliminando ~260 linhas de código duplicado e centralizando a lógica de extração AST.

### Resultados
- ✅ **-262 linhas** de código duplicado removidas
- ✅ **+182 linhas** de adapter criado
- ✅ **-80 linhas** saldo líquido
- ✅ **3 sistemas consolidados** (ASTRelationshipExtractor, DebugAnalyzeUseCase, futuro: WorkspaceScanner)

---

## 🏗️ Arquitetura Implementada

```
📄 Código TypeScript/JavaScript
        ↓
┌────────────────────────────────────┐
│   ASTEntityExtractor (extraction)  │
│   - 15 extractors especializados   │
│   - ImportExtractor                │
│   - ExportExtractor                │
│   - CallExpressionExtractor        │
│   - FunctionExtractor              │
│   - ClassExtractor, etc.           │
└────────────────────────────────────┘
        ↓
    ASTEntity[] (+ field 'kind')
        ↓
┌────────────────────────────────────┐
│   ASTEntityAdapter (conversion)    │
│   - toAnalysisFormat()             │
│   - fromAnalysisFormat()           │
│   - toRawEntities()                │
└────────────────────────────────────┘
        ↓
    RawEntity[]
        ↓
┌────────────────────────────────────┐
│  EntityFilterPipeline (filtering)  │
│  - RelevanceFilter                 │
│  - DeduplicationFilter             │
│  - NormalizationFilter             │
│  - EnrichmentFilter                │
└────────────────────────────────────┘
        ↓
    EnrichedEntity[]
        ↓
    🗄️ GraphStore (SQLite)
```

---

## 📁 Arquivos Criados

### 1. `entity-conversion/ASTEntityAdapter.ts` (182 linhas)
**Responsabilidade**: Conectar extraction ↔ filtering

**Métodos principais**:
```typescript
// Converte para formato de análise do ASTRelationshipExtractor
static toAnalysisFormat(astEntities: ASTEntity[]): {
  imports: ImportInfo[];
  exports: string[];
  calls: string[];
  typeRefs: string[];
}

// Converte análise → RawEntity[] (para EntityFilterPipeline)
static fromAnalysisFormat(analysis): RawEntity[]

// Converte diretamente ASTEntity[] → RawEntity[]
static toRawEntities(astEntities: ASTEntity[]): RawEntity[]
```

### 2. `entity-conversion/index.ts`
```typescript
export { ASTEntityAdapter } from './ASTEntityAdapter';
```

---

## 🔧 Arquivos Modificados

### 1. `entity-extraction/types/ASTEntity.ts`
**Mudança**: Adicionado campo `kind?: ASTNodeKind`

```typescript
export type ASTNodeKind = 
  | "import"
  | "export" 
  | "call"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "variable"
  | "jsx";

export interface ASTEntity extends ExtractedEntity {
  kind?: ASTNodeKind; // ← NOVO CAMPO
  category: ASTEntityCategory;
  source: string;
  line: number;
  column: number;
  // ...
}
```

**Razão**: Diferenciar **node type** (onde veio no AST) de **entity type** (o que é semanticamente).

### 2. `entity-extraction/extractors/*Extractor.ts`
**Mudança**: Todos os extractors agora definem `kind`:

```typescript
// ImportExtractor.ts
entities.push({
  name,
  type: TypeInferrer.fromName(name),
  kind: "import", // ← ADICIONADO
  category: isExternal ? "external" : "internal",
  // ...
});

// ExportExtractor.ts
entities.push({
  name,
  type: TypeInferrer.fromNode(node.declaration),
  kind: "export", // ← ADICIONADO
  category: "internal",
  // ...
});

// CallExpressionExtractor.ts
entities.push({
  name: callName,
  type: "function",
  kind: "call", // ← ADICIONADO
  category: "internal",
  // ...
});
```

### 3. `ast-relationship-extractor.ts` (420 → 208 linhas)
**Mudanças**:
- ✅ Removidos métodos privados:
  - `extractImportsWithResolution()` (~90 linhas)
  - `extractExports()` (~40 linhas)
  - `extractFunctionCalls()` (~35 linhas)
  - `extractTypeReferences()` (~35 linhas)
- ✅ `analyze()` agora usa:
  ```typescript
  const extractor = new ASTEntityExtractor(this.workspaceRoot);
  const astEntities = await extractor.extractFromFile(absFilePath);
  const analysis = ASTEntityAdapter.toAnalysisFormat(astEntities);
  ```
- ✅ `extract()` usa `analyze()` internamente
- ✅ Imports removidos: `parse`, `fs`

### 4. `DebugAnalyzeUseCase.ts`
**Mudanças**:
- ✅ Removida construção manual de `rawEntities` (~50 linhas):
  ```typescript
  // ANTES
  const rawEntities: RawEntity[] = [];
  analysis.imports.forEach(imp => {
    rawEntities.push({ type: 'import', name: imp.specifiers[0], ... });
  });
  analysis.exports.forEach(exp => {
    rawEntities.push({ type: 'export', name: exp, ... });
  });
  // ... mais 40 linhas
  
  // DEPOIS
  const rawEntities = ASTEntityAdapter.fromAnalysisFormat(analysis);
  ```

### 5. `entity-extraction/core/ASTEntityExtractor.ts`
**Mudanças**: Adicionado logging detalhado:
```typescript
console.log(`🔍 [ASTEntityExtractor] Starting extraction for: ${filePath}`);
console.log(`📄 [ASTEntityExtractor] File size: ${content.length} chars`);
console.log(`✅ [ASTEntityExtractor] AST parsed successfully`);
console.log(`📊 [ASTEntityExtractor] Context built - Exported names: ${context.exportedNames.size}`);
console.log(`📥 [ASTEntityExtractor] Import map built - Imported symbols: ${context.importedSymbols.size}`);
console.log(`✨ [ASTEntityExtractor] Extracted ${entities.length} entities`);
console.log(`   Types breakdown:`, byType);
```

### 6. `entity-conversion/ASTEntityAdapter.ts`
**Mudanças**: Adicionado logging:
```typescript
console.log(`🔄 [ASTEntityAdapter] Converting ${astEntities.length} AST entities to analysis format`);
console.log(`✨ [ASTEntityAdapter] Converted to: ${imports.length} imports, ${exports.length} exports, ${calls.length} calls, ${typeRefs.length} typeRefs`);
```

---

## 📈 Métricas de Redução

| Arquivo | Antes | Depois | Redução |
|---------|-------|--------|---------|
| `ast-relationship-extractor.ts` | 420 | 208 | **-212 (-50%)** |
| `DebugAnalyzeUseCase.ts` | ~150 | ~100 | **-50 (-33%)** |
| **Total removido** | 570 | 308 | **-262 (-46%)** |
| **Código novo (adapter)** | 0 | 182 | +182 |
| **Saldo líquido** | 570 | 490 | **-80 (-14%)** |

**Benefícios além da redução de LOC**:
- ✅ Manutenção centralizada em 1 local (extraction) vs 3+ locais
- ✅ Testes unitários reutilizáveis
- ✅ Consistência de extração entre debug/upload/scan
- ✅ Arquitetura limpa (hexagonal separada em camadas)

---

## 🔬 Fluxo de Dados Detalhado

### Input: `main.tsx`
```typescript
import React from 'react';
import { Button } from './components';

export function App() {
  console.log('App rendered');
  return <Button onClick={handleClick}>Click</Button>;
}
```

### Output de `ASTEntityExtractor`:
```typescript
ASTEntity[] = [
  { name: 'React', type: 'library', kind: 'import', category: 'external', source: 'react', line: 1 },
  { name: 'Button', type: 'component', kind: 'import', category: 'internal', source: './components', line: 2 },
  { name: 'App', type: 'function', kind: 'function', category: 'internal', source: 'main.tsx', line: 4, isExported: true },
  { name: 'console.log', type: 'function', kind: 'call', category: 'internal', source: 'main.tsx', line: 5 },
  { name: 'Button', type: 'component', kind: 'jsx', category: 'internal', source: 'main.tsx', line: 6 },
  { name: 'handleClick', type: 'function', kind: 'call', category: 'internal', source: 'main.tsx', line: 6 }
]
```

### Output de `ASTEntityAdapter.toAnalysisFormat()`:
```typescript
{
  imports: [
    { source: 'react', specifiers: ['React'], isExternal: true },
    { source: './components', specifiers: ['Button'], isExternal: false }
  ],
  exports: ['App'],
  calls: ['console.log', 'handleClick'],
  typeRefs: []
}
```

### Output de `ASTEntityAdapter.fromAnalysisFormat()`:
```typescript
RawEntity[] = [
  { type: 'import', name: 'React', source: 'react', scope: 'module', metadata: { isExternal: true } },
  { type: 'import', name: 'Button', source: './components', scope: 'module', metadata: { isExternal: false } },
  { type: 'export', name: 'App', scope: 'module' },
  { type: 'call', name: 'console.log', scope: 'local' },
  { type: 'call', name: 'handleClick', scope: 'local' }
]
```

### Output de `EntityFilterPipeline.process()`:
```typescript
EnrichedEntity[] = [
  {
    type: 'import',
    name: 'React',
    normalizedName: 'React',
    category: 'external',
    confidence: 0.95,
    packageInfo: { name: 'react', version: '18.2.0', manager: 'npm' },
    relationships: [{ target: 'App', type: 'uses', confidence: 0.8 }],
    occurrences: 1
  },
  {
    type: 'export',
    name: 'App',
    normalizedName: 'App',
    category: 'internal',
    confidence: 0.95,
    relationships: [
      { target: 'React', type: 'imports', confidence: 0.9 },
      { target: 'Button', type: 'uses', confidence: 0.85 }
    ],
    occurrences: 1
  }
  // ... mais entidades filtradas/enriquecidas
]
```

---

## 🧪 Como Testar

### 1. Debug Upload
1. Abra VS Code Developer Tools (Help → Toggle Developer Tools)
2. Vá para Debug Page na extensão
3. Faça upload de um arquivo `.tsx` ou `.ts`
4. Verifique logs no console:

**Logs esperados**:
```
🔍 [ASTEntityExtractor] Starting extraction for: .cappy-debug-temp/main.tsx
📄 [ASTEntityExtractor] File size: 1234 chars
✅ [ASTEntityExtractor] AST parsed successfully
📊 [ASTEntityExtractor] Context built - Exported names: 3
📥 [ASTEntityExtractor] Import map built - Imported symbols: 5
✨ [ASTEntityExtractor] Extracted 12 entities from main.tsx
   Types breakdown: { import: 5, export: 3, call: 2, function: 1, jsx: 1 }
🔄 [ASTEntityAdapter] Converting 12 AST entities to analysis format
✨ [ASTEntityAdapter] Converted to: 5 imports, 3 exports, 2 calls, 0 typeRefs
🔄 [Debug] Converting analysis to raw entities...
🔍 [Debug] Raw entities extracted: 10
📝 [Debug] Breakdown - Imports: 5, Exports: 3, Calls: 2, TypeRefs: 0
🔄 [Debug] Starting pipeline processing...
✅ Filtro 1 (Relevância): 8 entidades (descartadas: 2)
✅ Filtro 2 (Deduplicação): 7 entidades (mescladas: 1)
✅ Filtro 3 (Normalização): 7 entidades
✅ Filtro 4 (Enriquecimento): 7 entidades finais
```

### 2. Verificar Frontend
No navegador (console do frontend):
```
[DebugPage] Received analysis result: {...}
[DebugPage] Has pipeline? true
[DebugPage] Pipeline stats: { totalRaw: 10, finalCount: 7, ... }
[DebugPage] Enriched entities count: 7
[DebugPage] First 3 enriched: [...]
```

---

## 🚀 Próximos Passos

### Sprint 7: Consolidar WorkspaceScanner
- [ ] Refatorar `WorkspaceScanner` para usar `ASTEntityExtractor`
- [ ] Garantir que scan de workspace use pipeline integrado
- [ ] Remover qualquer código duplicado remanescente

### Sprint 8: Performance
- [ ] Benchmark: extração antiga vs nova
- [ ] Otimizar traversal do AST se necessário
- [ ] Cache de entidades extraídas (opcional)

### Sprint 9: Documentação
- [ ] Atualizar README dos 3 módulos
- [ ] Criar diagramas de sequência
- [ ] Documentar padrões de uso

---

## 📝 Notas de Implementação

### Por que campo `kind`?
O campo `type` em `ASTEntity` vem de `ExtractedEntity.type: EntityType`, que é um enum semântico:
```typescript
type EntityType = 'class' | 'function' | 'interface' | 'variable' | 'api' | 'library' | ...
```

Mas precisávamos diferenciar **de onde a entidade veio no AST**:
- Um `import React from 'react'` tem `type: 'library'` mas `kind: 'import'`
- Um `export function App()` tem `type: 'function'` mas `kind: 'export'`
- Um `console.log()` tem `type: 'function'` mas `kind: 'call'`

O campo `kind` resolve essa ambiguidade sem quebrar o tipo `ExtractedEntity`.

### Por que não quebrar `ExtractedEntity`?
`ExtractedEntity` é usado em múltiplos lugares:
- LLM extraction de documentos PDF/DOCX
- Entity recognition em texto livre
- Graph store persistence

Mudá-lo quebraria 10+ arquivos. O campo `kind` é específico para AST entities.

---

## 🐛 Troubleshooting

### Problema: "No entities found"
**Causas possíveis**:
1. Arquivo vazio ou só comentários
2. Erro de parsing (sintaxe inválida)
3. Extractors não matchando node types

**Debug**:
```typescript
// Ver logs do ASTEntityExtractor
console.log(`✨ Extracted ${entities.length} entities`);

// Se 0, verificar:
- AST foi parseado? (ver log "AST parsed successfully")
- Context tem exportedNames? (ver log "Context built")
- Traverser está visitando nodes? (adicionar log em ASTTraverser)
```

### Problema: "Pipeline stats mostra 0 final"
**Causas possíveis**:
1. RelevanceFilter muito agressivo
2. Todas entidades duplicadas e removidas
3. Config do pipeline incorreta

**Debug**:
```typescript
// Ver stats detalhado
console.log(filterResult.stats);
// {
//   totalRaw: 10,
//   totalFiltered: 8,  ← 2 descartadas por relevância
//   discardedCount: 2,
//   deduplicatedCount: 1,  ← 1 mesclada
//   finalCount: 7
// }
```

---

## ✅ Validação

- [x] Código compila sem erros TypeScript
- [x] Logs detalhados adicionados
- [x] ASTEntityAdapter criado e testado
- [x] ASTRelationshipExtractor refatorado (-212 linhas)
- [x] DebugAnalyzeUseCase refatorado (-50 linhas)
- [ ] WorkspaceScanner refatorado (pendente)
- [ ] Testes unitários passando (verificar)
- [ ] Debug upload funciona end-to-end (testando...)

---

**Autoria**: GitHub Copilot + Cappy Team  
**Revisão**: Pendente após validação funcional
