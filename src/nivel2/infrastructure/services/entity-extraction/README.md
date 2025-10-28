# AST Entity Extraction - Hexagonal Architecture

## 📐 Arquitetura

Esta implementação segue os princípios da **Arquitetura Hexagonal (Ports & Adapters)**, com a classe principal servindo apenas como **orquestrador** de componentes especializados e reutilizáveis.

## 🏗️ Estrutura

```
entity-extraction/
├── core/
│   └── ASTEntityExtractor.ts         # Orquestrador principal (~70 linhas)
├── ast-types/
│   └── ASTNodeTypes.ts                # Tipos de nós AST
├── types/
│   ├── ASTEntity.ts                   # Interface da entidade extraída
│   └── ExtractionContext.ts          # Contexto compartilhado
├── extractors/                        # Extractors especializados (Single Responsibility)
│   ├── ImportExtractor.ts             # Extrai imports
│   ├── FunctionExtractor.ts           # Extrai funções
│   ├── VariableExtractor.ts           # Extrai variáveis
│   ├── JSXExtractor.ts                # Extrai componentes JSX
│   ├── CallExpressionExtractor.ts     # Extrai chamadas (logs, errors)
│   ├── ClassExtractor.ts              # Extrai classes
│   ├── InterfaceExtractor.ts          # Extrai interfaces
│   ├── TypeAliasExtractor.ts          # Extrai tipos
│   └── ExportExtractor.ts             # Extrai exports
├── helpers/                           # Utilitários compartilhados
│   ├── ASTHelpers.ts                  # Funções auxiliares de AST
│   ├── ConfidenceCalculator.ts        # Calcula score de confiança
│   └── TypeInferrer.ts                # Infere tipos de entidades
└── traversal/                         # Navegação de AST
    ├── ASTTraverser.ts                # Percorre AST e delega extractors
    ├── ExportCollector.ts             # Coleta nomes exportados
    └── ImportMapBuilder.ts            # Constrói mapa de imports

```

## 🎯 Princípios Aplicados

### 1. **Single Responsibility Principle (SRP)**
Cada extractor é responsável por **apenas um tipo** de entidade:
- `ImportExtractor` → imports
- `FunctionExtractor` → funções
- `JSXExtractor` → componentes JSX
- etc.

### 2. **Open/Closed Principle (OCP)**
Para adicionar um novo tipo de extração:
1. Crie um novo extractor em `extractors/`
2. Adicione-o no `ASTTraverser`
3. **Não modifica** código existente

### 3. **Dependency Inversion Principle (DIP)**
- Extractors dependem de **abstrações** (`ExtractionContext`, `ASTEntity`)
- Helpers são **estáticos e sem estado**
- Fácil de testar e substituir

### 4. **Separation of Concerns**
- **Core**: Orquestração
- **Extractors**: Lógica de extração
- **Helpers**: Utilitários
- **Traversal**: Navegação de AST

## 🚀 Uso

### Básico
```typescript
import { ASTEntityExtractor } from '@/nivel2/infrastructure/services/entity-extraction';

const extractor = new ASTEntityExtractor('/path/to/workspace');
const entities = await extractor.extractFromFile('src/index.ts');
```

### Customização - Adicionar Novo Extractor
```typescript
// 1. Crie seu extractor
export class CustomExtractor {
  static extract(node: CustomNode, context: ExtractionContext): ASTEntity[] {
    // Sua lógica aqui
    return entities;
  }
}

// 2. Adicione no ASTTraverser
private static extractFromNode(node: ASTNode, context: ExtractionContext): ASTEntity[] {
  switch (node.type) {
    // ...casos existentes
    case "CustomNodeType":
      return CustomExtractor.extract(node as CustomNode, context);
  }
}
```

### Customização - Alterar Cálculo de Confiança
```typescript
// Modifique apenas ConfidenceCalculator.ts
export class ConfidenceCalculator {
  static calculate(node: ASTNode, entityType: string, context: ExtractionContext): number {
    // Sua lógica customizada
  }
}
```

## 📊 Métricas

| Arquivo | Linhas | Responsabilidade |
|---------|--------|------------------|
| `ASTEntityExtractor.ts` | ~70 | Orquestração |
| `ImportExtractor.ts` | ~35 | Extração de imports |
| `FunctionExtractor.ts` | ~30 | Extração de funções |
| `VariableExtractor.ts` | ~45 | Extração de variáveis |
| `JSXExtractor.ts` | ~30 | Extração de JSX |
| `ASTHelpers.ts` | ~120 | Utilitários |
| `ASTTraverser.ts` | ~90 | Navegação |

**Total**: ~450 linhas distribuídas em 15+ arquivos modulares

**Antes**: 1 arquivo monolítico com 1080+ linhas

## ✅ Benefícios

1. **Testabilidade**: Cada componente pode ser testado isoladamente
2. **Manutenibilidade**: Mudanças são localizadas em arquivos pequenos
3. **Reusabilidade**: Helpers e extractors podem ser usados em outros contextos
4. **Extensibilidade**: Adicionar novos extractors sem modificar código existente
5. **Legibilidade**: Cada arquivo tem uma responsabilidade clara e <150 linhas

## 🔄 Migração do Código Antigo

O arquivo original foi preservado como `ASTEntityExtractor.old.ts` para referência.

A nova implementação mantém **100% de compatibilidade** com a API pública:
```typescript
// API pública permanece inalterada
const extractor = new ASTEntityExtractor(workspaceRoot);
const entities = await extractor.extractFromFile(filePath);
```

## 📝 Próximos Passos

- [ ] Testes unitários para cada extractor
- [ ] Implementar Sprint 3: Extração de literais (rotas, seletores)
- [ ] Implementar Sprint 4: Relacionamentos avançados (scope mapping)
- [ ] Documentação de cada extractor individual
