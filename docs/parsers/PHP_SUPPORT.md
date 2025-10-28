# Suporte a PHP no Cappy Framework

## Visão Geral

O Cappy Framework agora suporta análise de projetos PHP através de um parser dedicado que extrai documentação PHPDoc diretamente do código-fonte.

## Características

### ✅ Parser PHP Implementado

- **Extração de PHPDoc**: Captura todos os blocos de documentação `/** ... */`
- **Símbolos Suportados**:
  - Classes (`class`)
  - Interfaces (`interface`)
  - Traits (`trait`)
  - Funções (`function`)
  - Métodos (`public/private/protected function`)
  - Propriedades (`public/private/protected $property`)
  - Constantes (`const`)

### 🎯 Detecção de Visibilidade

O parser identifica automaticamente a visibilidade de métodos e propriedades:
- `public`
- `private`
- `protected`

### 📦 Chunks Gerados

Cada símbolo documentado gera um chunk com:
- **ID único**: `chunk:filename.php:lineStart-lineEnd`
- **Conteúdo**: O bloco PHPDoc completo
- **Metadados**:
  - `filePath`: Caminho do arquivo
  - `lineStart` / `lineEnd`: Localização no arquivo
  - `chunkType`: `'phpdoc'`
  - `symbolName`: Nome do símbolo
  - `symbolKind`: Tipo do símbolo
  - `visibility`: Visibilidade (quando aplicável)

## Estratégia de Varredura

### Ordem de Processamento

O scanner foi otimizado para processar arquivos em ordem inteligente:

1. **Primeiro: Código-fonte** (não requer LLM)
   - TypeScript (`.ts`, `.tsx`)
   - JavaScript (`.js`, `.jsx`)
   - **PHP (`.php`)**

2. **Depois: Documentação** (pode usar LLM)
   - Markdown (`.md`, `.mdx`)
   - PDFs (`.pdf`)
   - Word (`.doc`, `.docx`)

### Vantagens

- ⚡ **Performance**: Código-fonte é processado rapidamente via AST
- 💰 **Economia**: Reduz uso de LLM processando código primeiro
- 🎯 **Contexto**: Documentação pode referenciar código já indexado

## Exemplo de Uso

### Código PHP de Exemplo

```php
<?php

namespace App\Services;

/**
 * Service for handling user authentication
 * 
 * This service provides methods for user registration, login,
 * and password management.
 * 
 * @package App\Services
 * @author Cappy Team
 */
class AuthService
{
    /**
     * Registers a new user in the system
     * 
     * @param array $data User registration data
     * @return User The newly created user
     */
    public function register(array $data): User
    {
        // Implementation
    }

    /**
     * Authenticates a user
     * 
     * @param string $email User email
     * @param string $password Password
     * @return User|null Authenticated user or null
     */
    public function login(string $email, string $password): ?User
    {
        // Implementation
    }
}
```

### Chunks Extraídos

```typescript
[
  {
    id: "chunk:AuthService.php:7-18",
    content: "/**\n * Service for handling user authentication\n * ...",
    metadata: {
      filePath: "src/Services/AuthService.php",
      lineStart: 7,
      lineEnd: 18,
      chunkType: "phpdoc",
      symbolName: "AuthService",
      symbolKind: "class"
    }
  },
  {
    id: "chunk:AuthService.php:19-25",
    content: "/**\n * Registers a new user in the system\n * ...",
    metadata: {
      filePath: "src/Services/AuthService.php",
      lineStart: 19,
      lineEnd: 25,
      chunkType: "phpdoc",
      symbolName: "register",
      symbolKind: "method",
      visibility: "public"
    }
  },
  // ... mais chunks
]
```

## Integração com Parser Service

O `ParserService` detecta automaticamente arquivos PHP:

```typescript
// Em parser-service.ts
case '.php':
  console.log(`🐘 Parsing PHP: ${filePath}`);
  return await this.phpParser.parseFile(filePath);
```

## Detecção de Linguagem

O scanner identifica arquivos PHP automaticamente:

```typescript
// Em workspace-scanner.ts
const languageMap: Record<string, string> = {
  '.php': 'php',
  // ... outras linguagens
};
```

## Tipos Atualizados

### ChunkType

```typescript
export type ChunkType = 
  | 'jsdoc' 
  | 'phpdoc'    // ✨ Novo
  | 'markdown_section' 
  | 'code' 
  | 'plain_text' 
  | 'document_section';
```

### SymbolKind

```typescript
symbolKind?: 
  | 'function' 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'variable'
  | 'trait'      // ✨ Novo (PHP)
  | 'method'     // ✨ Novo
  | 'property'   // ✨ Novo
  | 'constant';  // ✨ Novo
```

### ChunkMetadata

```typescript
interface ChunkMetadata {
  // ... campos existentes
  visibility?: 'public' | 'private' | 'protected';  // ✨ Novo
}
```

## Testando o Parser PHP

Execute o teste:

```bash
npm run build
node dist/test-php-parser.js
```

Ou via VS Code tasks após compilação.

## Padrões de PHPDoc Suportados

O parser reconhece:

### Blocos de Documentação
```php
/**
 * Description
 * 
 * @param type $name Description
 * @return type Description
 * @throws Exception Description
 */
```

### Declarações Suportadas
```php
// Classes
abstract class MyClass { }
final class MyClass { }
class MyClass { }

// Interfaces
interface MyInterface { }

// Traits
trait MyTrait { }

// Funções
function myFunction() { }

// Métodos
public function publicMethod() { }
private function privateMethod() { }
protected function protectedMethod() { }
public static function staticMethod() { }

// Propriedades
public $property;
private $property;
protected $property;
public static $property;
public readonly $property;

// Constantes
const MY_CONSTANT = 'value';
public const MY_CONSTANT = 'value';
```

## Limitações Conhecidas

1. **Regex-based**: Usa regex em vez de AST completo (por simplicidade)
2. **PHP 7.4+**: Melhor suporte para sintaxe moderna
3. **Namespaces**: Detectados mas não totalmente analisados
4. **Atributos**: PHP 8+ attributes são reconhecidos mas não processados

## Próximos Passos

- [ ] Parser AST completo usando `php-parser` (opcional)
- [ ] Extração de relacionamentos entre classes
- [ ] Suporte a namespaces no grafo
- [ ] Detecção de dependências via `use` statements
- [ ] Análise de herança e traits

## Arquivos Modificados

### Novos Arquivos
- `src/adapters/secondary/parsers/php-parser.ts` - Parser PHP
- `test-samples/test-php-parser.php` - Exemplo de teste
- `test-php-parser.ts` - Script de teste

### Arquivos Atualizados
- `src/types/chunk.ts` - Tipos expandidos para PHP
- `src/services/parser-service.ts` - Integração do parser PHP
- `src/services/workspace-scanner.ts` - Ordem de processamento otimizada

---

**Data**: 22/10/2025  
**Versão**: 3.0.0+php  
**Status**: ✅ Implementado e Testado
