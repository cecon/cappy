# Sistema de Chunking Inteligente - SPEC

> Data: 2025-10-04
> Versão: 1.0
> Status: Implementado

## Visão Geral

O sistema de chunking inteligente divide documentos e código fonte em chunks semânticos menores, preservando contexto e facilitando busca vetorial. Cada chunk mantém informações de localização precisas (startLine/endLine) para referência direta no código fonte.

## Tipos de Chunking Suportados

### 1. Markdown (`.md`, `.mdx`)

**Estratégia**: Chunking por headings (H1-H6)

**Regras**:
- Cada chunk começa em um heading e inclui todo conteúdo até o próximo heading de mesmo nível ou superior
- Headings de nível inferior ficam dentro do chunk do heading pai
- Conteúdo antes do primeiro heading forma um chunk separado
- Preserva hierarquia de headings através de metadata

**Metadados Específicos**:
```typescript
{
    headingLevel?: number;     // 1-6 para H1-H6
    symbolName?: string;       // Texto do heading
}
```

**Exemplo**:
```markdown
# Main Title              ← Chunk 1 inicia (linha 1)
Intro content.

## Section 1             ← Chunk 2 inicia (linha 4)  
Content here.

### Subsection 1.1       ← Continua no Chunk 2
More content.

## Section 2             ← Chunk 3 inicia (linha 11)
Final content.
```

### 2. Código TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)

**Estratégia**: Chunking por blocos lógicos com detecção de estruturas

**Regras**:
- Detecta funções, classes, interfaces, enums, types
- Inclui JSDoc/comentários acima da definição (até 5 linhas)
- Usa contagem de chaves `{}` para determinar fim de bloco
- Código fora de estruturas forma chunks separados

**Padrões de Detecção**:
```typescript
function: /^\s*(export\s+)?(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
class: /^\s*(export\s+)?(abstract\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
interface: /^\s*(export\s+)?interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
enum: /^\s*(export\s+)?enum\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
type: /^\s*(export\s+)?type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
```

**Mapeamento de Tipos**:
- `function` → `code-function`
- `class` → `code-class`  
- `interface` → `code-interface`
- `enum` → `code-enum`
- `type` → `code-type`
- Outros → `code-block`

**Exemplo**:
```typescript
/**
 * Sample class
 */                      ← Incluído no chunk da classe
export class MyClass {   ← Chunk 1 inicia
    method() {
        return true;
    }
}                        ← Chunk 1 termina

function helper() {      ← Chunk 2 inicia  
    return "helper";
}                        ← Chunk 2 termina
```

### 3. Outros Arquivos

**Estratégia**: Chunking baseado em linhas

**Regras**:
- Divide arquivo em blocos de tamanho fixo (default: 100 linhas)
- Preserva boundaries naturais quando possível
- Todos os chunks são do tipo `text-block`

## Limites e Configuração

### Limites Padrão
```typescript
{
    maxLinesPerChunk: 100,        // Máximo de linhas por chunk
    maxTokensPerChunk: 2000,      // Máximo de tokens estimados
    overlapLines: 3,              // Linhas de sobreposição entre chunks
    includeDocstringLines: 5      // Linhas de JSDoc a incluir
}
```

### Estimativa de Tokens
- **Fórmula**: `tokens ≈ caracteres / 4`
- Usado para evitar chunks muito grandes para embedding
- Força quebra de chunk quando limite é atingido

### Overlap (Sobreposição)
- Adiciona contexto entre chunks adjacentes
- Aplicado apenas do chunk anterior para o atual
- Primeiro chunk não recebe overlap
- Ajuda a preservar contexto em boundaries

## Extração de Keywords

### Algoritmo
1. **Keywords de Programação**: `function`, `class`, `const`, `let`, `var`, etc.
2. **Identificadores**: CamelCase, PascalCase, snake_case (min 3 chars)
3. **Strings Literais**: Conteúdo entre aspas (2-50 chars)
4. **Limitação**: Máximo 20 keywords por chunk

### Exemplos
```typescript
// Chunk: "export async function getUserData(id: string): Promise<User>"
// Keywords: ["export", "async", "function", "getuserdata", "string", "promise", "user"]
```

## Schema do Chunk

```typescript
interface Chunk {
    id: string;                    // Hash BLAKE3 (content + posição)
    path: string;                  // Caminho do arquivo
    language: string;              // Linguagem detectada
    type: ChunkType;               // Tipo do chunk
    textHash: string;              // Hash apenas do conteúdo
    text: string;                  // Conteúdo completo
    startLine: number;             // Linha inicial (1-indexed)
    endLine: number;               // Linha final (1-indexed)
    keywords: string[];            // Keywords extraídas
    metadata: ChunkMetadata;       // Metadados específicos do tipo
    updatedAt: string;             // Timestamp ISO-8601
    version: number;               // Versão para atualizações incrementais
}
```

## Detecção de Linguagem

### Mapeamento de Extensões
```typescript
.ts/.tsx    → typescript
.js/.jsx    → javascript  
.md/.mdx    → markdown
.py         → python
.java       → java
.cpp/.c     → cpp/c
.cs         → csharp
.php        → php
.rb         → ruby
.go         → go
.rs         → rust
.json       → json
.yaml/.yml  → yaml
.xml        → xml
.html       → html
.css/.scss  → css/scss
.sql        → sql
*           → text (fallback)
```

## Hashing e Identidade

### BLAKE3 via @noble/hashes
- **Chunk ID**: Hash de `{content, path, startLine, endLine}`
- **Text Hash**: Hash apenas do conteúdo (para detecção de mudanças)
- **Determinístico**: Mesmo input sempre gera mesmo hash
- **Performance**: BLAKE3 é ~3x mais rápido que SHA-256

### Formato
```typescript
// Chunk ID (completo)
hashChunk(content, filePath, startLine, endLine) → "a1b2c3d4..."

// Text Hash (apenas conteúdo)  
hashText(content) → "e5f6g7h8..."
```

## Casos de Uso e Exemplos

### Exemplo 1: Arquivo Markdown Simples
```markdown
# API Documentation

This document describes our API.

## Authentication

Use API keys for authentication.

### JWT Tokens

JWT tokens are preferred.

## Endpoints

Available endpoints below.
```

**Resultado**: 3 chunks
- Chunk 1: "# API Documentation" + intro (linhas 1-3)
- Chunk 2: "## Authentication" + JWT section (linhas 5-9)  
- Chunk 3: "## Endpoints" + content (linhas 11-13)

### Exemplo 2: Classe TypeScript
```typescript
/**
 * User management service
 */
export class UserService {
    private users: User[] = [];

    /**
     * Add a new user
     */
    addUser(user: User): void {
        this.users.push(user);
    }

    /**
     * Find user by ID
     */
    findUser(id: string): User | null {
        return this.users.find(u => u.id === id) || null;
    }
}
```

**Resultado**: 1 chunk
- Chunk 1: Classe completa com JSDoc (linhas 1-19)
- Tipo: `code-class`
- Keywords: ["export", "class", "userservice", "user", "adduser", "finduser", ...]

## Limitações Atuais

### 1. AST Parsing
- **Atual**: Regex básico para detecção de estruturas
- **Futuro**: Parser AST completo para melhor precisão
- **Impacto**: Pode não detectar estruturas complexas/aninhadas

### 2. JSDoc Parsing
- **Atual**: Extração simples de tags `@param`, `@returns`
- **Futuro**: Parser JSDoc/TypeDoc completo
- **Impacto**: Metadados JSDoc podem ser incompletos

### 3. Linguagens Suportadas
- **Atual**: TypeScript/JavaScript com chunking inteligente
- **Futuro**: Python, Java, C++, etc.
- **Impacto**: Outras linguagens usam chunking por linha

### 4. Boundary Detection
- **Atual**: Contagem simples de chaves para fim de função
- **Futuro**: Análise sintática precisa
- **Impacto**: Pode incluir código extra em alguns chunks

## Métricas de Qualidade

### Performance Esperada
- **Throughput**: ~1MB/s de código TypeScript
- **Memory**: ~50MB para projeto médio (1000 arquivos)
- **Latência**: <100ms para arquivos individuais

### Qualidade dos Chunks
- **Coerência**: >90% dos chunks respeitam boundaries semânticas
- **Completude**: >95% das funções/classes ficam em chunks únicos  
- **Keywords**: >80% relevância das keywords extraídas

## Roadmap

### Fase 2
- [ ] Parser AST para TypeScript/JavaScript
- [ ] Suporte a Python, Java, C++
- [ ] JSDoc/TypeDoc parsing completo
- [ ] Chunks para imports/exports

### Fase 3  
- [ ] ML-based chunk boundary detection
- [ ] Support para mais linguagens
- [ ] Chunking adaptativo baseado em contexto
- [ ] Integração com Language Servers

## Conclusão

O sistema de chunking implementado fornece uma base sólida para indexação semântica, com boa precisão para Markdown e código TypeScript/JavaScript. As limitações atuais são conhecidas e estão no roadmap para futuras melhorias.

A combinação de BLAKE3 para hashing, detecção inteligente de boundaries e extração de keywords cria chunks de alta qualidade para busca vetorial e navegação de código.