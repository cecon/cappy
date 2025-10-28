# Arquitetura Hexagonal - AST Entity Extraction

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🎯 ASTEntityExtractor (Port)                     │
│                         ~70 linhas - Orquestrador                    │
│                                                                       │
│  1. Parse AST                                                        │
│  2. Collect Exports → ExportCollector                               │
│  3. Build Import Map → ImportMapBuilder                             │
│  4. Traverse & Extract → ASTTraverser                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    🗺️  ASTTraverser (Adapter)                       │
│                  Delega para extractors especializados               │
│                                                                       │
│  switch (node.type) {                                                │
│    case "ImportDeclaration" → ImportExtractor                       │
│    case "FunctionDeclaration" → FunctionExtractor                   │
│    case "VariableDeclarator" → VariableExtractor                    │
│    case "JSXElement" → JSXExtractor                                 │
│    case "CallExpression" → CallExpressionExtractor                  │
│    case "ClassDeclaration" → ClassExtractor                         │
│    case "TSInterfaceDeclaration" → InterfaceExtractor               │
│    case "TSTypeAliasDeclaration" → TypeAliasExtractor               │
│    case "ExportDefaultDeclaration" → ExportExtractor                │
│    case "ExportNamedDeclaration" → ExportExtractor                  │
│  }                                                                   │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ├─────────────────────────────────────────────────────┐
           │                                                     │
           ↓                                                     ↓
┌──────────────────────┐                          ┌──────────────────────┐
│  📦 Extractors       │                          │  🔧 Helpers          │
│  (Adapters)          │                          │  (Domain Services)   │
│                      │                          │                      │
│ • ImportExtractor    │◄─────────────────────────┤ • ASTHelpers         │
│ • FunctionExtractor  │   usa                    │ • ConfidenceCalc     │
│ • VariableExtractor  │                          │ • TypeInferrer       │
│ • JSXExtractor       │                          │                      │
│ • CallExprExtractor  │                          │ Static utilities     │
│ • ClassExtractor     │                          │ No state             │
│ • InterfaceExtractor │                          │ Pure functions       │
│ • TypeAliasExtractor │                          │                      │
│ • ExportExtractor    │                          └──────────────────────┘
│                      │
│ Single Responsibility│
│ ~30-45 linhas cada   │
└──────────────────────┘

           ↑
           │ recebe
           │
┌──────────────────────┐
│  📋 Context & Types  │
│  (Domain Models)     │
│                      │
│ • ExtractionContext  │
│   - filePath         │
│   - exportedNames    │
│   - importedSymbols  │
│   - content          │
│                      │
│ • ASTEntity          │
│   - name             │
│   - type             │
│   - category         │
│   - confidence       │
│   - metadata         │
│                      │
│ • ASTNode types      │
└──────────────────────┘
```

## 🔄 Fluxo de Dados

```
File Path
    ↓
Parse (typescript-eslint)
    ↓
AST Tree
    ↓
┌──────────────────────┐
│ ExportCollector      │ → Set<string> exportedNames
└──────────────────────┘
    ↓
┌──────────────────────┐
│ ImportMapBuilder     │ → Map<name, module> importedSymbols
└──────────────────────┘
    ↓
┌──────────────────────┐
│ ASTTraverser         │
│   ├─ ImportExtractor │ → ASTEntity[]
│   ├─ FunctionExtr... │ → ASTEntity[]
│   ├─ VariableExtr... │ → ASTEntity[]
│   ├─ JSXExtractor    │ → ASTEntity[]
│   ├─ CallExprExtr... │ → ASTEntity[]
│   ├─ ClassExtractor  │ → ASTEntity[]
│   └─ ...             │
└──────────────────────┘
    ↓
ASTEntity[] (result)
```

## 🎨 Padrões de Design

### 1. **Strategy Pattern**
Cada extractor implementa a mesma interface:
```typescript
static extract(node: SpecificNode, context: ExtractionContext): ASTEntity | ASTEntity[]
```

### 2. **Visitor Pattern**
`ASTTraverser` percorre a árvore e "visita" cada nó, delegando para o extractor apropriado.

### 3. **Factory Pattern**
```typescript
export function createASTEntityExtractor(workspaceRoot: string): ASTEntityExtractor
```

### 4. **Dependency Injection**
`ExtractionContext` é injetado em todos os extractors, evitando dependências globais.

## 💡 Vantagens da Arquitetura

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **LOC por arquivo** | 1080 linhas | 30-120 linhas |
| **Complexidade Cognitiva** | 30+ (alta) | <15 (baixa) |
| **Testabilidade** | Baixa (monolítico) | Alta (isolado) |
| **Acoplamento** | Alto | Baixo |
| **Coesão** | Baixa | Alta |
| **Manutenibilidade** | Difícil | Fácil |
| **Extensibilidade** | Requer modificar classe grande | Adicionar novo arquivo |

## 🧪 Testabilidade

### Antes (Monolítico)
```typescript
// Precisava mockar toda a classe
test('should extract imports', () => {
  const extractor = new ASTEntityExtractor('/workspace');
  // Testa método privado? Como?
});
```

### Depois (Modular)
```typescript
// Testa apenas o extractor específico
test('ImportExtractor should extract named imports', () => {
  const node: ImportDeclarationNode = { /* mock */ };
  const context: ExtractionContext = { /* mock */ };
  
  const result = ImportExtractor.extract(node, context);
  
  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('MyImport');
});
```

## 🔌 Extensibilidade

### Adicionar novo tipo de entidade:

1. **Criar extractor** (`extractors/RouteExtractor.ts`):
```typescript
export class RouteExtractor {
  static extract(node: CallExpressionNode, context: ExtractionContext): ASTEntity[] {
    // Detecta express.get('/api/users', ...)
    // Detecta router.post('/login', ...)
  }
}
```

2. **Registrar no traverser** (`traversal/ASTTraverser.ts`):
```typescript
case "CallExpression": {
  const routes = RouteExtractor.extract(node, context);
  const calls = CallExpressionExtractor.extract(node, context);
  return [...routes, ...calls];
}
```

**Pronto!** Nenhuma outra classe precisa ser modificada. ✅
