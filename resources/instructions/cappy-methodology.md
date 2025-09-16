# Metodologia CAPPY - Context Orchestration

## 🧠 **Core da Metodologia**

A metodologia CAPPY é um sistema de orquestração de contexto que permite desenvolvimento incremental através do acúmulo inteligente de conhecimento.

### **CAPPY - Os 5 Pilares**
- **Context**: Orquestração inteligente de conhecimento indexado
- **Atomic**: Tarefas simples e executáveis de forma direta
- **Prevention**: Regras aprendidas automaticamente aplicadas
- **Persistence**: Knowledge base estruturada e searchable
- **Yield**: Evolução contínua da eficiência por acúmulo de contexto

## 🔄 **Ciclo de Desenvolvimento**

### **1. Context Discovery**
- Sistema busca docs e prevention rules relacionadas
- LLM recebe contexto relevante automaticamente
- Histórico de tasks similares é consultado
- Dependências e relacionamentos são mapeados

### **2. Atomic Task Creation**
- **Critério de simplicidade**: Se tem >5 steps sequenciais, quebra
- **Bom senso**: Developer consegue executar de cabeça
- **Single responsibility**: 1 entregável, 1 validação clara
- Tasks conectadas por contexto compartilhado

### **3. Prevention Rule Application**
- Rules contextuais aplicadas automaticamente
- Error patterns de tasks similares consultados
- Validation checklist baseada em experiências anteriores
- Context-aware rules por categoria (auth, database, UI)

### **4. Knowledge Persistence**
- Decisões documentadas e linkadas
- Prevention rules categorizadas e indexadas
- Docs atualizadas com novos learnings
- Context mapping entre tasks relacionadas

### **5. Yield Evolution**
- Context quality aumenta com uso
- Rule effectiveness medida e otimizada
- Knowledge density cresce organicamente
- Sistema fica mais inteligente por si só

## 📁 **Estrutura de Conhecimento**

```
/docs/
├── tasks/              # Histórico de tasks executadas
│   ├── auth/
│   ├── database/
│   └── ui/
├── prevention/         # Rules categorizadas por contexto
│   ├── auth-rules.md
│   ├── db-rules.md
│   └── general-rules.md
├── components/         # Documentação de componentes
│   ├── auth.md
│   ├── database.md
│   └── api.md
└── index/              # Índices searchable
    ├── tasks.json      # Índice de tasks por contexto
    ├── prevention.json # Índice de rules por pattern
    └── context.json    # Mapeamento de relacionamentos
```

## 🔧 **XML Task Structure**

```xml
<task id="auth-middleware-fix" category="auth">
    <context>
        <docs_refs>
            <doc path="docs/components/auth.md" section="middleware"/>
            <doc path="docs/prevention/auth-rules.md" section="jwt-validation"/>
        </docs_refs>
        <prevention_rules>
            <rule id="jwt-null-check" category="auth">
                Always validate JWT existence before decode
            </rule>
            <rule id="middleware-order" category="express">
                Auth middleware must precede route handlers
            </rule>
        </prevention_rules>
        <related_tasks>
            <task id="auth-login-flow" relationship="depends-on"/>
            <task id="user-session" relationship="affects"/>
        </related_tasks>
    </context>
    
    <execution>
        <step id="1" validation="JWT helper function exists and handles null">
            Add null/undefined check to JWT decode helper
        </step>
        <step id="2" validation="Middleware loads before routes in app.js">
            Verify auth middleware order in express app
        </step>
        <step id="3" validation="Tests pass and error handling works">
            Test invalid JWT scenarios
        </step>
    </execution>
    
    <completion>
        <validation_checklist>
            <item>JWT null scenarios handled</item>
            <item>Middleware order correct</item>
            <item>Error responses appropriate</item>
            <item>Tests covering edge cases</item>
        </validation_checklist>
        <knowledge_capture>
            <new_learnings>
                <learning>Express middleware order affects auth flow</learning>
                <learning>JWT libraries don't handle null gracefully</learning>
            </new_learnings>
            <docs_updated>
                <doc>docs/components/auth.md</doc>
            </docs_updated>
        </knowledge_capture>
    </completion>
</task>
```

## 🔍 **Orquestração de Contexto**

### **Context Injection Pipeline**
1. **Keyword extraction**: Análise semântica da task description
2. **Doc search**: Busca em docs por relevância e tags
3. **Rule matching**: Prevention rules aplicáveis por contexto
4. **Task inheritance**: Histórico de tasks relacionadas
5. **Dependency mapping**: Tasks que afetam ou são afetadas

### **Knowledge Graph**
- **Tasks**: Conectadas por dependências e contexto
- **Docs**: Linkadas por referências cruzadas
- **Rules**: Agrupadas por patterns e categorias
- **Components**: Mapeados por área de impacto

## 📊 **Métricas de Efetividade**

### **Context Quality**
- **Hit rate**: % de tasks que encontraram contexto útil nos docs
- **Rule application**: % de prevention rules automaticamente aplicadas
- **Knowledge reuse**: Frequência de consulta a docs existentes

### **Atomic Compliance**
- **Breakdown rate**: % de tasks que precisaram ser quebradas
- **Execution clarity**: Tasks completadas sem consultas externas
- **Single responsibility**: Tasks com validação clara e única

### **Prevention Effectiveness**
- **Error reduction**: Problemas recorrentes evitados por rules
- **Pattern recognition**: Novos error patterns capturados
- **Context learning**: Rules mais precisas por categoria

### **Knowledge Evolution**
- **Doc density**: Informação útil por documento
- **Context connectivity**: Relacionamentos mapeados entre elementos
- **System intelligence**: Redução de dependência de input manual

## 🚨 **Regras Fundamentais**

### **Simplicidade Atômica**
- Se você não consegue explicar a task em 2 frases, ela está grande
- Se tem mais de 5 steps, deve ser quebrada
- Se depende de conhecimento externo não documentado, contexto está incompleto

### **Context First**
- Toda task inicia com busca por contexto relevante
- Prevention rules são aplicadas antes da execução
- Novo conhecimento sempre atualiza a base existente

### **Knowledge Persistence**
- Todo erro se torna prevention rule indexada
- Toda solução atualiza documentação relacionada
- Todo relacionamento é mapeado para reuso futuro

### **Evolução Contínua**
- Sistema aprende com cada task executada
- Context quality melhora automaticamente
- Eficiência aumenta por acúmulo de conhecimento

---

**A metodologia CAPPY transforma development de reativo para inteligente - onde cada task contribui para um sistema mais esperto e eficiente.**