# FORGE Stack Instructions Setup

## 🚀 **Initial Setup Flow**

### **Trigger**: First time FORGE initialization

When `initForge` command is executed, check for stack-specific instructions:

1. **Check for existing stack-instructions.md**
2. **If NOT found** → Start Stack Configuration Questionnaire
3. **If found** → Load existing configuration
4. **Update copilot-instructions.md** with stack-specific content

## 📋 **Stack Configuration Questionnaire**

### **Question 1: Primary Language/Runtime** 🎯
```
🎯 **Qual é a linguagem/runtime principal do projeto?**

Opções comuns:
a) TypeScript/Node.js
b) Python  
c) Rust
d) Java/Kotlin
e) C#/.NET
f) Go
g) PHP
h) Ruby
i) Outro: [especificar]
```

### **Question 2: Framework Principal** 🔧
```
🔧 **Qual framework/biblioteca principal você está usando?**

Para TypeScript/Node.js:
a) Express + REST API
b) Next.js (React Full-Stack)
c) NestJS (Enterprise)
d) Fastify (High Performance)
e) Outro: [especificar]

Para Python:
a) FastAPI (Modern API)
b) Django (Full Framework)
c) Flask (Microframework)
d) Outro: [especificar]

[Similar options for other languages...]
```

### **Question 3: Architecture Pattern** 🏗️
```
🏗️ **Qual padrão arquitetural você prefere?**

a) REST API (stateless, CRUD operations)
b) GraphQL API (flexible queries)
c) Microservices (distributed)
d) Monolithic (single deployable)
e) Event-driven (async messaging)
f) Outro: [especificar]
```

### **Question 4: Code Style & Quality** ✨
```
✨ **Quais ferramentas de qualidade de código você usa?**

Linting/Formatting:
☐ ESLint (JavaScript/TypeScript)
☐ Prettier (Code formatting)
☐ Black (Python formatting)
☐ Rustfmt (Rust formatting)
☐ Outro: [especificar]

Padrões:
☐ Airbnb Style Guide
☐ Google Style Guide
☐ Standard JS
☐ Custom rules
```

### **Question 5: Testing Strategy** 🧪
```
🧪 **Qual é sua estratégia de testes?**

Unit Testing:
☐ Jest (JavaScript/TypeScript)
☐ Vitest (Vite ecosystem)
☐ PyTest (Python)
☐ Cargo Test (Rust)
☐ JUnit (Java)

Integration/E2E:
☐ Cypress
☐ Playwright
☐ Supertest
☐ Postman/Newman
```

## 🎨 **Stack-Instructions Template Generation**

### **Template: TypeScript + Express + REST**
```markdown
# Stack-Specific Instructions - TypeScript Express API

## 🎯 **Project Stack**
- **Primary**: TypeScript + Node.js
- **Framework**: Express.js
- **Pattern**: REST API
- **Database**: [AUTO-DETECTED or CONFIGURED]

## 📝 **Code Style & Standards**
- **Linting**: ESLint with Airbnb config
- **Formatting**: Prettier with 2-space indentation
- **Imports**: Absolute imports from src/
- **Naming**: camelCase for variables, PascalCase for classes

### TypeScript Conventions:
```typescript
// ✅ DO: Explicit types for public APIs
export interface UserResponse {
  id: string;
  email: string;
  createdAt: Date;
}

// ✅ DO: Use Result pattern for error handling  
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// ❌ DON'T: Any types
function process(data: any): any { }
```

## 🧪 **Testing Requirements**
- **Framework**: Jest + Supertest
- **Coverage**: Minimum 80%
- **Structure**: 
  - Unit tests: `src/**/*.test.ts`
  - Integration: `tests/integration/*.test.ts`

### Test Patterns:
```typescript
// ✅ DO: AAA Pattern (Arrange, Act, Assert)
describe('UserService', () => {
  it('should create user with valid email', async () => {
    // Arrange
    const userData = { email: 'test@example.com', name: 'Test' };
    
    // Act
    const result = await userService.create(userData);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.data.email).toBe(userData.email);
  });
});
```

## 🗄️ **Database & Persistence**
- **ORM**: [AUTO-DETECTED: Prisma, TypeORM, Sequelize]
- **Migrations**: Use ORM migration tools, never manual SQL files
- **Validation**: Zod for runtime type checking

## 🔧 **API Design Standards**
- **REST conventions**: 
  - GET /users (list)
  - POST /users (create)
  - GET /users/:id (retrieve)
  - PUT /users/:id (update)
  - DELETE /users/:id (delete)
- **Status codes**: 200, 201, 400, 401, 403, 404, 500
- **Response format**: Consistent JSON structure

## 🚨 **Stack-Specific DON'Ts**
- ❌ DON'T use `any` type
- ❌ DON'T ignore TypeScript errors
- ❌ DON'T use `require()` in TypeScript files
- ❌ DON'T forget input validation
- ❌ DON'T expose internal errors to API responses
```

### **Template: Python + FastAPI**
```markdown
# Stack-Specific Instructions - Python FastAPI

## 🎯 **Project Stack**
- **Primary**: Python 3.11+
- **Framework**: FastAPI
- **Pattern**: REST API with automatic docs
- **Database**: [AUTO-DETECTED: SQLAlchemy, Tortoise]

## 📝 **Code Style & Standards**
- **Formatting**: Black with 88-char line length
- **Linting**: Ruff for fast linting
- **Type hints**: Required for all functions
- **Imports**: Absolute imports, isort for organization

### Python Conventions:
```python
# ✅ DO: Type hints everywhere
from typing import Optional, List
from pydantic import BaseModel

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime

async def get_user(user_id: int) -> Optional[UserResponse]:
    # Implementation
    pass

# ❌ DON'T: Missing type hints
def process_data(data):
    return data
```

## 🧪 **Testing Requirements**
- **Framework**: PyTest + httpx
- **Coverage**: Minimum 80%
- **Structure**:
  - Unit tests: `tests/unit/`
  - Integration: `tests/integration/`

## 🗄️ **Database & Persistence**
- **ORM**: SQLAlchemy 2.0+ with async support
- **Migrations**: Alembic (never manual files)
- **Validation**: Pydantic models for all I/O

## 🚨 **Stack-Specific DON'Ts**
- ❌ DON'T create migration files manually
- ❌ DON'T use mutable default arguments
- ❌ DON'T ignore type hints
- ❌ DON'T use global variables for state
- ❌ DON'T forget async/await consistency
```

## 🤖 **LLM Integration Process**

### **Step 1: Detect Stack Configuration**
```
1. Check if forgeConfig.json exists
2. Check if stack-instructions.md exists  
3. If either missing → Start questionnaire
4. If both present → Load configuration
```

### **Step 2: Generate Stack Instructions**
```
1. Use questionnaire responses
2. Select appropriate template
3. Customize with project-specific details
4. Create .github/stack-instructions.md
5. Update forgeConfig.json with stack info
```

### **Step 3: Update Copilot Instructions**
```
Instead of hardcoded "Use TypeScript":

## Stack-Specific Guidelines
{LOAD_FROM: .github/stack-instructions.md}

This ensures copilot-instructions.md always reflects the actual project stack.
```

## 📂 **File Structure After Setup**
```
project/
├── .github/
│   ├── copilot-instructions.md (references stack-instructions)
│   └── stack-instructions.md (generated from questionnaire)
├── src/
│   └── forgeConfig.json (includes stack configuration)
└── steps/ (FORGE methodology folders)
```

## 🔄 **Stack Configuration Updates**

### **Command: Update Stack**
```
User: "quero atualizar a configuração de stack"

LLM: 
1. Show current stack configuration
2. Ask what needs to be changed
3. Update stack-instructions.md
4. Regenerate relevant sections in copilot-instructions.md
```

### **Auto-Detection Improvements**
```
Scan project files to suggest stack:
- package.json → Node.js/TypeScript
- requirements.txt → Python
- Cargo.toml → Rust
- pom.xml → Java
- go.mod → Go

Ask for confirmation: "Detectei TypeScript + Express. Está correto?"
```
