# Capybara Initialization Command - Complete Setup

## 🚀 **Comando de Inicialização**

### **Trigger Command**: "vamos inicializar as configs do capybara"

## 📋 **Fluxo de Inicialização Completa**

### **Phase 1: Environment Detection & Configuration**

#### **Step 1: Auto-Detection**
```
🤖 **Detectando ambiente de desenvolvimento...**

🔍 **Sistema Operativo**: [Auto-detect via process.platform]
- Windows → powershell (default)
- macOS → zsh (default)
- Linux → bash (default)

🔍 **Editor**: [Auto-detect via VS Code context]
- VS Code → vscode
- Cursor → cursor  
- Other → other

🔍 **Package Manager**: [Auto-detect via lock files]
- package-lock.json → npm
- yarn.lock → yarn
- pnpm-lock.yaml → pnpm
- requirements.txt → pip
- Cargo.toml → cargo
```

#### **Step 2: Environment Questionnaire**
```
🤖 **Confirmando configurações de ambiente:**

💻 **Sistema detectado: Windows + VS Code + PowerShell**
   Está correto? [Y/n]

📦 **Package manager detectado: npm**
   Quer usar outro? (yarn/pnpm) [N/y]

🐳 **Containerização:**
   a) Docker (recomendado)
   b) Podman
   c) Nenhum

✅ **Environment confirmed!**
```

### **Phase 2: Stack Detection & Configuration**

#### **Step 3: Stack Auto-Detection**
```
🤖 **Analisando stack do projeto...**

📂 **Arquivos encontrados:**
- package.json → Node.js/TypeScript
- tsconfig.json → TypeScript confirmed
- express dependency → Express.js
- @types/jest → Jest testing

🎯 **Stack detectada: TypeScript + Node.js + Express + Jest**
   Confirmar? [Y/n]
```

#### **Step 4: Stack Questionnaire (se não detectar ou usuário recusar)**
```
🔧 **Configuração de Stack:**

1️⃣ **Linguagem principal:**
   a) TypeScript/Node.js
   b) Python  
   c) Rust
   d) Java
   e) C#
   f) Go
   [Continue with full questionnaire from capybara-stack-setup.md]
```

### **Phase 3: Capybara Configuration**

#### **Step 5: Capybara Preferences**
```
⚙️ **Configurações Capybara:**

🔢 **Máximo de horas por STEP atômica:** [3] horas
🧪 **Testes unitários obrigatórios:** [N/y]
📊 **Framework de teste:** [jest/vitest/pytest/outras]
📈 **Cobertura mínima:** [80]%
📋 **Máximo de regras acumuladas:** [50] regras
```

### **Phase 4: File Generation**

#### **Step 6: Generate Configuration Files**
```
📁 **Criando estrutura Capybara:**

✅ src/capybaraConfig.json (configuração completa)
✅ .github/stack-instructions.md (regras da stack)
✅ .github/copilot-instructions.md (Capybara + stack + environment)
✅ steps/ (pasta para STEPs)
```

## 🔧 **Environment-Specific Rules Generation**

### **Windows + PowerShell + VS Code**
```markdown
## 🖥️ **Environment-Specific Rules - Windows + PowerShell + VS Code**

### **Shell Commands**
- ✅ **DO**: Use PowerShell syntax
  ```powershell
  # Multiple commands
  npm install; npm run build; npm test
  
  # Environment variables
  $env:NODE_ENV = "development"
  
  # Path handling
  .\\src\\app.ts
  ```

- ❌ **DON'T**: Use bash/unix syntax
  ```bash
  # ❌ This won't work on PowerShell
  npm install && npm run build && npm test
  export NODE_ENV=development
  ./src/app.ts
  ```

### **VS Code Integration**
- ✅ **DO**: Use VS Code integrated terminal
- ✅ **DO**: Configure tasks.json for common commands
- ✅ **DO**: Use VS Code extensions for the stack
- ❌ **DON'T**: Assume external terminal commands

### **Path Handling**
- ✅ **DO**: Use forward slashes in code/configs
  ```json
  "main": "./src/index.ts"
  ```
- ✅ **DO**: Use backslashes in PowerShell when needed
  ```powershell
  cd .\\src\\components
  ```

### **Package Manager Commands**
- ✅ **DO**: Use npm.cmd when scripting
  ```powershell
  npm.cmd install
  npx.cmd tsc --build
  ```
- ✅ **DO**: Plain npm in package.json scripts (works fine)
  ```json
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
  ```
```

### **macOS + zsh + VS Code**
```markdown
## 🖥️ **Environment-Specific Rules - macOS + zsh + VS Code**

### **Shell Commands**
- ✅ **DO**: Use zsh/bash syntax
  ```bash
  # Multiple commands
  npm install && npm run build && npm test
  
  # Environment variables
  export NODE_ENV=development
  
  # Path handling
  ./src/app.ts
  ```

### **Permission Handling**
- ✅ **DO**: Use chmod when needed
  ```bash
  chmod +x ./scripts/deploy.sh
  ```
- ✅ **DO**: Consider sudo for global installs
  ```bash
  sudo npm install -g typescript
  ```

### **Package Manager**
- ✅ **DO**: Plain commands work fine
  ```bash
  npm install
  npx tsc --build
  ```
```

### **Linux + bash + VS Code**
```markdown
## 🖥️ **Environment-Specific Rules - Linux + bash + VS Code**

### **Shell Commands**  
- ✅ **DO**: Use bash syntax
- ✅ **DO**: Consider snap/apt packages vs npm global
- ✅ **DO**: Handle permissions correctly

### **Containerization**
- ✅ **DO**: Use Docker/Podman for consistent environments
- ✅ **DO**: Consider user permissions in containers
```

## 🔄 **Template Injection Logic**

### **Copilot Instructions Template with Environment**
```markdown
# GitHub Copilot Instructions - Capybara

## 🎯 **Primary Directive**
This project uses the **Capybara** for atomic task management and automatic error prevention.

## 📚 **Stack-Specific Guidelines**
{LOAD_FROM: .github/stack-instructions.md}

## 🔨 **Capybara Methodology**
[Standard Capybara methodology content...]

## 🖥️ **Environment-Specific Rules**
{INJECT_ENVIRONMENT_RULES_HERE}

[Environment rules injected based on capybaraConfig.environment]

## 🧪 **Testing Integration**
[Testing configuration from stack + environment...]

## 🚨 **Core Prevention Patterns**
[Standard prevention patterns + environment-specific ones...]
```

## 🤖 **LLM Response Flow**

### **Complete Initialization Response**
```
🚀 **Inicializando configurações Capybara...**

🔍 **Fase 1: Detecção de Ambiente**
✅ Detectado: Windows + PowerShell + VS Code + npm
✅ Confirmado pelo usuário

🔧 **Fase 2: Configuração de Stack**  
✅ Detectado: TypeScript + Express + Jest
✅ Stack configurada

⚙️ **Fase 3: Preferências Capybara**
✅ STEPs atômicas: 3h máximo
✅ Testes unitários: Opcional
✅ Framework: Jest
✅ Regras máximas: 50

📁 **Fase 4: Gerando Arquivos**
✅ src/capybaraConfig.json criado
✅ .github/stack-instructions.md criado  
✅ .github/copilot-instructions.md criado (Capybara + Stack + Windows PowerShell rules)
✅ steps/ pasta criada

🎯 **Capybara configurado com sucesso!**

**Próximos comandos disponíveis:**
- "vamos desenvolver uma nova atividade"
- "atualizar configuração de stack"  
- "vamos iniciar o desenvolvimento da STEP_XXXX"
```

## 📋 **Environment Rules Templates**

### **Windows PowerShell Rules**
```markdown
## 🖥️ **Windows PowerShell Environment Rules**

### **Command Execution**
- ✅ **DO**: Use semicolon (;) to chain commands
  ```powershell
  npm install; npm run build; npm test
  ```
- ❌ **DON'T**: Use && (bash syntax)
  ```bash
  npm install && npm run build  # ❌ Won't work in PowerShell
  ```

### **Environment Variables**
- ✅ **DO**: Use PowerShell syntax
  ```powershell
  $env:NODE_ENV = "development"
  ```
- ❌ **DON'T**: Use bash export
  ```bash
  export NODE_ENV=development  # ❌ PowerShell syntax error
  ```

### **Path Handling**  
- ✅ **DO**: Use backslashes in PowerShell commands
- ✅ **DO**: Use forward slashes in config files
- ❌ **DON'T**: Mix inconsistently

### **Executable Suffixes**
- ✅ **DO**: Add .cmd/.exe when needed in scripts
  ```powershell
  npm.cmd install
  tsc.cmd --build
  ```
```

### **Cross-Platform Rules**  
```markdown
## 🌐 **Cross-Platform Environment Rules**

### **Package Scripts**
- ✅ **DO**: Use package.json scripts (work everywhere)
  ```json
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "test": "jest"
  }
  ```

### **Task Runner**
- ✅ **DO**: Use npm scripts for complex tasks
- ✅ **DO**: Consider cross-env for environment variables
  ```json
  "scripts": {
    "dev": "cross-env NODE_ENV=development nodemon src/index.ts"
  }
  ```
```
