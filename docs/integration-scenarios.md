# Cenários de Integração FORGE

## Cenário 1: Projeto Novo (Primeira Instalação)

**Estado inicial**: Sem configurações FORGE

### **Fluxo Automático**:
1. **Detectar stack** do projeto (package.json, requirements.txt, etc.)
2. **Questionar stack** se não for possível detectar automaticamente
3. **Gerar stack-instructions.md** baseado na configuração
4. **Criar copilot-instructions.md** referenciando o stack-instructions
5. **Criar forgeConfig.json** com configurações do projeto

**Resultado**:
```
.github/
├── copilot-instructions.md (template FORGE + referência ao stack)
└── stack-instructions.md (configurações específicas da stack)
src/
└── forgeConfig.json (configuração completa do FORGE)
```

### **Exemplo: Projeto TypeScript + Express**
**Detecção automática via package.json**:
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "typescript": "^5.0.0"
  }
}
```

**LLM**: "Detectei TypeScript + Express. Configurar FORGE para esta stack? [Y/n]"

**Se confirmado**, gera:
- `stack-instructions.md` com padrões TypeScript/Express
- `copilot-instructions.md` com integração FORGE + referência ao stack
- `forgeConfig.json` com stack configurada

## Cenário 2: Projeto com copilot-instructions.md Existente

**Estado inicial**: Projeto já tem instruções customizadas

**Arquivo Original**:
```markdown
# My Project Instructions

## Code Style
- Use TypeScript
- Follow ESLint rules

## Testing
- Write unit tests for all functions
```

### **Fluxo de Integração**:
1. **Detectar stack** existente nas instruções ou no projeto
2. **Perguntar estratégia** de integração ao usuário:

```
🤖 **Detectei instruções existentes. Como integrar FORGE?**

a) 📄 Manter instruções + Adicionar FORGE no final
b) 🔗 Extrair stack para stack-instructions.md + Integrar FORGE
c) 🔄 Substituir por template FORGE completo  
d) ⏭️ Pular integração (configurar manualmente)
```

### **Opção A: Manter + Adicionar** 
**Resultado**:
```markdown
# My Project Instructions

## Code Style
- Use TypeScript
- Follow ESLint rules

## Testing
- Write unit tests for all functions

---

## Capybara Integration
This project uses the Capybara for atomic task management.

**Stack Configuration**: See `.github/stack-instructions.md`
**FORGE Config**: See `src/forgeConfig.json`
...
```

### **Opção B: Extrair Stack + Integrar** (RECOMENDADA)
1. **Extrai** regras de stack para `stack-instructions.md`
2. **Integra** FORGE no copilot-instructions.md  
3. **Referencia** stack-instructions.md

**Resultado**:
```markdown
# GitHub Copilot Instructions - Capybara

## Stack-Specific Guidelines
{LOAD_FROM: .github/stack-instructions.md}

## Capybara Integration
This project uses the Capybara for atomic task management...
```

**Novo arquivo** `.github/stack-instructions.md`:
```markdown
# Stack Instructions - TypeScript Project

## Code Style
- Use TypeScript
- Follow ESLint rules

## Testing  
- Write unit tests for all functions
```

## Cenário 3: FORGE Já Instalado

**Detecção**: Se encontrar qualquer um:
- `forgeConfig.json` 
- Arquivo contém `Capybara`
- Existe `stack-instructions.md`

**Resultado**: 
```
🤖 **FORGE já está configurado neste projeto!**

Configurações encontradas:
- Stack: TypeScript + Express (em stack-instructions.md)
- Config: src/forgeConfig.json
- Instruções: .github/copilot-instructions.md

Comandos disponíveis:
- "atualizar configuração de stack"
- "vamos desenvolver uma nova atividade"  
- "vamos iniciar o desenvolvimento da STEP_XXXX"
```

## Cenário 4: Stack Não Detectada Automaticamente

**Trigger**: Não há package.json, requirements.txt ou outros indicadores

### **Questionnaire de Stack**:
```
🤖 **Não consegui detectar a stack automaticamente.**

🎯 **Qual é a linguagem principal do projeto?**
a) TypeScript/Node.js
b) Python
c) Rust  
d) Java
e) C#
f) Go
g) PHP
h) Outro: [especificar]

[Continua com questionnaire completo de forge-stack-setup.md]
```

### **Resultado**: Stack configurada baseada nas respostas

## Cenário 5: Atualização de Stack Existente

**Trigger**: "quero atualizar a configuração de stack"

### **Fluxo**:
1. **Mostra configuração atual**:
```
📊 **Configuração atual:**
- Primary: TypeScript
- Framework: Express
- Testing: Jest
- Style: ESLint + Prettier
```

2. **Pergunta o que mudar**:
```
🔧 **O que você quer atualizar?**
a) Adicionar framework (ex: React, Vue)
b) Mudar ferramenta de teste (ex: Jest → Vitest)
c) Atualizar style guide (ex: Airbnb → Google)
d) Outras configurações
```

3. **Atualiza arquivos**:
   - `stack-instructions.md`
   - `forgeConfig.json`  
   - Regenera seções relevantes do `copilot-instructions.md`

## Fluxo de Comandos

### **Comando: "Initialize FORGE"**
```
📋 Checklist de inicialização:
1. [ ] Detectar stack do projeto
2. [ ] Configurar stack-instructions.md
3. [ ] Criar/atualizar copilot-instructions.md
4. [ ] Criar forgeConfig.json
5. [ ] Configurar estrutura de STEPs
```

### **Comando: "Configure Stack"**  
```
🔧 Questionnaire de stack + Geração de arquivos
```

### **Comando: "Update Stack"**
```
📝 Atualização de configurações existentes
```
