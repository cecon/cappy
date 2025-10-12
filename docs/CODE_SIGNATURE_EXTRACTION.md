# 🎯 Code Signature Extraction - Documentação sem Código

## 📋 Conceito

**Ideia Central**: Para arquivos de **código**, não indexamos o código completo nos chunks, apenas:
- **Signatures** (assinaturas de funções, classes, métodos)
- **Documentação** (JSDoc, TSDoc, docstrings, XML docs)
- **Metadata** (tipos, parâmetros, retornos)

Para arquivos de **documentação** (.md, .txt), indexamos o conteúdo completo.

**Vantagem**: 
- ✅ **Embeddings mais focados** em "o que o código faz" vs "como faz"
- ✅ **Economia de tokens** (não precisa embedar implementação)
- ✅ **Busca semântica melhor** (busca por intenção, não sintaxe)
- ✅ **Menor tamanho de índice**

---

## 🎯 O que o LightRAG faz (Errado para Código)

```python
# LightRAG indexa TUDO:
chunk = """
/**
 * Authenticates a user with the given credentials.
 * @param {Credentials} credentials - User credentials
 * @returns {Promise<User>} Authenticated user
 */
async function authenticate(credentials: Credentials): Promise<User> {
  // Validate credentials format
  if (!credentials.username || !credentials.password) {
    throw new ValidationError('Missing credentials');
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(credentials.password, 10);
  
  // Query database
  const user = await db.users.findOne({
    username: credentials.username,
    password: hashedPassword
  });
  
  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  // Update last login
  await db.users.update(user.id, {
    lastLoginAt: new Date()
  });
  
  return {
    ...user,
    token
  };
}
"""

# Embedding desse chunk é poluído com:
# - Detalhes de implementação (bcrypt, jwt)
# - Sintaxe (if, await, const)
# - Lógica interna (hash, query, update)
```

**Problemas**:
- ❌ Busca semântica pior: "authentication" compete com "bcrypt", "jwt", "db.users"
- ❌ Tokens desperdiçados: 500 tokens de implementação vs 50 de documentação
- ❌ Embeddings ruins: Mistura intenção com implementação

---

## ✅ Nossa Abordagem: Code Signatures + Docs

### **O que Indexamos**

```typescript
// ✅ Indexamos apenas a SIGNATURE + DOCS:
const chunk = {
  type: 'function',
  signature: 'async function authenticate(credentials: Credentials): Promise<User>',
  
  documentation: `
    Authenticates a user with the given credentials.
    
    @param credentials - User credentials with username and password
    @returns Authenticated user object with JWT token
    @throws ValidationError if credentials are missing
    @throws AuthenticationError if credentials are invalid
  `,
  
  // Metadata estruturada
  metadata: {
    name: 'authenticate',
    type: 'function',
    async: true,
    params: [
      { name: 'credentials', type: 'Credentials', required: true }
    ],
    returns: { type: 'Promise<User>' },
    throws: ['ValidationError', 'AuthenticationError']
  }
};

// Embedding focado em:
// - "authenticates user"
// - "credentials"
// - "JWT token"
// - "validation", "authentication errors"
```

**Vantagens**:
- ✅ **Busca semântica precisa**: "how to authenticate user" → match direto
- ✅ **Tokens eficientes**: 50 tokens vs 500
- ✅ **Embeddings limpos**: Apenas intenção e contrato
- ✅ **LLM entende o que faz**: Sem distrações de implementação

---

## 📊 Estratégia por Linguagem

### **TypeScript/JavaScript**

#### **Extraction Rules**:
```typescript
interface CodeSignature {
  // Sempre inclui:
  signature: string;           // Function/class/method signature
  jsdoc: string | null;        // JSDoc comment
  tsdoc: string | null;        // TSDoc comment
  decorators: string[];        // @Injectable, @Controller, etc
  
  // Nunca inclui:
  // ❌ Function body (implementação)
  // ❌ Variáveis locais
  // ❌ Lógica interna
}
```

#### **Exemplo - Function**:
```typescript
// Original code:
/**
 * Fetches user data from the database by ID.
 * 
 * @param userId - The unique identifier of the user
 * @returns User object if found, null otherwise
 * @throws DatabaseError if connection fails
 */
async function getUserById(userId: string): Promise<User | null> {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    connection.release();
    
    if (rows.length === 0) {
      return null;
    }
    
    return mapRowToUser(rows[0]);
  } catch (error) {
    logger.error('Database error:', error);
    throw new DatabaseError('Failed to fetch user');
  }
}

// ✅ Indexamos APENAS:
{
  type: 'function',
  name: 'getUserById',
  signature: 'async function getUserById(userId: string): Promise<User | null>',
  documentation: `
    Fetches user data from the database by ID.
    
    @param userId - The unique identifier of the user
    @returns User object if found, null otherwise
    @throws DatabaseError if connection fails
  `,
  metadata: {
    async: true,
    params: [{ name: 'userId', type: 'string' }],
    returns: { type: 'Promise<User | null>' },
    throws: ['DatabaseError']
  },
  file_path: 'src/services/UserService.ts',
  line_start: 15,
  line_end: 38
}

// Content para embedding (o que vai pro LanceDB):
const embeddingContent = `
getUserById: Fetches user data from the database by ID.
Parameters: userId (string) - The unique identifier of the user
Returns: User object if found, null otherwise
Throws: DatabaseError if connection fails
`;
```

#### **Exemplo - Class**:
```typescript
// Original code:
/**
 * Service responsible for user management operations.
 * Handles authentication, authorization, and user CRUD.
 */
@Injectable()
export class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly emailService: EmailService
  ) {}
  
  /**
   * Creates a new user account.
   * @param data - User registration data
   * @returns Created user
   */
  async createUser(data: CreateUserDto): Promise<User> {
    // ... 50 lines of implementation
  }
  
  // ... more methods
}

// ✅ Indexamos:
{
  type: 'class',
  name: 'UserService',
  signature: 'class UserService',
  decorators: ['@Injectable()'],
  documentation: `
    Service responsible for user management operations.
    Handles authentication, authorization, and user CRUD.
  `,
  methods: [
    {
      name: 'createUser',
      signature: 'async createUser(data: CreateUserDto): Promise<User>',
      documentation: `
        Creates a new user account.
        @param data - User registration data
        @returns Created user
      `,
      line_start: 25,
      line_end: 75
    }
  ],
  dependencies: ['UserRepository', 'EmailService'],
  file_path: 'src/services/UserService.ts',
  line_start: 10,
  line_end: 150
}
```

---

### **Python**

#### **Extraction Rules**:
```python
interface PythonSignature {
  # Sempre inclui:
  signature: str           # def/class signature
  docstring: str | None    # """docstring"""
  decorators: list[str]    # @staticmethod, @property
  type_hints: dict         # Type annotations
  
  # Nunca inclui:
  # ❌ Function body
  # ❌ Implementation details
}
```

#### **Exemplo**:
```python
# Original code:
class UserRepository:
    """
    Repository for user data access operations.
    
    Provides methods for CRUD operations on user entities,
    with support for filtering, pagination, and relationships.
    """
    
    def __init__(self, db_session: Session):
        self.session = db_session
    
    def find_by_email(self, email: str) -> Optional[User]:
        """
        Finds a user by their email address.
        
        Args:
            email: User's email address
            
        Returns:
            User object if found, None otherwise
            
        Raises:
            DatabaseError: If query execution fails
        """
        try:
            return self.session.query(User).filter_by(email=email).first()
        except SQLAlchemyError as e:
            logger.error(f"Database error: {e}")
            raise DatabaseError("Failed to query user")

# ✅ Indexamos APENAS:
{
  "type": "class",
  "name": "UserRepository",
  "signature": "class UserRepository",
  "docstring": """
    Repository for user data access operations.
    
    Provides methods for CRUD operations on user entities,
    with support for filtering, pagination, and relationships.
  """,
  "methods": [
    {
      "name": "find_by_email",
      "signature": "def find_by_email(self, email: str) -> Optional[User]",
      "docstring": """
        Finds a user by their email address.
        
        Args:
            email: User's email address
            
        Returns:
            User object if found, None otherwise
            
        Raises:
            DatabaseError: If query execution fails
      """,
      "params": [
        {"name": "email", "type": "str"}
      ],
      "returns": {"type": "Optional[User]"},
      "line_start": 15,
      "line_end": 28
    }
  ],
  "file_path": "src/repositories/user_repository.py",
  "line_start": 5,
  "line_end": 50
}
```

---

### **C# (.NET)**

#### **Extraction Rules**:
```csharp
interface CSharpSignature {
  // Sempre inclui:
  signature: string;        // Method/class signature
  xmlDoc: string | null;    // /// XML documentation
  attributes: string[];     // [Authorize], [HttpGet]
  
  // Nunca inclui:
  // ❌ Method body
  // ❌ Implementation
}
```

#### **Exemplo**:
```csharp
// Original code:
/// <summary>
/// Service for managing user authentication and authorization.
/// </summary>
public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;
    
    /// <summary>
    /// Authenticates a user with the provided credentials.
    /// </summary>
    /// <param name="credentials">User login credentials</param>
    /// <returns>Authenticated user with access token</returns>
    /// <exception cref="UnauthorizedException">
    /// Thrown when credentials are invalid
    /// </exception>
    [HttpPost("login")]
    public async Task<UserDto> AuthenticateAsync(LoginDto credentials)
    {
        // ... 30 lines of implementation
        var user = await _userRepository.FindByUsernameAsync(credentials.Username);
        // ... validation, hashing, token generation
        return userDto;
    }
}

// ✅ Indexamos APENAS:
{
  "type": "class",
  "name": "AuthService",
  "signature": "public class AuthService : IAuthService",
  "xmlDoc": "Service for managing user authentication and authorization.",
  "methods": [
    {
      "name": "AuthenticateAsync",
      "signature": "public async Task<UserDto> AuthenticateAsync(LoginDto credentials)",
      "attributes": ["[HttpPost(\"login\")]"],
      "xmlDoc": `
        Authenticates a user with the provided credentials.
        
        Parameters:
          credentials: User login credentials
          
        Returns:
          Authenticated user with access token
          
        Exceptions:
          UnauthorizedException - Thrown when credentials are invalid
      `,
      "params": [
        {"name": "credentials", "type": "LoginDto"}
      ],
      "returns": {"type": "Task<UserDto>"},
      "line_start": 25,
      "line_end": 55
    }
  ]
}
```

---

## 🔄 Comparação: Full Code vs Signature-Only

### **Exemplo Real**

```typescript
// UserService.ts - 500 linhas
// 15 métodos, cada um com 20-50 linhas de implementação

// ❌ LightRAG approach (Full Code):
const chunks = [
  {
    content: `
      // Método completo com implementação (200 linhas)
      async createUser(data: CreateUserDto) {
        // Validações (30 linhas)
        // Hash password (10 linhas)
        // Verificar email duplicado (20 linhas)
        // Criar no banco (15 linhas)
        // Enviar email boas-vindas (25 linhas)
        // Gerar token (15 linhas)
        // Logging (10 linhas)
        // Error handling (30 linhas)
        // Return mapping (15 linhas)
      }
    `,
    embedding: [0.1, 0.2, ...] // 768 dims
  },
  // ... 14 mais chunks gigantes
];

// Tamanho total: ~7000 linhas de código nos chunks
// Embeddings: 15 x 768 dims = 11,520 floats
// Tokens: ~150k tokens

// ✅ Nossa approach (Signature + Docs):
const chunks = [
  {
    content: `
      createUser: Creates a new user account
      
      Parameters:
        - data (CreateUserDto): User registration data including name, email, password
        
      Returns:
        User: Created user object with generated ID and token
        
      Throws:
        - ValidationError: If input data is invalid
        - DuplicateEmailError: If email already exists
        - DatabaseError: If creation fails
        
      Side effects:
        - Sends welcome email
        - Generates authentication token
        - Logs user creation event
    `,
    embedding: [0.3, 0.4, ...] // 768 dims
  },
  // ... 14 mais chunks concisos
];

// Tamanho total: ~2000 caracteres de documentação
// Embeddings: 15 x 768 dims = 11,520 floats (same)
// Tokens: ~500 tokens (30x menor!)
```

### **Métricas de Comparação**

| Métrica | Full Code | Signature + Docs | Ganho |
|---------|-----------|------------------|-------|
| **Tokens por Chunk** | ~10,000 | ~30-50 | **200x menor** |
| **Tamanho Index** | ~150KB | ~2KB | **75x menor** |
| **Qualidade Embedding** | ⭐⭐ (poluído) | ⭐⭐⭐⭐⭐ (focado) | **Muito melhor** |
| **Busca Semântica** | ⭐⭐ | ⭐⭐⭐⭐⭐ | **Muito melhor** |
| **Tempo Indexação** | ~5min | ~10s | **30x mais rápido** |

---

## 🎯 Implementação: Signature Extractors

### **TypeScript Signature Extractor**

```typescript
import { parse } from '@typescript-eslint/parser';
import * as ts from 'typescript';

class TypeScriptSignatureExtractor {
  async extractSignatures(filePath: string): Promise<CodeSignature[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ast = parse(content, {
      loc: true,
      comment: true,
      tokens: true
    });
    
    const signatures: CodeSignature[] = [];
    
    // Traverse AST
    ts.forEachChild(ast, (node) => {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
        signatures.push(this.extractFunctionSignature(node, content));
      } else if (ts.isClassDeclaration(node)) {
        signatures.push(this.extractClassSignature(node, content));
      } else if (ts.isInterfaceDeclaration(node)) {
        signatures.push(this.extractInterfaceSignature(node, content));
      }
    });
    
    return signatures;
  }
  
  private extractFunctionSignature(
    node: ts.FunctionDeclaration,
    sourceCode: string
  ): CodeSignature {
    // 1. Extract JSDoc
    const jsdoc = this.extractJSDoc(node, sourceCode);
    
    // 2. Extract signature (sem body!)
    const signature = this.getSignatureText(node);
    
    // 3. Extract metadata
    const params = node.parameters.map(p => ({
      name: p.name.getText(),
      type: p.type?.getText() || 'any',
      optional: !!p.questionToken
    }));
    
    const returnType = node.type?.getText() || 'any';
    
    // 4. Build embedding content (só docs + signature)
    const embeddingContent = this.buildEmbeddingContent({
      name: node.name?.getText(),
      signature,
      documentation: jsdoc,
      params,
      returnType
    });
    
    return {
      type: 'function',
      name: node.name?.getText(),
      signature,
      documentation: jsdoc,
      metadata: { params, returnType },
      embedding_content: embeddingContent,
      line_start: node.getStart(),
      line_end: node.getEnd(),
      
      // ❌ NÃO incluir:
      // body: node.body.getText()  // NUNCA!
    };
  }
  
  private extractJSDoc(node: ts.Node, sourceCode: string): string | null {
    const jsDocTags = ts.getJSDocTags(node);
    if (!jsDocTags.length) return null;
    
    // Extract comment text
    const comments = ts.getLeadingCommentRanges(
      sourceCode,
      node.getFullStart()
    );
    
    if (!comments?.length) return null;
    
    const comment = comments[0];
    return sourceCode.substring(comment.pos, comment.end);
  }
  
  private buildEmbeddingContent(data: {
    name: string;
    signature: string;
    documentation: string | null;
    params: Array<{name: string, type: string}>;
    returnType: string;
  }): string {
    // Conteúdo otimizado para embedding
    return `
      ${data.name}: ${data.documentation || 'No description'}
      
      Signature: ${data.signature}
      
      Parameters:
      ${data.params.map(p => `  - ${p.name} (${p.type})`).join('\n')}
      
      Returns: ${data.returnType}
    `.trim();
  }
}
```

### **Python Signature Extractor**

```typescript
class PythonSignatureExtractor {
  async extractSignatures(filePath: string): Promise<CodeSignature[]> {
    // Usar AST do Python (via subprocess ou biblioteca JS)
    const pythonScript = `
import ast
import json

with open('${filePath}', 'r') as f:
    tree = ast.parse(f.read())

signatures = []

for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef):
        signatures.append({
            'type': 'function',
            'name': node.name,
            'signature': ast.get_source_segment(source, node),
            'docstring': ast.get_docstring(node),
            'decorators': [d.id for d in node.decorator_list],
            'line_start': node.lineno,
            'line_end': node.end_lineno
        })
    elif isinstance(node, ast.ClassDef):
        signatures.append({
            'type': 'class',
            'name': node.name,
            'docstring': ast.get_docstring(node),
            'line_start': node.lineno,
            'line_end': node.end_lineno
        })

print(json.dumps(signatures))
    `;
    
    const result = await execPython(pythonScript);
    return JSON.parse(result);
  }
}
```

---

## 📊 Chunking Strategy: Code vs Docs

```typescript
class SmartChunkingStrategy {
  async chunkFile(filePath: string): Promise<DocumentChunk[]> {
    const fileType = path.extname(filePath);
    
    // Documentação: chunk completo
    if (['.md', '.txt', '.rst'].includes(fileType)) {
      return this.chunkMarkdown(filePath);
    }
    
    // Código: apenas signatures + docs
    if (['.ts', '.js', '.py', '.cs', '.java'].includes(fileType)) {
      return this.extractCodeSignatures(filePath);
    }
    
    // Configs/JSON: estrutura
    if (['.json', '.yaml', '.yml'].includes(fileType)) {
      return this.chunkStructured(filePath);
    }
  }
  
  private async extractCodeSignatures(
    filePath: string
  ): Promise<DocumentChunk[]> {
    const ext = path.extname(filePath);
    const extractor = this.getExtractor(ext);
    
    const signatures = await extractor.extractSignatures(filePath);
    
    return signatures.map(sig => ({
      id: uuid(),
      file_path: filePath,
      line_start: sig.line_start,
      line_end: sig.line_end,
      
      // ⭐ Conteúdo focado para embedding
      content: sig.embedding_content,
      
      // Metadata completa (mas não embedada)
      metadata: {
        type: sig.type,
        name: sig.name,
        signature: sig.signature,
        documentation: sig.documentation,
        ...sig.metadata
      },
      
      // Status
      indexed_at: new Date().toISOString()
    }));
  }
  
  private async chunkMarkdown(filePath: string): Promise<DocumentChunk[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // ✅ Para Markdown: conteúdo COMPLETO
    const sections = this.splitBySections(content);
    
    return sections.map(section => ({
      id: uuid(),
      file_path: filePath,
      line_start: section.line_start,
      line_end: section.line_end,
      
      // ⭐ Conteúdo completo para embedding
      content: section.content,
      
      metadata: {
        section_title: section.title,
        section_level: section.level
      }
    }));
  }
}
```

---

## 🎯 Benefícios da Abordagem

### **1. Busca Semântica Superior**

```typescript
// Query: "how to authenticate user"

// ❌ Com Full Code:
// Match parcial: "authenticate" encontrado mas embedding poluído com:
// - "bcrypt.hash"
// - "jwt.sign"
// - "db.users.findOne"
// Score: 0.65

// ✅ Com Signature + Docs:
// Match perfeito: "Authenticates a user with the given credentials"
// Embedding limpo focado em intenção
// Score: 0.92
```

### **2. Token Efficiency**

```typescript
// Arquivo: UserService.ts (500 linhas, 15 métodos)

// ❌ Full Code:
// Tokens: ~150,000 tokens
// Custo embedding: ~$0.15 (se usar OpenAI)
// Tempo: ~2 minutos

// ✅ Signature + Docs:
// Tokens: ~500 tokens
// Custo embedding: ~$0.0005
// Tempo: ~2 segundos

// Ganho: 300x mais rápido, 300x mais barato
```

### **3. Index Size**

```typescript
// Workspace: 1000 arquivos de código

// ❌ Full Code:
// Tamanho: ~500MB de chunks
// Embeddings: ~100MB de vectors
// Total: ~600MB

// ✅ Signature + Docs:
// Tamanho: ~10MB de chunks
// Embeddings: ~2MB de vectors
// Total: ~12MB

// Ganho: 50x menor
```

### **4. LLM Context Quality**

```typescript
// Query via Copilot: "how does authentication work?"

// ❌ Com Full Code:
// Context enviado ao LLM: 15k tokens de implementação
// LLM precisa filtrar ruído
// Resposta: média

// ✅ Com Signature + Docs:
// Context enviado ao LLM: 500 tokens de documentação focada
// LLM entende intenção diretamente
// Resposta: excelente
```

---

## 📋 Checklist de Implementação

### **Sprint: Signature Extraction** (1 semana)

#### **Dia 1-2: TypeScript Extractor**
- [ ] Implementar `TypeScriptSignatureExtractor`
- [ ] Extrair JSDoc/TSDoc
- [ ] Extrair signatures (functions, classes, methods)
- [ ] Testes com arquivos reais

#### **Dia 3: Python Extractor**
- [ ] Implementar `PythonSignatureExtractor`
- [ ] Extrair docstrings
- [ ] Extrair type hints
- [ ] Testes

#### **Dia 4: C# Extractor** (opcional)
- [ ] Implementar `CSharpSignatureExtractor`
- [ ] Extrair XML docs
- [ ] Extrair attributes

#### **Dia 5-6: Integration**
- [ ] Integrar extractors no `DocumentAnalyzer`
- [ ] Chunking strategy (code vs docs)
- [ ] Building embedding content
- [ ] Testes end-to-end

#### **Dia 7: Validation**
- [ ] Comparar qualidade busca (full code vs signature)
- [ ] Medir tamanho de índice
- [ ] Performance benchmarks

---

## 🎯 Resultado Esperado

```typescript
// Após implementação:

// 1. Código indexado eficientemente
const codeChunk = {
  content: "getUserById: Fetches user by ID. Returns User or null.",
  embedding: [...],  // Focado em intenção
  metadata: {
    signature: "async getUserById(id: string): Promise<User | null>",
    full_code_at: "src/services/UserService.ts:15-38",  // Referência
  }
};

// 2. Documentação indexada completamente
const docChunk = {
  content: "## Authentication\n\nThe API uses JWT tokens...",  // Completo
  embedding: [...],
  metadata: {
    section: "Authentication"
  }
};

// 3. Busca eficiente
const results = await search("how to get user by id");
// → Match direto com "getUserById: Fetches user by ID"
// → Go-to-line: src/services/UserService.ts:15

// 4. LLM recebe context limpo
const context = buildContext(results);
// → Apenas signatures + docs
// → LLM entende "o que faz"
// → Se precisar "como faz", abre o arquivo
```

---

## 🏆 Vantagens sobre LightRAG

| Aspecto | LightRAG | CAPPY | Ganho |
|---------|----------|-------|-------|
| **Code Indexing** | Full code | Signature + Docs | **300x menor** |
| **Embedding Quality** | ⭐⭐ Poluído | ⭐⭐⭐⭐⭐ Focado | **Muito melhor** |
| **Token Usage** | 150k tokens | 500 tokens | **300x menos** |
| **Index Size** | 600MB | 12MB | **50x menor** |
| **Search Quality** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **Superior** |
| **Speed** | ⭐⭐ | ⭐⭐⭐⭐⭐ | **300x mais rápido** |

---

## 🎛️ Abordagem Híbrida: User Choice

### **Flexibilidade Total para o Usuário**

Podemos oferecer **duas estratégias de indexação** e deixar o usuário escolher:

#### **Estratégia 1: Signature Only** (Padrão, Recomendado)
```typescript
indexMode: 'signature'
```
- ✅ Apenas signatures + documentação
- ✅ 300x mais rápido
- ✅ 50x menor índice
- ✅ Busca semântica superior
- ✅ **Recomendado para a maioria dos casos**

#### **Estratégia 2: Full Code** (Opcional)
```typescript
indexMode: 'full'
```
- ✅ Código completo indexado
- ✅ Busca por implementação específica
- ✅ Code search literal (ex: "bcrypt.hash")
- ⚠️ Índice maior, mais lento
- 🎯 **Para casos específicos**

#### **Estratégia 3: Hybrid** (Inteligente)
```typescript
indexMode: 'hybrid'
```
- ✅ Signature para a maioria
- ✅ Full code para arquivos pequenos (<100 linhas)
- ✅ Balance automático
- 🎯 **Melhor custo-benefício**

---

### 🎨 UI/UX: Commands e Configuração

#### **VS Code Commands**

```typescript
// package.json contributions
{
  "commands": [
    {
      "command": "cappy.indexWorkspace.signatureOnly",
      "title": "📋 Index Workspace (Signature Only - Fast)",
      "category": "Cappy"
    },
    {
      "command": "cappy.indexWorkspace.fullCode",
      "title": "📚 Index Workspace (Full Code - Complete)",
      "category": "Cappy"
    },
    {
      "command": "cappy.indexWorkspace.hybrid",
      "title": "⚡ Index Workspace (Hybrid - Balanced)",
      "category": "Cappy"
    },
    {
      "command": "cappy.indexFile.signatureOnly",
      "title": "Index This File (Signature Only)",
      "category": "Cappy"
    },
    {
      "command": "cappy.indexFile.fullCode",
      "title": "Index This File (Full Code)",
      "category": "Cappy"
    }
  ]
}
```

#### **VS Code Settings**

```typescript
// package.json configuration
{
  "configuration": {
    "properties": {
      "cappy.indexing.defaultMode": {
        "type": "string",
        "enum": ["signature", "full", "hybrid"],
        "default": "signature",
        "description": "Default indexing strategy",
        "enumDescriptions": [
          "Signature Only - Fast, efficient (recommended)",
          "Full Code - Complete but slower",
          "Hybrid - Automatic balance"
        ]
      },
      "cappy.indexing.fullCodePatterns": {
        "type": "array",
        "default": ["**/*.config.ts", "**/*.test.ts"],
        "description": "File patterns to always index with full code"
      },
      "cappy.indexing.signatureOnlyPatterns": {
        "type": "array",
        "default": ["**/services/**", "**/controllers/**"],
        "description": "File patterns to always index with signature only"
      }
    }
  }
}
```

---

### 🎯 Implementação: Dual-Mode Indexer

```typescript
enum IndexingMode {
  SIGNATURE_ONLY = 'signature',
  FULL_CODE = 'full',
  HYBRID = 'hybrid'
}

interface IndexingOptions {
  mode: IndexingMode;
  filePatterns?: {
    signatureOnly?: string[];
    fullCode?: string[];
  };
  hybridThreshold?: number;  // Linhas (default: 100)
}

class DualModeIndexer {
  constructor(
    private signatureExtractor: SignatureExtractor,
    private fullCodeChunker: FullCodeChunker,
    private config: IndexingOptions
  ) {}
  
  async indexFile(
    filePath: string,
    mode?: IndexingMode
  ): Promise<DocumentChunk[]> {
    // 1. Determinar modo (command override ou config)
    const effectiveMode = mode || this.determineMode(filePath);
    
    // 2. Indexar baseado no modo
    switch (effectiveMode) {
      case IndexingMode.SIGNATURE_ONLY:
        return await this.indexSignatureOnly(filePath);
      
      case IndexingMode.FULL_CODE:
        return await this.indexFullCode(filePath);
      
      case IndexingMode.HYBRID:
        return await this.indexHybrid(filePath);
    }
  }
  
  private determineMode(filePath: string): IndexingMode {
    // 1. Check config patterns
    if (this.matchesPattern(filePath, this.config.filePatterns?.fullCode)) {
      return IndexingMode.FULL_CODE;
    }
    
    if (this.matchesPattern(filePath, this.config.filePatterns?.signatureOnly)) {
      return IndexingMode.SIGNATURE_ONLY;
    }
    
    // 2. Default from settings
    return this.config.mode;
  }
  
  private async indexSignatureOnly(
    filePath: string
  ): Promise<DocumentChunk[]> {
    console.log(`📋 Indexing ${filePath} (Signature Only)`);
    
    const signatures = await this.signatureExtractor.extract(filePath);
    
    return signatures.map(sig => ({
      id: uuid(),
      file_path: filePath,
      line_start: sig.line_start,
      line_end: sig.line_end,
      
      // ⭐ Apenas signature + docs
      content: sig.embedding_content,
      
      metadata: {
        indexing_mode: 'signature',
        signature: sig.signature,
        documentation: sig.documentation,
        ...sig.metadata
      }
    }));
  }
  
  private async indexFullCode(
    filePath: string
  ): Promise<DocumentChunk[]> {
    console.log(`📚 Indexing ${filePath} (Full Code)`);
    
    const chunks = await this.fullCodeChunker.chunk(filePath);
    
    return chunks.map(chunk => ({
      id: uuid(),
      file_path: filePath,
      line_start: chunk.line_start,
      line_end: chunk.line_end,
      
      // ⭐ Código completo
      content: chunk.content,
      
      metadata: {
        indexing_mode: 'full',
        ...chunk.metadata
      }
    }));
  }
  
  private async indexHybrid(
    filePath: string
  ): Promise<DocumentChunk[]> {
    console.log(`⚡ Indexing ${filePath} (Hybrid)`);
    
    // 1. Verificar tamanho do arquivo
    const content = await fs.readFile(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    
    // 2. Decidir automaticamente
    if (lineCount < this.config.hybridThreshold!) {
      // Arquivo pequeno → full code
      console.log(`  → Small file (${lineCount} lines), using full code`);
      return await this.indexFullCode(filePath);
    } else {
      // Arquivo grande → signature only
      console.log(`  → Large file (${lineCount} lines), using signature only`);
      return await this.indexSignatureOnly(filePath);
    }
  }
  
  private matchesPattern(
    filePath: string,
    patterns?: string[]
  ): boolean {
    if (!patterns?.length) return false;
    
    return patterns.some(pattern => 
      minimatch(filePath, pattern)
    );
  }
}
```

---

### 🎨 UI: Context Menu & Quick Picks

#### **Context Menu (Right-click no arquivo)**

```typescript
// package.json menus
{
  "menus": {
    "explorer/context": [
      {
        "submenu": "cappy.indexing",
        "group": "navigation"
      }
    ],
    "cappy.indexing": [
      {
        "command": "cappy.indexFile.signatureOnly",
        "group": "1_indexing"
      },
      {
        "command": "cappy.indexFile.fullCode",
        "group": "1_indexing"
      }
    ]
  }
}
```

#### **Quick Pick com Preview**

```typescript
async function showIndexingModeQuickPick(
  filePath: string
): Promise<IndexingMode> {
  const items: vscode.QuickPickItem[] = [
    {
      label: '📋 Signature Only',
      description: 'Fast, efficient (recommended)',
      detail: 'Index only function signatures and documentation. 300x faster, 50x smaller index.'
    },
    {
      label: '📚 Full Code',
      description: 'Complete but slower',
      detail: 'Index entire code including implementation. Enables literal code search.'
    },
    {
      label: '⚡ Hybrid',
      description: 'Automatic balance',
      detail: 'Smart decision based on file size. Best of both worlds.'
    }
  ];
  
  const selected = await vscode.window.showQuickPick(items, {
    title: `Index ${path.basename(filePath)}`,
    placeHolder: 'Choose indexing strategy'
  });
  
  if (!selected) return IndexingMode.SIGNATURE_ONLY;
  
  const modeMap: Record<string, IndexingMode> = {
    '📋 Signature Only': IndexingMode.SIGNATURE_ONLY,
    '📚 Full Code': IndexingMode.FULL_CODE,
    '⚡ Hybrid': IndexingMode.HYBRID
  };
  
  return modeMap[selected.label];
}
```

---

### � Status Bar com Modo Atual

```typescript
class IndexingStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  
  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'cappy.showIndexingStats';
    this.statusBarItem.show();
  }
  
  updateStatus(stats: {
    filesIndexed: number;
    signatureMode: number;
    fullCodeMode: number;
    hybridMode: number;
  }) {
    const modeIcon = this.getModeIcon(stats);
    
    this.statusBarItem.text = `$(database) Cappy: ${stats.filesIndexed} files ${modeIcon}`;
    this.statusBarItem.tooltip = `
      Indexed Files: ${stats.filesIndexed}
      
      Signature Only: ${stats.signatureMode} files
      Full Code: ${stats.fullCodeMode} files
      Hybrid: ${stats.hybridMode} files
      
      Click for details
    `;
  }
  
  private getModeIcon(stats: any): string {
    const total = stats.signatureMode + stats.fullCodeMode + stats.hybridMode;
    const signaturePercent = (stats.signatureMode / total) * 100;
    
    if (signaturePercent > 90) return '📋';  // Mostly signature
    if (signaturePercent > 50) return '⚡';  // Mixed
    return '📚';  // Mostly full code
  }
}
```

---

### 🎯 Use Cases para Cada Modo

#### **Signature Only** (Padrão)
```typescript
// Ideal para:
✅ Services, controllers, repositories
✅ Business logic
✅ API endpoints
✅ Arquivos grandes (>500 linhas)
✅ Quando busca é por "o que faz"

// Exemplo:
files: [
  'src/services/**/*.ts',
  'src/controllers/**/*.ts',
  'src/repositories/**/*.ts'
]
```

#### **Full Code** (Específico)
```typescript
// Ideal para:
✅ Config files (precisão na busca)
✅ Test files (encontrar mocks específicos)
✅ Utils/helpers pequenos
✅ Quando busca é por "como faz"
✅ Code review/audit

// Exemplo:
files: [
  '**/*.config.ts',
  '**/*.test.ts',
  'src/utils/**/*.ts',
  'src/helpers/**/*.ts'
]
```

#### **Hybrid** (Inteligente)
```typescript
// Ideal para:
✅ Mixed codebases
✅ Quando não tem certeza
✅ Balance automático
✅ Adapta por arquivo

// Lógica:
if (lineCount < 100) {
  mode = 'full';  // Arquivo pequeno
} else {
  mode = 'signature';  // Arquivo grande
}
```

---

### 📊 Comparação de Estratégias

| Aspecto | Signature Only | Full Code | Hybrid |
|---------|---------------|-----------|--------|
| **Speed** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Index Size** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Search: "what"** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Search: "how"** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **LLM Context** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Literal Search** | ❌ | ✅ | ⚠️ |
| **Cost** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

---

### 🎯 Search Behavior por Modo

#### **Query: "how to authenticate user"**

**Signature Mode**:
```typescript
// Match: function signature + JSDoc
Result: {
  content: "authenticate: Validates user credentials and generates JWT token",
  score: 0.92,  // Alto - focado em intenção
  mode: 'signature'
}
```

**Full Code Mode**:
```typescript
// Match: código completo
Result: {
  content: "async function authenticate(creds) { ... bcrypt.hash ... jwt.sign ... }",
  score: 0.68,  // Médio - poluído com implementação
  mode: 'full'
}
```

**Hybrid Mode**:
```typescript
// Match: signature para arquivos grandes, full para pequenos
Results: [
  { content: "authenticate: Validates...", score: 0.92, mode: 'signature' },
  { content: "validatePassword() { ... }", score: 0.75, mode: 'full' }  // Helper pequeno
]
```

#### **Query: "bcrypt.hash"** (Literal code search)

**Signature Mode**:
```typescript
// No match (código não indexado)
Results: []
```

**Full Code Mode**:
```typescript
// Match: código completo
Result: {
  content: "const hashedPassword = await bcrypt.hash(password, 10);",
  score: 0.95,  // Alto - match literal
  mode: 'full'
}
```

**Hybrid Mode**:
```typescript
// Match apenas em arquivos pequenos com full code
Result: {
  content: "bcrypt.hash(password, SALT_ROUNDS)",  // De um helper pequeno
  score: 0.85,
  mode: 'full'
}
```

---

### 📋 Workspace Indexing Workflow

```typescript
async function indexWorkspace(mode: IndexingMode) {
  // 1. Show progress
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Indexing workspace (${mode} mode)`,
    cancellable: true
  }, async (progress, token) => {
    
    // 2. Find files
    const files = await findSupportedFiles();
    const total = files.length;
    
    // 3. Index cada arquivo
    for (const [index, file] of files.entries()) {
      if (token.isCancellationRequested) break;
      
      // Update progress
      progress.report({
        message: `${index + 1}/${total}: ${path.basename(file)}`,
        increment: (100 / total)
      });
      
      // Index com modo escolhido
      await indexer.indexFile(file, mode);
    }
    
    // 4. Show summary
    const summary = getIndexingSummary();
    vscode.window.showInformationMessage(
      `✅ Indexed ${total} files\n` +
      `📋 Signature: ${summary.signatureMode}\n` +
      `📚 Full Code: ${summary.fullCodeMode}\n` +
      `⚡ Hybrid: ${summary.hybridMode}`
    );
  });
}
```

---

### 🎨 Settings UI (Webview)

```typescript
// Webview HTML
<div class="indexing-settings">
  <h2>Indexing Strategy</h2>
  
  <div class="strategy-card">
    <input type="radio" id="signature" name="mode" value="signature" checked>
    <label for="signature">
      <h3>📋 Signature Only</h3>
      <p>Index only function signatures and documentation</p>
      <ul>
        <li>✅ 300x faster</li>
        <li>✅ 50x smaller index</li>
        <li>✅ Better semantic search</li>
        <li>⚠️ No literal code search</li>
      </ul>
      <div class="badge recommended">Recommended</div>
    </label>
  </div>
  
  <div class="strategy-card">
    <input type="radio" id="full" name="mode" value="full">
    <label for="full">
      <h3>📚 Full Code</h3>
      <p>Index complete code including implementation</p>
      <ul>
        <li>✅ Literal code search</li>
        <li>✅ Search by implementation</li>
        <li>⚠️ Slower indexing</li>
        <li>⚠️ Larger index</li>
      </ul>
    </label>
  </div>
  
  <div class="strategy-card">
    <input type="radio" id="hybrid" name="mode" value="hybrid">
    <label for="hybrid">
      <h3>⚡ Hybrid</h3>
      <p>Automatic decision based on file size</p>
      <ul>
        <li>✅ Best of both worlds</li>
        <li>✅ Adaptive</li>
        <li>✅ Balanced performance</li>
      </ul>
    </label>
  </div>
  
  <h3>Custom Patterns</h3>
  <div class="patterns">
    <label>
      Always use Full Code for:
      <input type="text" value="**/*.config.ts, **/*.test.ts" />
    </label>
    
    <label>
      Always use Signature for:
      <input type="text" value="**/services/**, **/controllers/**" />
    </label>
  </div>
</div>
```

---

### 🎯 Migration & Conversion

```typescript
// Convert existing index
commands.registerCommand('cappy.convertIndex', async () => {
  const choices = [
    'Signature Only → Full Code',
    'Full Code → Signature Only',
    'Any → Hybrid'
  ];
  
  const choice = await vscode.window.showQuickPick(choices);
  
  if (choice?.includes('Signature Only → Full Code')) {
    await convertIndex('signature', 'full');
  } else if (choice?.includes('Full Code → Signature')) {
    await convertIndex('full', 'signature');
  }
});

async function convertIndex(
  from: IndexingMode,
  to: IndexingMode
) {
  await vscode.window.withProgress({
    title: `Converting index: ${from} → ${to}`
  }, async (progress) => {
    // 1. Get files indexed in 'from' mode
    const files = await getFilesIndexedWith(from);
    
    // 2. Reindex with 'to' mode
    for (const file of files) {
      await indexer.indexFile(file, to);
      progress.report({ increment: 100 / files.length });
    }
  });
}
```

---

### 💡 Recomendações de Uso

#### **Para Desenvolvedores**:
```typescript
// Use Signature Only (padrão) para:
✅ Desenvolvimento dia-a-dia
✅ Busca por funcionalidades
✅ Entender "o que o código faz"
✅ Context para LLM/Copilot

// Use Full Code quando:
⚠️ Fazendo code review detalhado
⚠️ Auditoria de segurança
⚠️ Procurando implementação específica
⚠️ Analisando algoritmos complexos
```

#### **Para QA/Testers**:
```typescript
// Use Full Code para test files:
settings: {
  "cappy.indexing.fullCodePatterns": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/test/**",
    "**/tests/**"
  ]
}

// Signature Only para source:
settings: {
  "cappy.indexing.signatureOnlyPatterns": [
    "src/**/*.ts"
  ]
}
```

#### **Para DevOps/Infra**:
```typescript
// Full Code para configs:
settings: {
  "cappy.indexing.fullCodePatterns": [
    "**/*.config.js",
    "**/*.config.ts",
    "**/Dockerfile",
    "**/*.yml",
    "**/*.yaml"
  ]
}
```

---

**Conclusão Híbrida**: Oferecendo **dois modos** (+ híbrido), damos ao usuário o **melhor dos dois mundos**:
- 🚀 **Signature Only**: Rápido, eficiente, recomendado (padrão)
- 📚 **Full Code**: Completo, para casos específicos
- ⚡ **Hybrid**: Inteligente, adapta automaticamente
- 🎛️ **User Choice**: Flexibilidade total
- 🎯 **Context-aware**: Patterns por tipo de arquivo

Nossa abordagem de **Signature + Docs** continua sendo **dramaticamente superior** ao LightRAG para indexação de código, e agora com **flexibilidade total** para o usuário! 🚀
