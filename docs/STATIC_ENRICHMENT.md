# 🔬 Static Enrichment System

## Overview

O **Static Enrichment System** é um módulo de análise estática que enriquece entidades extraídas do AST com informações semânticas e relacionais **sem usar LLM**.

**Localização**: `src/nivel2/infrastructure/services/entity-filtering/enrichers/static/`

---

## 📊 Arquitetura

```
NormalizedEntity[]
        ↓
┌─────────────────────────────────┐
│   JSDocExtractor                │ ← Extrai JSDoc comments
│   - description, params, returns│
│   - tags, examples, deprecated  │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│   SemanticTypeInferrer          │ ← Infere tipo semântico
│   - react-component, api-handler│
│   - service, repository, utility│
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│   StaticRelationshipInferrer    │ ← Infere relacionamentos
│   - imports, uses, calls        │
│   - extends, implements          │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│   StaticConfidenceCalculator    │ ← Calcula confiança
│   - JSDoc? +0.15                │
│   - Type annotations? +0.10     │
│   - Tests? +0.10                │
└─────────────────────────────────┘
        ↓
StaticallyEnrichedEntity[]
```

---

## 🧩 Módulos

### 1. JSDocExtractor

**Arquivo**: `JSDocExtractor.ts`

**Responsabilidade**: Extrair e parsear comentários JSDoc

**API Principal**:
```typescript
// Extrai JSDoc de uma entidade
JSDocExtractor.extractFromSource(
  sourceCode: string,
  entityLine: number
): ParsedJSDoc | null

// Extrai JSDoc de múltiplas entidades (batch)
JSDocExtractor.extractBatch(
  sourceCode: string,
  entities: Array<{ name: string; line: number }>
): Map<string, ParsedJSDoc>
```

**Output**:
```typescript
interface ParsedJSDoc {
  description: string;
  summary: string;
  params: Array<{
    name: string;
    type?: string;
    description?: string;
    optional?: boolean;
    defaultValue?: string;
  }>;
  returns?: {
    type?: string;
    description?: string;
  };
  throws?: Array<{
    type?: string;
    description?: string;
  }>;
  tags: Array<{
    tag: string;
    name?: string;
    type?: string;
    description?: string;
  }>;
  examples?: string[];
  deprecated?: string;
  since?: string;
  author?: string;
  async?: boolean;
}
```

**Exemplo**:
```typescript
/**
 * Renderiza o componente raiz da aplicação React.
 * @param {HTMLElement} rootElement - Elemento DOM raiz
 * @returns {void}
 * @async
 * @component
 * @since 1.0.0
 */
function App(rootElement) { }

// Resultado:
{
  description: "Renderiza o componente raiz da aplicação React.",
  summary: "Renderiza o componente raiz da aplicação React.",
  params: [
    { name: "rootElement", type: "HTMLElement", description: "Elemento DOM raiz" }
  ],
  returns: { type: "void" },
  tags: [
    { tag: "component" },
    { tag: "since", description: "1.0.0" }
  ],
  async: true
}
```

---

### 2. SemanticTypeInferrer

**Arquivo**: `SemanticTypeInferrer.ts`

**Responsabilidade**: Inferir tipo semântico baseado em padrões

**Tipos Semânticos**:
```typescript
type SemanticType =
  | 'react-component'   // MyButton, AppPage
  | 'react-hook'        // useAuth, useState
  | 'react-context'     // ThemeContext, AuthProvider
  | 'api-handler'       // handleLogin, onSubmit
  | 'api-route'         // /api/users/:id
  | 'api-middleware'    // authMiddleware
  | 'service'           // UserService, AuthService
  | 'repository'        // UserRepository
  | 'model'             // UserModel
  | 'dto'               // LoginRequestDTO
  | 'entity'            // User, Product
  | 'utility'           // formatDate, parseJSON
  | 'helper'            // createMockUser
  | 'config'            // appConfig, settings
  | 'constant'          // API_URL, MAX_RETRIES
  | 'enum'              // UserRole, Status
  | 'type-definition'   // interface User, type Props
  | 'test-suite'        // App.test.ts
  | 'test-helper'       // mockUser, fixture
  | 'unknown';
```

**Lógica de Inferência**:
1. **JSDoc tags** (prioridade mais alta)
   - `@component` → `react-component`
   - `@hook` → `react-hook`
   - `@api` → `api-handler`
   - `@service` → `service`
   
2. **Padrões de nome React**
   - Começa com maiúscula + retorna JSX → `react-component`
   - `use[A-Z].*` → `react-hook`
   - `*Context` → `react-context`

3. **Padrões de nome API**
   - `*Handler`, `handle*` → `api-handler`
   - `*Middleware`, `auth*` → `api-middleware`

4. **Padrões de arquitetura**
   - `*Service` → `service`
   - `*Repository` → `repository`
   - `*DTO`, `*Request`, `*Response` → `dto`

5. **Padrões de utilitários**
   - `*Utils`, `*Util` → `utility`
   - `*Helper` → `helper`
   - `UPPER_CASE` → `constant`

6. **Padrões de teste**
   - `*.test.*`, `*.spec.*` → `test-suite`
   - `mock*`, `fixture*` → `test-helper`

**API**:
```typescript
SemanticTypeInferrer.infer(
  entity: NormalizedEntity,
  jsdoc?: ParsedJSDoc,
  sourceCode?: string
): SemanticType
```

---

### 3. StaticRelationshipInferrer

**Arquivo**: `StaticRelationshipInferrer.ts`

**Responsabilidade**: Inferir relacionamentos entre entidades

**Tipos de Relacionamento**:
```typescript
type RelationshipType =
  | 'imports'      // import React from 'react'
  | 'exports'      // export function App()
  | 'uses'         // usa outra entidade
  | 'calls'        // console.log(), handleClick()
  | 'implements'   // class A implements B
  | 'extends'      // class A extends B
  | 'returns'      // function returns Type
  | 'accepts'      // function accepts Type
  | 'throws'       // function throws Error
  | 'depends-on';  // depende de package
```

**Relacionamento**:
```typescript
interface InferredRelationship {
  target: string;           // Nome da entidade target
  type: RelationshipType;   // Tipo de relacionamento
  confidence: number;       // 0-1
  evidence: string[];       // Evidências usadas
}
```

**Lógica de Inferência**:

1. **Import/Export** (confidence: 1.0)
   ```typescript
   import { Button } from './components';
   // → { target: './components', type: 'imports', confidence: 1.0 }
   ```

2. **Usage** (confidence: 0.7-0.95)
   ```typescript
   function App() {
     return <Button onClick={handleClick}>
   }
   // → { target: 'Button', type: 'uses', evidence: ['jsx-element'], confidence: 0.85 }
   // → { target: 'handleClick', type: 'calls', evidence: ['call-expression'], confidence: 0.8 }
   ```

3. **Herança** (confidence: 1.0)
   ```typescript
   class Button extends Component implements Clickable {
   }
   // → { target: 'Component', type: 'extends', confidence: 1.0 }
   // → { target: 'Clickable', type: 'implements', confidence: 1.0 }
   ```

4. **Dependência** (confidence: 1.0)
   ```typescript
   // Se tem packageInfo
   // → { target: 'react', type: 'depends-on', confidence: 1.0 }
   ```

**API**:
```typescript
StaticRelationshipInferrer.infer(
  entity: NormalizedEntity,
  allEntities: NormalizedEntity[],
  sourceCode?: string
): InferredRelationship[]
```

---

### 4. StaticConfidenceCalculator

**Arquivo**: `StaticConfidenceCalculator.ts`

**Responsabilidade**: Calcular confiança baseado em evidências

**Fórmula**:
```
Base Score: 0.5

+ 0.15  se tem JSDoc
+ 0.10  se tem type annotations
+ 0.10  se tem testes
+ 0.05  por relacionamento (max +0.15)
+ 0.03  por uso (max +0.10)
+ 0.05  se é exportada

× semantic_type_confidence (0.5 se unknown, 0.9 caso contrário)

Range: [0, 1]
```

**Evidências**:
```typescript
interface ConfidenceEvidence {
  hasJSDoc: boolean;
  hasTypeAnnotations: boolean;
  hasTests: boolean;
  relationshipCount: number;
  usageCount: number;
  isExported: boolean;
  semanticTypeConfidence: number;
}
```

**Exemplos**:

```typescript
// Entidade bem documentada com testes
{
  hasJSDoc: true,              // +0.15
  hasTypeAnnotations: true,    // +0.10
  hasTests: true,              // +0.10
  relationshipCount: 5,        // +0.15 (max reached)
  usageCount: 3,               // +0.09
  isExported: true,            // +0.05
  semanticTypeConfidence: 0.9  // × 0.9
}
// Score: (0.5 + 0.15 + 0.10 + 0.10 + 0.15 + 0.09 + 0.05) × 0.9 = 1.01 → 1.0

// Entidade sem documentação
{
  hasJSDoc: false,             // +0
  hasTypeAnnotations: false,   // +0
  hasTests: false,             // +0
  relationshipCount: 1,        // +0.05
  usageCount: 0,               // +0
  isExported: false,           // +0
  semanticTypeConfidence: 0.5  // × 0.5 (unknown type)
}
// Score: (0.5 + 0.05) × 0.5 = 0.275
```

**API**:
```typescript
StaticConfidenceCalculator.calculate(
  entity: NormalizedEntity,
  jsdoc: ParsedJSDoc | null,
  semanticType: SemanticType,
  relationships: InferredRelationship[],
  allEntities: NormalizedEntity[]
): number
```

---

## 🔌 Integração no Pipeline

O `StaticEnrichmentFilter` é o **Filtro 3.5** no `EntityFilterPipeline`:

```
Filtro 1: RelevanceFilter       → Remove noise
Filtro 2: DeduplicationFilter   → Mescla duplicatas
Filtro 3: NormalizationFilter   → Normaliza nomes/paths
Filtro 3.5: StaticEnrichmentFilter  ← NOVO!
Filtro 4: EnrichmentFilter      → LLM enrichment
```

**Código**:
```typescript
const pipeline = new EntityFilterPipeline(config);
const result = await pipeline.process(
  rawEntities,
  filePath,
  chunks,
  sourceCode  // ← Passar código-fonte para análise estática
);

// result.staticEnriched: StaticallyEnrichedEntity[]
```

---

## 📤 Output

```typescript
interface StaticallyEnrichedEntity extends NormalizedEntity {
  semanticType: SemanticType;              // Tipo semântico inferido
  jsdoc?: ParsedJSDoc;                     // JSDoc parseado (se existir)
  staticRelationships: InferredRelationship[];  // Relacionamentos inferidos
  staticConfidence: number;                // Confiança estática (0-1)
  location?: {                             // Localização no código
    file: string;
    line: number;
    column?: number;
  };
}
```

**Exemplo Completo**:
```typescript
{
  // Dados base (de NormalizedEntity)
  name: "Button",
  type: "function",
  normalizedName: "Button",
  category: "internal",
  packageInfo: null,
  
  // Enriquecimento estático (NOVO!)
  semanticType: "react-component",
  jsdoc: {
    description: "Renderiza um botão customizado.",
    summary: "Renderiza um botão customizado.",
    params: [
      { name: "props", type: "ButtonProps", description: "Propriedades do botão" }
    ],
    returns: { type: "JSX.Element" },
    tags: [{ tag: "component" }],
    since: "1.0.0"
  },
  staticRelationships: [
    { target: "React", type: "imports", confidence: 1.0, evidence: ["explicit-import"] },
    { target: "Icon", type: "uses", confidence: 0.85, evidence: ["jsx-element"] },
    { target: "handleClick", type: "calls", confidence: 0.8, evidence: ["call-expression"] }
  ],
  staticConfidence: 0.92,
  location: {
    file: "src/components/Button.tsx",
    line: 15,
    column: 8
  }
}
```

---

## 📊 Logs

Quando o filtro é executado, você verá:

```
🔬 [StaticEnrichment] Enriching 15 entities...
   📝 Extracted JSDoc for 8 entities
   ✨ Semantic types: { react-component: 5, utility: 3, react-hook: 2, service: 1, unknown: 4 }
   📊 Average confidence: 0.78
   🕸️ Total relationships: 42
   📝 With JSDoc: 8/15
```

---

## 🎯 Benefícios

1. **Zero custo de LLM**: Análise 100% estática
2. **Rápido**: Processar arquivo em <100ms
3. **Determinístico**: Mesma entrada = mesma saída
4. **Rico em informações**: JSDoc, tipos semânticos, relacionamentos
5. **Base para LLM**: O enriquecimento LLM (Filtro 4) pode usar essas informações

---

## 🔍 Casos de Uso

### 1. Documentação Automática
```typescript
const entity = staticEnriched.find(e => e.name === 'Button');
console.log(entity.jsdoc?.description);
// "Renderiza um botão customizado."
```

### 2. Análise de Cobertura
```typescript
const withJSDoc = staticEnriched.filter(e => e.jsdoc).length;
const total = staticEnriched.length;
console.log(`Cobertura de documentação: ${(withJSDoc/total*100).toFixed(1)}%`);
```

### 3. Detecção de Componentes React
```typescript
const components = staticEnriched.filter(e => e.semanticType === 'react-component');
console.log(`${components.length} React components encontrados`);
```

### 4. Grafo de Dependências
```typescript
for (const entity of staticEnriched) {
  console.log(`${entity.name} →`);
  for (const rel of entity.staticRelationships) {
    console.log(`  ${rel.type}: ${rel.target} (${rel.confidence.toFixed(2)})`);
  }
}
```

---

## 🧪 Testing

Criar arquivo de teste com JSDoc bem documentado:

```typescript
/**
 * Hook personalizado para autenticação.
 * @returns {{user: User | null, login: Function, logout: Function}}
 * @hook
 * @since 2.0.0
 */
export function useAuth() {
  // ...
}
```

Fazer debug upload e verificar:
1. ✅ JSDoc extraído corretamente
2. ✅ Tipo semântico = `react-hook`
3. ✅ Confidence alta (>0.8)
4. ✅ Relacionamentos inferidos

---

## 📚 Dependências

- `comment-parser` - Para parsing de JSDoc
- Nenhuma dependência externa além disso!

---

## 🔜 Próximas Melhorias

1. **Type inference melhorada**: Usar TypeScript Compiler API
2. **Control flow analysis**: Inferir relacionamentos baseado em fluxo
3. **Pattern matching**: Detectar design patterns (Singleton, Factory, etc)
4. **Complexity metrics**: Cyclomatic complexity, cognitive complexity
5. **Dead code detection**: Identificar código não usado

---

**Autoria**: Cappy Team  
**Versão**: 3.2.0  
**Data**: 25/10/2025
