# 🦫 Capybara - Instruções para LLM

## 📋 **VISÃO GERAL DO PROJETO**

O **Capybara** é uma extensão do VS Code que transforma o GitHub Copilot em um assistente de IA que aprende com os erros e padrões específicos do **desenvolvedor solo**. 

**Capybara** é seu companheiro de programação: calmo, sábio e sempre aprendendo com você.

### 🎯 **OBJETIVO PRINCIPAL**
Permitir que o AI assistant aprenda progressivamente com:
- Erros documentados (Prevention Rules) **apenas os que realmente importam**
- Padrões específicos do projeto **sem overhead desnecessário**
- Contexto técnico acumulado **de forma leve e prática**
- Tarefas atômicas bem definidas (≤2 horas) **com visão macro preservada** e **apenas quando possível**

### 🏅 **PRINCÍPIOS PARA DESENVOLVIMENTO SOLO**
1. **Instrução privada**: `.github/copilot-instructions.md` vai para `.gitignore` (mantendo o desenvolvimento pessoal)
2. **Contexto enxuto**: Máximo 4000 chars para evitar que Copilot ignore
3. **Prevention rules focadas**: Máximo 15 regras - apenas o essencial **configuravel no config.yaml**
4. **Atomicidade balanceada**: 2h por STEP, mas sempre linkando ao objetivo macro **sempre que possível**
5. **Documentação mínima**: Só documenta o que realmente economiza tempo futuro

---

## 🏗️ **ESTRUTURA DO PROJETO**

### **Diretórios Principais:**
```
capybara/
├── src/                     # Código TypeScript da extensão
│   ├── extension.ts         # Ponto de entrada principal
│   ├── commands/           # Comandos da extensão (init, create, complete)
│   ├── models/             # Modelos de dados (Task, PreventionRule, Config)
│   ├── providers/          # Provedores de dados para VS Code
│   ├── utils/              # Utilitários (Context Manager, File Manager)
│   └── webview/           # Interface web (Dashboard)
├── resources/              # Templates e instruções
│   ├── instructions/      # Metodologia Capybara
│   └── templates/         # Templates para arquivos
├── examples/              # Exemplos de uso
├── docs/                  # Documentação adicional
└── syntaxes/             # Syntax highlighting para arquivos
```

### **Arquivos Chave:**
- `package.json`: Configuração da extensão VS Code
- `src/extension.ts`: Ativação e registro de comandos
- `resources/instructions/capybara-methodology.md`: Metodologia completa
- `src/utils/contextManager.ts`: Gerenciamento do contexto do Copilot

---

## 🔄 **FLUXOS DE TRABALHO PRINCIPAIS**

### **1. Inicialização (`capybara.init`)**
```typescript
// Cria estrutura básica:
.capy/
├── config.json           # Configurações do projeto
├── copilot-instructions.md # Instruções para Copilot
└── prevention-rules.md   # Regras acumuladas
```

### **2. Criação de Tarefas (`capybara.createTask` ou `capybara.createSmartTask`)**
```
steps/STEP_XXXX_[NOME]/
├── STEP_XXXX_DESCRIPTION.md      # Descrição detalhada
├── STEP_XXXX_DONE.md             # Critérios de conclusão  
├── STEP_XXXX_DIFFICULTIES_FACED.md # Problemas encontrados
└── artifacts/                     # Arquivos relacionados
```

### **3. Documentação de Erros (`capybara.addPreventionRule`)**
- Cada erro vira uma regra reutilizável
- Integra automaticamente ao contexto do Copilot
- Herança entre tarefas relacionadas

---

## 🤖 **INTEGRAÇÃO COM COPILOT**

### **Context Manager (`src/utils/contextManager.ts`):**
- Injeta instruções personalizadas no Copilot
- Atualiza contexto com prevention rules ativas
- Mantém memória de padrões do projeto

### **Fluxo de Contextualização:**
1. **Lê** configurações do `.capy/config.json`
2. **Carrega** prevention rules ativas
3. **Injeta** no contexto do Copilot via VS Code API
4. **Atualiza** automaticamente conforme novas regras

---

## 📝 **CONCEITOS ESSENCIAIS**

### **🔨 Tarefas Atômicas (STEPs)**
- **Limite:** ≤3 horas de trabalho
- **Numeração:** 4 dígitos (STEP_0001, STEP_0002...)
- **Estrutura:** Description → Implementation → Difficulties → Rules
- **Objetivo:** Manter foco e permitir rastreamento granular

### **🛡️ Prevention Rules**
- **Origem:** Problemas documentados em `DIFFICULTIES_FACED.md`
- **Formato:** Regra + Contexto + Solução
- **Propagação:** Herança automática entre STEPs relacionadas
- **Integração:** Automática no contexto do Copilot

### **📈 Aprendizado Progressivo**
- Cada erro vira conhecimento reutilizável
- AI assistant fica mais inteligente a cada projeto
- Padrões específicos do stack são preservados

---

## 🛠️ **COMANDOS PRINCIPAIS**

### **Comandos da Extensão:**
```typescript
// Inicialização
capybara.init                  // Setup básico
capybara.initComplete          // Setup completo com templates

// Gestão de Tarefas  
capybara.createTask            // Criar STEP manual
capybara.createSmartTask       // Criar STEP com AI
capybara.completeTask          // Marcar STEP como concluída

// Gestão de Conhecimento
capybara.addPreventionRule     // Adicionar regra de prevenção
capybara.updateCopilotContext  // Atualizar contexto do Copilot
capybara.exportRules           // Exportar regras
```

### **Estrutura de Comandos TypeScript:**
```typescript
// Padrão dos comandos:
export class CommandClass {
    async execute(): Promise<boolean> {
        // 1. Validar precondições
        // 2. Executar lógica principal  
        // 3. Atualizar contexto do Copilot
        // 4. Notificar providers
        return success;
    }
}
```

---

## 🎯 **METODOLOGIA DE DESENVOLVIMENTO**

### **Duas Modalidades Distintas:**

#### **🔨 "Criar Nova STEP"**
Quando usuário diz: *"vamos desenvolver uma nova atividade"*
1. **Questionário interativo** para coletar requisitos

2. **Análise de atomicidade** com verificação de confiança da LLM
3. **Auto-criação da estrutura** apenas quando confiante
4. **Herança de erros** da STEP anterior (respeitando maxRules)

#### **🚀 "Iniciar Desenvolvimento"** 
Quando usuário diz: *"vamos iniciar o desenvolvimento da STEP_XXXX"*
1. **Seguir execução passo-a-passo**
2. **Ler DESCRIPTION.md existente**
3. **Executar workflow de implementação**

### **Análise de Confiança da LLM:**
```
Autoavaliação da LLM:
- Nível de Confiança: [1-10] (criar apenas se ≥8)
- Score de Atomicidade: [ATÔMICA/PRECISA_DECOMPOSIÇÃO]
- Informações Faltantes: [Lista gaps se confiança <8]
```

---

## 🔧 **CONFIGURAÇÕES E CUSTOMIZAÇÃO**

### **`.capy/config.json` - Estrutura:**
```json
{
  "version": "1.0.0",
  "projectName": "Nome do Projeto",
  "maxRules": 10,
  "autoInheritRules": true,
  "contextUpdateFrequency": "onTaskComplete",
  "stackRules": {
    "language": "typescript",
    "framework": "vscode-extension",
    "environment": "windows-powershell"
  }
}
```

### **Prevention Rules - Formato:**
```markdown
## [CATEGORIA] Título da Regra

**Context:** Quando/onde o problema ocorre
**Problem:** Descrição do erro/problema  
**Solution:** Como resolver corretamente
**Example:** Código de exemplo (se aplicável)
**Tags:** #typescript #vscode #extension
```

---

## 🚦 **DIRETRIZES DE IMPLEMENTAÇÃO**

### **Para LLMs Trabalhando no Projeto:**

1. **SEMPRE** verificar se `.capy/` existe antes de sugerir criação de tarefas
2. **SEMPRE** ler prevention rules ativas antes de sugerir código
3. **NUNCA** sugerir tarefas >3 horas - decompor primeiro
4. **SEMPRE** documentar problemas encontrados
5. **PRIORITIZAR** reutilização de patterns já estabelecidos

### **Padrões de Código TypeScript:**
```typescript
// Imports organizados
import * as vscode from 'vscode';
import { ModelClass } from './models/modelClass';

// Classes com responsabilidade única
export class FeatureHandler {
    constructor(private context: vscode.ExtensionContext) {}
    
    async handle(): Promise<boolean> {
        try {
            // Implementação
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error}`);
            return false;
        }
    }
}
```

### **Padrões de Arquivo:**
- **Nomenclatura:** PascalCase para classes, camelCase para métodos
- **Estrutura:** Uma responsabilidade por arquivo
- **Error Handling:** Try/catch com mensagens para usuário
- **Logging:** Console.log para debug, showInformationMessage para usuário

---

## 📚 **RECURSOS DE REFERÊNCIA**

### **Arquivos de Documentação:**
- `resources/instructions/capybara-methodology.md` - Metodologia completa
- `docs/extension-structure.md` - Estrutura técnica detalhada
- `examples/` - Exemplos práticos de uso
- `README.md` - Visão geral e quick start

### **Templates Disponíveis:**
- `resources/templates/copilot-instructions-template.md`
- `resources/templates/environment-rules-templates.md`

### **Sintaxe Highlighting:**
- `syntaxes/capybara-task.tmLanguage.json` - Para arquivos `.capy-task`

---

## ⚡ **AÇÕES RÁPIDAS PARA LLM**

### **Se usuário quer inicializar Capybara:**
```typescript
// Usar: capybara.init ou capybara.initComplete
// Verificar: Se workspace tem .capy/
// Criar: Estrutura básica + templates
```

### **Se usuário quer criar nova tarefa:**
```typescript
// 1. Questionário de requisitos
// 2. Verificar atomicidade (≤3h)
// 3. Auto-análise de confiança
// 4. Criar estrutura STEP_XXXX
// 5. Herdar prevention rules relevantes
```

### **Se usuário quer documentar problema:**
```typescript
// 1. Capturar contexto do erro
// 2. Criar prevention rule
// 3. Adicionar a .capy/prevention-rules.md
// 4. Atualizar contexto do Copilot
```

---

## 🎖️ **PRINCÍPIOS FUNDAMENTAIS**

1. **Atomicidade:** Tarefas pequenas e focadas
2. **Rastreabilidade:** Histórico completo de decisões
3. **Aprendizado:** Cada erro vira conhecimento
4. **Automação:** Máximo de automação possível
5. **Contexto:** AI sempre informada do estado atual

---

*Esta extensão foi projetada para maximizar a eficiência da parceria humano-AI no desenvolvimento de software, criando um ciclo virtuoso de aprendizado contínuo.*