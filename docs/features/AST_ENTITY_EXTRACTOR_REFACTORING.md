# Refatoração do ASTEntityExtractor

## 📋 Análise da Implementação Atual

### ✅ Pontos Fortes

1. **Estrutura sólida com duas passadas**
   - 1ª passada: coleta nomes exportados
   - 2ª passada: extrai todas as entidades

2. **Já extrai várias categorias de entidades**:
   - ✅ Import declarations (com specifiers)
   - ✅ Function declarations
   - ✅ Arrow functions e function expressions (como VariableDeclarator)
   - ✅ Variable declarations
   - ✅ JSX Elements (componentes React)
   - ✅ Call expressions
   - ✅ Class declarations
   - ✅ Interface declarations
   - ✅ Type alias declarations

3. **Metadados detalhados**:
   - ✅ Localização (linha, coluna)
   - ✅ Source file relativo
   - ✅ isExported flag
   - ✅ Parameters e returnType (funções)
   - ✅ variableType e initialValue (variáveis)
   - ✅ props (componentes JSX)

### ⚠️ Gaps Identificados

#### 1. **Categorização incompleta**
   - `category` nem sempre é corretamente inferida
   - Falta análise de escopo para determinar se uma entidade vem de import externo
   - Componentes JSX não têm flag de `isImported` vs `isDeclaredLocally`

#### 2. **Export handling limitado**
   - Não diferencia `export default` de `export named`
   - Não captura re-exports (`export { x } from './module'`)
   - Faltam metadados sobre tipo de export

#### 3. **Literais não categorizados**
   - Extrai apenas strings de log calls
   - Falta extração de:
     - Strings em rotas (ex: `'/api/users'`)
     - Seletores CSS (ex: `'.container'` ou `'#app'`)
     - Mensagens de erro
     - Chaves de configuração

#### 4. **Confidence score simplista**
   - Valores fixos (0.7, 0.8, 0.9, 1.0)
   - Não considera contexto ou análise mais profunda
   - Falta lógica para calcular confidence baseado em:
     - Presença de tipo explícito
     - Complexidade da estrutura
     - Disponibilidade de documentação

#### 5. **Relacionamentos básicos**
   - Apenas `imports` relationship
   - Falta vincular:
     - Chamadas de função → declaração da função
     - Uso de variável → declaração da variável
     - Props de componente → interface de props
     - Herança de classe → classe pai

#### 6. **Detecção de escopo limitada**
   - Não rastreia escopo léxico
   - CallExpression não vincula com escopo onde está sendo chamada
   - Falta contexto de módulo de origem para calls

---

## 🎯 Proposta de Refatoração

### Fase 1: Estrutura e Separação de Responsabilidades

#### 1.1. Criar extractors especializados por tipo

```typescript
// Novos métodos privados focados
private extractImportEntity(node: any, context: ExtractionContext): ASTEntity[]
private extractFunctionEntity(node: any, context: ExtractionContext): ASTEntity | null
private extractVariableEntity(node: any, context: ExtractionContext): ASTEntity | null
private extractJSXEntity(node: any, context: ExtractionContext): ASTEntity | null
private extractClassEntity(node: any, context: ExtractionContext): ASTEntity | null
private extractCallExpression(node: any, context: ExtractionContext): ASTEntity[]
private extractLiteralEntities(node: any, context: ExtractionContext): ASTEntity[]
private extractExportEntity(node: any, context: ExtractionContext): ASTEntity[]

interface ExtractionContext {
  filePath: string;
  relFilePath: string;
  exportedNames: Set<string>;
  importedSymbols: Map<string, { source: string; isExternal: boolean }>;
  content: string;
  currentScope?: string;
}
```

#### 1.2. Refatorar `extractEntities` para delegação

```typescript
private extractEntities(node: any, filePath: string, ...): void {
  if (!node) return;

  const context: ExtractionContext = {
    filePath,
    relFilePath: path.relative(this.workspaceRoot, filePath),
    exportedNames,
    importedSymbols: new Map(),
    content
  };

  // Delegar para extractors especializados
  const extracted = this.extractFromNode(node, context);
  entities.push(...extracted);

  // Recursão
  this.traverseChildren(node, filePath, entities, exportedNames, content);
}

private extractFromNode(node: any, context: ExtractionContext): ASTEntity[] {
  switch (node.type) {
    case 'ImportDeclaration':
      return this.extractImportEntity(node, context);
    case 'FunctionDeclaration':
      const func = this.extractFunctionEntity(node, context);
      return func ? [func] : [];
    case 'VariableDeclarator':
      const variable = this.extractVariableEntity(node, context);
      return variable ? [variable] : [];
    case 'JSXElement':
    case 'JSXFragment':
      const jsx = this.extractJSXEntity(node, context);
      return jsx ? [jsx] : [];
    case 'CallExpression':
      return this.extractCallExpression(node, context);
    case 'ClassDeclaration':
      const cls = this.extractClassEntity(node, context);
      return cls ? [cls] : [];
    case 'ExportDefaultDeclaration':
    case 'ExportNamedDeclaration':
      return this.extractExportEntity(node, context);
    case 'Literal':
      return this.extractLiteralEntities(node, context);
    default:
      return [];
  }
}
```

---

### Fase 2: Enriquecer Metadados

#### 2.1. Adicionar tipos de export

```typescript
export interface ASTEntity extends ExtractedEntity {
  // ... campos existentes

  /** Export type (for exported entities) */
  exportType?: 'default' | 'named' | 're-export';
  
  /** For JSX components: is it imported or declared locally? */
  isImported?: boolean;
  
  /** Original module (for imported entities) */
  originalModule?: string;
}
```

#### 2.2. Categorização aprimorada

```typescript
private inferCategory(
  node: any,
  context: ExtractionContext
): 'internal' | 'external' | 'builtin' | 'jsx' {
  
  // Verificar se é JSX
  if (node.type.startsWith('JSX')) return 'jsx';
  
  // Verificar se é builtin (console, Math, etc)
  if (this.isBuiltinAPI(node)) return 'builtin';
  
  // Verificar se está no mapa de imports
  const entityName = this.extractEntityName(node);
  if (entityName && context.importedSymbols.has(entityName)) {
    const importInfo = context.importedSymbols.get(entityName)!;
    return importInfo.isExternal ? 'external' : 'internal';
  }
  
  // Default: internal
  return 'internal';
}

private isBuiltinAPI(node: any): boolean {
  const builtins = [
    'console', 'Math', 'Object', 'Array', 'String', 'Number',
    'Date', 'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet',
    'JSON', 'Reflect', 'Proxy', 'Symbol', 'BigInt'
  ];
  
  const name = this.extractEntityName(node);
  return name ? builtins.includes(name.split('.')[0]) : false;
}
```

---

### Fase 3: Literais Importantes

#### 3.1. Detector de literais contextuais

```typescript
private extractLiteralEntities(node: any, context: ExtractionContext): ASTEntity[] {
  const entities: ASTEntity[] = [];
  
  if (node.type !== 'Literal' || typeof node.value !== 'string') {
    return entities;
  }
  
  const literal = node.value as string;
  const parent = this.findParentNode(node);
  
  // 1. Rotas (strings começando com / ou http)
  if (this.isRoute(literal)) {
    entities.push({
      name: literal,
      type: 'other',
      category: 'internal',
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      confidence: 0.85,
      context: 'route',
      metadata: { literalType: 'route' }
    });
  }
  
  // 2. Seletores CSS
  if (this.isCSSSelector(literal)) {
    entities.push({
      name: literal,
      type: 'other',
      category: 'internal',
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      confidence: 0.8,
      context: 'css-selector',
      metadata: { literalType: 'selector' }
    });
  }
  
  // 3. Mensagens de erro (dentro de throw ou Error())
  if (this.isErrorMessage(parent)) {
    entities.push({
      name: literal.substring(0, 50),
      type: 'other',
      category: 'internal',
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      confidence: 0.9,
      context: 'error-message',
      metadata: { literalType: 'error' }
    });
  }
  
  // 4. Log messages (já implementado, mas melhorar)
  if (this.isLogMessage(parent)) {
    entities.push({
      name: literal.substring(0, 50),
      type: 'other',
      category: 'builtin',
      source: context.relFilePath,
      line: node.loc?.start?.line || 0,
      column: node.loc?.start?.column || 0,
      confidence: 0.7,
      context: 'log-message',
      metadata: { literalType: 'log' }
    });
  }
  
  return entities;
}

private isRoute(str: string): boolean {
  return /^(\/|https?:\/\/)/.test(str);
}

private isCSSSelector(str: string): boolean {
  return /^[.#][\w-]+$/.test(str);
}

private isErrorMessage(parentNode: any): boolean {
  if (!parentNode) return false;
  
  // throw new Error("message")
  if (parentNode.type === 'ThrowStatement') return true;
  
  // new Error("message")
  if (parentNode.type === 'NewExpression' && parentNode.callee?.name === 'Error') {
    return true;
  }
  
  return false;
}

private isLogMessage(parentNode: any): boolean {
  if (!parentNode || parentNode.type !== 'CallExpression') return false;
  
  const callName = this.extractCallName(parentNode.callee);
  return callName?.startsWith('console.') || false;
}
```

---

### Fase 4: Confidence Score Avançado

#### 4.1. Sistema de scoring contextual

```typescript
private calculateConfidence(
  node: any,
  entityType: string,
  context: ExtractionContext
): number {
  let baseScore = 0.5;
  
  // Boost por tipo de nó
  const typeBoosts: Record<string, number> = {
    'FunctionDeclaration': 0.3,
    'ClassDeclaration': 0.3,
    'ImportDeclaration': 0.4,
    'VariableDeclarator': 0.2,
    'CallExpression': -0.1, // Menos confiável (pode ser dinâmico)
    'JSXElement': 0.25
  };
  
  baseScore += typeBoosts[node.type] || 0;
  
  // Boost por anotação de tipo
  if (this.hasTypeAnnotation(node)) {
    baseScore += 0.2;
  }
  
  // Boost por exportação
  const name = this.extractEntityName(node);
  if (name && context.exportedNames.has(name)) {
    baseScore += 0.1;
  }
  
  // Boost por documentação (JSDoc)
  if (this.hasDocumentation(node, context.content)) {
    baseScore += 0.15;
  }
  
  // Penalidade por complexidade
  const complexity = this.calculateComplexity(node);
  if (complexity > 10) {
    baseScore -= 0.1;
  }
  
  // Clamp entre 0.0 e 1.0
  return Math.max(0.0, Math.min(1.0, baseScore));
}

private hasTypeAnnotation(node: any): boolean {
  return !!(
    node.typeAnnotation ||
    node.returnType ||
    node.id?.typeAnnotation
  );
}

private hasDocumentation(node: any, content: string): boolean {
  // Verificar se há JSDoc antes do nó
  if (!node.loc) return false;
  
  const lines = content.split('\n');
  const nodeLine = node.loc.start.line;
  
  // Procurar por /** ou * na linha anterior
  for (let i = nodeLine - 2; i >= Math.max(0, nodeLine - 10); i--) {
    const line = lines[i]?.trim();
    if (line?.startsWith('/**') || line?.startsWith('*')) {
      return true;
    }
    if (line && !line.startsWith('*')) {
      break; // Parar se encontrar código
    }
  }
  
  return false;
}

private calculateComplexity(node: any): number {
  // Implementação simplificada de cyclomatic complexity
  let complexity = 1;
  
  const traverse = (n: any) => {
    if (!n) return;
    
    // Incrementar por estruturas de controle
    if (['IfStatement', 'ForStatement', 'WhileStatement', 'DoWhileStatement',
         'SwitchCase', 'ConditionalExpression', 'LogicalExpression'].includes(n.type)) {
      complexity++;
    }
    
    // Recursão
    for (const key in n) {
      if (key !== 'parent' && typeof n[key] === 'object') {
        if (Array.isArray(n[key])) {
          n[key].forEach(traverse);
        } else {
          traverse(n[key]);
        }
      }
    }
  };
  
  traverse(node);
  return complexity;
}
```

---

### Fase 5: Relacionamentos Avançados

#### 5.1. Rastreamento de escopo e relacionamentos

```typescript
interface ScopeInfo {
  functionDeclarations: Map<string, ASTEntity>;
  variableDeclarations: Map<string, ASTEntity>;
  classDeclarations: Map<string, ASTEntity>;
  imports: Map<string, { entity: ASTEntity; source: string }>;
}

private buildScopeMap(ast: any, filePath: string): ScopeInfo {
  const scope: ScopeInfo = {
    functionDeclarations: new Map(),
    variableDeclarations: new Map(),
    classDeclarations: new Map(),
    imports: new Map()
  };
  
  // Primeira passada: construir mapa de escopo
  // ... (implementação)
  
  return scope;
}

private enhanceRelationships(
  entities: ASTEntity[],
  scope: ScopeInfo
): void {
  for (const entity of entities) {
    // Vincular CallExpression → FunctionDeclaration
    if (entity.type === 'function' && entity.context?.includes('Called in')) {
      const declaredFunc = scope.functionDeclarations.get(entity.name);
      if (declaredFunc) {
        if (!entity.relationships) entity.relationships = [];
        entity.relationships.push({
          target: declaredFunc.name,
          type: 'calls',
          confidence: 0.9
        });
      }
    }
    
    // Vincular JSX component → import ou declaração local
    if (entity.type === 'component') {
      const importedComp = scope.imports.get(entity.name);
      if (importedComp) {
        entity.isImported = true;
        entity.originalModule = importedComp.source;
        if (!entity.relationships) entity.relationships = [];
        entity.relationships.push({
          target: importedComp.source,
          type: 'imports',
          confidence: 1.0
        });
      } else {
        entity.isImported = false;
      }
    }
    
    // ... outros relacionamentos
  }
}
```

---

## 🚀 Plano de Implementação

### Sprint 1: Refatoração estrutural
1. ✅ Criar métodos extractores especializados
2. ✅ Refatorar `extractEntities` para delegação
3. ✅ Adicionar `ExtractionContext`
4. ✅ Testes para nova estrutura

### Sprint 2: Enriquecimento de metadados
1. ✅ Adicionar campos `exportType`, `isImported`, `originalModule`
2. ✅ Implementar categorização aprimorada
3. ✅ Melhorar detecção de builtin APIs
4. ✅ Testes

### Sprint 3: Literais e Confidence
1. ✅ Implementar `extractLiteralEntities`
2. ✅ Implementar sistema de confidence score
3. ✅ Testes

### Sprint 4: Relacionamentos avançados
1. ✅ Implementar `buildScopeMap`
2. ✅ Implementar `enhanceRelationships`
3. ✅ Testes de integração

### Sprint 5: Documentação e validação
1. ✅ Atualizar documentação
2. ✅ Validar com casos reais do workspace
3. ✅ Performance profiling
4. ✅ Release

---

## 📊 Formato de Saída Final

```typescript
{
  type: "function" | "variable" | "component" | "import" | "call" | "literal" | "class" | "interface" | "type",
  name: string,
  category: "internal" | "external" | "builtin" | "jsx",
  source: string,           // Caminho relativo
  line: number,
  column: number,
  confidence: number,       // 0.0 - 1.0, calculado dinamicamente
  
  // Metadados opcionais
  isExported?: boolean,
  exportType?: "default" | "named" | "re-export",
  isImported?: boolean,
  originalModule?: string,
  
  parameters?: Array<{ name: string; type?: string }>,
  returnType?: string,
  variableType?: string,
  initialValue?: string,
  props?: string[],
  callTarget?: string,
  specifiers?: string[],
  
  // Relacionamentos
  relationships?: Array<{
    target: string;
    type: "imports" | "calls" | "extends" | "implements" | "uses";
    confidence: number;
  }>
}
```

---

## ✅ Benefícios da Refatoração

1. **Código mais manutenível**: Separação clara de responsabilidades
2. **Melhor precisão**: Categorização e confidence baseados em contexto
3. **Mais informações**: Literais importantes, exports diferenciados
4. **Relacionamentos ricos**: Grafos de dependência mais completos
5. **Extensível**: Fácil adicionar novos tipos de entidades
6. **Testável**: Extractors isolados facilitam testes unitários

---

## 📝 Notas de Implementação

- Manter retrocompatibilidade com interface `ASTEntity` existente
- Adicionar feature flags para habilitar novos extractors gradualmente
- Implementar cache de scope map para performance
- Adicionar métricas de extração (tempo, entidades por tipo, etc)
- Considerar modo "fast" vs "deep" para controlar nível de análise
