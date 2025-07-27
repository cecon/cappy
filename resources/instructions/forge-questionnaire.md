# FORGE Interactive Gap Analysis - New STEP Creation

## 🎯 **Trigger Phrases for Gap Analysis Mode**

- "vamos desenvolver uma nova atividade"
- "preciso criar uma nova tarefa"
- "quero implementar [algo novo]"
- "vamos adicionar [funcionalidade]"

## � **LLM Gap Detection Protocol**

### **Phase 1: Initial Analysis & Gap Detection**
```
🤖 **LLM Internal Analysis:**
"Analisando a solicitação do usuário para detectar gaps de informação..."

📊 **Gap Checklist (Internal LLM Assessment):**
- [ ] Objective clarity: Is the end goal specific and measurable?
- [ ] Technical scope: Are technologies/frameworks clearly defined?
- [ ] Success criteria: Are validation criteria testable?
- [ ] Dependencies: Are prerequisite tasks identified?
- [ ] Environment: Is target environment/platform specified?
- [ ] Time estimation: Can complexity be reasonably assessed?
- [ ] Integration points: Are external dependencies clear?

📈 **Confidence Score**: [X]/7 gaps resolved
```

### **Phase 2: Targeted Gap Resolution**
```
❌ **Gaps Detected - Needs Clarification:**

[Only ask about detected gaps, not everything]

🔍 **Gap 1: [Specific gap type]**
"Preciso entender melhor: [specific question about the gap]"

🔍 **Gap 2: [Another specific gap]** 
"Para garantir atomicidade: [specific question]"

[Continue only for detected gaps...]

⏳ **Após esclarecimentos, criarei a STEP automaticamente.**
```

### **Phase 3: Specific Gap Types & Questions**

#### **Gap Type: Objective Clarity** 🎯
```
❌ **Gap Detectado**: Objetivo não específico o suficiente

� **Preciso esclarecer**:
"Você disse '[user request]'. Para criar uma STEP atômica, preciso entender:
- Qual é o resultado específico e mensurável?
- Como saberemos que está 100% completo?"

💡 **Exemplo**: 
"Implementar autenticação" → "Criar middleware JWT que valida tokens e retorna 401 para tokens inválidos"
```

#### **Gap Type: Technical Scope** 🔧
```
❌ **Gap Detectado**: Stack tecnológica não definida

🔍 **Preciso esclarecer**:
"Para aplicar as regras de prevenção corretas:
- Qual linguagem/framework está sendo usado?
- Há bibliotecas específicas obrigatórias?
- Qual é o ambiente de deploy?"
```

#### **Gap Type: Success Criteria** ✅
```
❌ **Gap Detectado**: Critérios de validação não testáveis

🔍 **Preciso esclarecer**:
"Como validaremos que está funcionando?
- Que testes devem passar?
- Quais cenários específicos devem funcionar?
- Há métricas de performance esperadas?"
```

#### **Gap Type: Dependencies** 🔗
```
❌ **Gap Detectado**: Dependências não identificadas

🔍 **Preciso esclarecer**:
"Esta tarefa depende de:
- Outras STEPs que devem estar completas?
- Serviços externos/APIs?
- Configurações específicas do ambiente?"
```

#### **Gap Type: Atomicity** ⚛️
```
❌ **Gap Detectado**: Tarefa parece muito complexa (>3h)

🔍 **Preciso esclarecer**:
"Esta tarefa parece grande demais. Podemos focar em uma parte específica primeiro?
- Qual seria o menor pedaço funcional?
- O que pode ser adiado para próximas STEPs?"
```

## 🤖 **LLM Confidence Assessment & Decision**

### **Final Gap Analysis**
```
📊 **Gap Resolution Status:**
- Objective clarity: [RESOLVED/GAP]
- Technical scope: [RESOLVED/GAP]  
- Success criteria: [RESOLVED/GAP]
- Dependencies: [RESOLVED/GAP]
- Atomicity: [RESOLVED/GAP]

**Confidence Level**: [HIGH/MEDIUM/LOW]
```

### **Decision Matrix**
```
🤖 **Auto-Creation Decision:**

HIGH Confidence + No Major Gaps = ✅ "Criando STEP_XXXX automaticamente..."
MEDIUM Confidence + Minor Gaps = ⚠️ "Prosseguindo com suposições documentadas..."
LOW Confidence + Major Gaps = ❌ "Preciso resolver gaps antes de prosseguir"
```

### **Auto-Creation with Gap Documentation**
```
If proceeding with MEDIUM confidence:
- Document assumptions made in DESCRIPTION.md
- Mark uncertain areas for validation during development
- Include extra validation steps in acceptance criteria
```

## 🏗️ **Auto-Creation Process (When Confidence ≥MEDIUM)**

### **Step 1: Find Latest STEP Number**
```
1. Scan /steps/ directory for highest STEP_XXXX
2. Next number = highest + 1 (with 4-digit format)
3. Example: Found STEP_0042 → Create STEP_0043
```

### **Step 2: Error Inheritance with Volume Control**
```
1. Read latest STEP_XXXX_DIFFICULTIES_FACED.md
2. Extract all prevention rules
3. Apply context.maxRules limit (default: 50)
4. Prioritize by relevance to new task:
   - Same technology/framework = High priority
   - General patterns = Medium priority  
   - Unrelated specifics = Low priority
5. Summarize similar rules to save space
```

### **Step 3: Structure Creation**
```
📁 Create: /steps/STEP_XXXX_[TASK_NAME]/
├── 📄 STEP_XXXX_DESCRIPTION.md (populated with questionnaire data + inherited rules)
├── 📄 STEP_XXXX_DONE.md (template ready)
├── 📄 STEP_XXXX_DIFFICULTIES_FACED.md (empty template)
└── 📁 artifacts/ (empty folder)
```

### **Step 4: Template Population**
```
STEP_XXXX_DESCRIPTION.md gets:
- Objective from Question 1
- Context from Question 2  
- Technical scope from Question 3
- Success criteria from Question 4
- Time estimate from Question 5
- Inherited prevention rules (filtered)
- Auto-generated validation checklist
```

## 📝 **Response Templates**

### **High Confidence Response**
```
✅ **Análise completada! Criando STEP_XXXX automaticamente...**

📊 **Resumo da Análise:**
- Confiança: 9/10
- Atomicidade: ✅ ATOMIC (2.5h estimado)
- Objetivo: [clear objective from Q1]
- Tecnologia: [tech stack from Q3]

📖 **Herdando {X} regras de prevenção da STEP_XXXX anterior...**
🚨 **Top rules relevantes:**
- ❌ DON'T [most relevant rule]
- ❌ DON'T [second most relevant]

📁 **Estrutura criada:**
/steps/STEP_XXXX_[TASK_NAME]/ ✅
- DESCRIPTION.md (populado)
- DONE.md (template)  
- DIFFICULTIES_FACED.md (vazio)
- artifacts/ (pasta)

🎯 **Próximo passo**: "vamos iniciar o desenvolvimento da STEP_XXXX"
```

### **Low Confidence Response**  
```
❌ **Preciso de mais informações para criar uma STEP eficaz.**

📊 **Análise atual:**
- Confiança: {X}/10 (mínimo 8 necessário)
- Gaps identificados:

🔍 **Informações faltantes:**
- [Specific gap from Question Y]
- [Another specific gap]

🤔 **Por favor, esclareça:**
- [Specific question to fill gap]
- [Another specific question]

⏳ **Após esclarecimentos, criarei a STEP automaticamente.**
```

## 🔄 **Integration with Development Workflow**

### **After Auto-Creation**
```
User can then say:
- "vamos iniciar o desenvolvimento da STEP_XXXX" → Execute workflow
- "quero revisar a STEP_XXXX antes" → Show DESCRIPTION.md
- "precisa ser dividida em sub-STEPs" → Decomposition mode
```

### **Seamless Transition**
```
Questionnaire → Auto-Creation → Development 
     ↓              ↓             ↓
   5 questions → STEP_XXXX/   → Follow methodology
                 with rules      execution workflow
```
