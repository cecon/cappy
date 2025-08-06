# Script LLM: Criar Nova Task

## 🎯 **Trigger de Ativação**
Quando o usuário solicitar:
- "criar nova task"
- "nova tarefa"  
- "vamos trabalhar em [feature]"
- "preciso implementar [feature]"
- "vamos adicionar [funcionalidade]"

## 📋 **Fluxo de Execução Completo**

### **1. Verificação de Tasks Ativas**
```javascript
// Pseudocódigo para LLM
tasks_ativas = list_files(".capy/tasks/*.xml")
for (task in tasks_ativas) {
    xml = read_file(task)
    if (xml.status == "em-andamento" || xml.status == "pausada") {
        ask_user("⚠️ Existe tarefa ativa: " + xml.title + ". Pausar para criar nova?")
        if (user_response == "não") return
    }
}
```

### **2. Leitura de Contexto**
```javascript
// LLM deve ler obrigatoriamente:
prevention_rules = read_file(".capy/prevention-rules.md")
project_config = read_file(".capy/config.json")
patterns = read_file(".capy/instructions/capybara-patterns.md")
```

### **3. Análise de Atomicidade**
```javascript
if (task_estimation > 3_hours) {
    suggest_decomposition()
    show_patterns_from(".capy/instructions/capybara-patterns.md")
}
```

**ATOMIC vs NON-ATOMIC:**
```
✅ ATOMIC EXAMPLES:
- "Setup Supabase client configuration"  
- "Create user registration form component"
- "Implement JWT token validation middleware"

❌ NON-ATOMIC (decompose first):
- "Implement complete authentication system"
- "Build admin dashboard" 
- "Setup entire backend API"
```

**Padrões de Decomposição:**
- **Authentication**: config → middleware → endpoints → integration → testing
- **Frontend**: layout → components → styling → state → integration  
- **Backend**: schema → validation → endpoints → testing
- **Database**: schema → migrations → repositories → testing

### **4. Questionário de Clarificação**
Se necessário, perguntar sobre:
- **Escopo técnico**: Funcionalidades específicas
- **Tecnologias**: Bibliotecas e frameworks
- **Interface**: Requisitos de UI/UX
- **Validação**: Regras de negócio
- **Testes**: Cobertura esperada

### **5. Apresentação de Escopo**
```markdown
## 🎯 Escopo Entendido:
**Tarefa**: [TÍTULO]
**Área**: [frontend/backend/fullstack]
**Tecnologias**: [lista]
**Arquivos**: [lista de arquivos que serão tocados]
**Steps**: [resumo dos steps principais]
**Tempo**: [estimativa em horas]

## 📋 Prevention Rules Aplicadas:
[lista das regras que serão seguidas]

✅ Este escopo está correto? (Digite 'sim' para confirmar)
```

### **6. Criação do XML**

#### **File Naming Convention:**
- **Formato**: `STEP_[UNIX_TIMESTAMP]_[KEBAB-CASE-TITLE].xml`
- **Exemplo**: `STEP_1722873600_setup-supabase-auth.xml`

#### **XML Structure - FORMATO OBRIGATÓRIO:**

```xml
<task id="[unique-kebab-case-id]" version="1.0">
    <metadata>
        <title>[Clear, actionable title]</title>
        <description>[Detailed description focusing on the specific outcome]</description>
        <status>em-andamento</status>
        <progress>0/[total-steps]</progress>
    </metadata>
    
    <context>
        <area>[frontend/backend/mobile/devops/fullstack]</area>
        <technology main="[main-tech]" version="[min-version]"/>
        <dependencies>
            <lib>[library-name]</lib>
            <!-- Add ALL dependencies needed -->
        </dependencies>
        <files>
            <file type="creation" required="true">[absolute-file-path]</file>
            <file type="modification" required="false">[absolute-file-path]</file>
            <!-- List EVERY file that will be touched -->
        </files>
    </context>
    
    <steps>
        <step id="step001" order="1" completed="false" required="true">
            <title>[What will be accomplished]</title>
            <description>[Detailed explanation of the work to be done]</description>
            <criteria>
                <criterion>[Specific, measurable requirement]</criterion>
                <criterion>[Another specific requirement]</criterion>
            </criteria>
            <files>
                <file type="[creation/modification]" required="[true/false]">[specific-file-path]</file>
            </files>
            <dependencies>
                <lib>[step-specific-library]</lib>
            </dependencies>
            <validation>
                <command>[test-command]</command>
                <metric>[specific-metric >= target]</metric>
            </validation>
        </step>
        
        <step id="step002" order="2" completed="false" required="true" depends-on="step001">
            <!-- Repeat pattern for additional steps -->
        </step>
    </steps>
    
    <validation>
        <checklist>
            <item>All required steps completed</item>
            <item>All required files created</item>
            <item>Code compiles without errors</item>
            <item>No linting warnings</item>
            <item>[Add specific validation criteria]</item>
        </checklist>
    </validation>
</task>
```

#### **Requisitos Críticos:**
- **ID da Task**: kebab-case, único (ex: "setup-supabase-auth")
- **Status**: Sempre "em-andamento" para tasks novas
- **Area**: Escolher UMA área primária
- **Dependencies**: Incluir TODAS as bibliotecas necessárias
- **Files**: Listar TODOS os arquivos que serão criados/modificados
- **Steps**: IDs sequenciais simples (`step001`, `step002`, etc.)
- **Criteria**: Específicos, mensuráveis e testáveis

```javascript
timestamp = unix_timestamp()
filename = `STEP_${timestamp}_${kebab_case(title)}.xml`
xml_content = generate_xml_following_structure_above()
write_file(`.capy/tasks/${filename}`, xml_content)
```

### **7. Confirmação**
```markdown
✅ Tarefa criada: [FILENAME]
📁 Localização: .capy/tasks/[FILENAME]

Digite "vamos iniciar" ou "vamos trabalhar" para começar a execução.
```

## 🛡️ **Prevention Rules Aplicáveis**
- Sempre verificar tasks ativas antes de criar nova
- Seguir estrutura XML exata definida acima
- Incluir ALL required sections: metadata, context, steps, validation
- Steps devem ser sequenciais e com critérios específicos
- Arquivo deve usar timestamp para ordenação cronológica
- Máximo 3 horas por task (atomicidade obrigatória)
- Critérios devem ser específicos e mensuráveis

## 📊 **Saídas Esperadas**
- Arquivo XML criado em `.capy/tasks/`
- Status da task = "em-andamento"
- Prevention rules aplicadas e mencionadas
- Usuário orientado sobre próximo passo
- XML válido seguindo estrutura exata
- Dependencies completas listadas
- Files com paths absolutos
- Steps com critérios específicos

## 📝 **Template de Resposta**

```markdown
## Analysis
[Brief analysis of the request]

## XML Task Structure
[Complete XML following the exact format above]

## Assumptions
[Any assumptions or clarifications made]
```
