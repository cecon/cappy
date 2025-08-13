# 🔄 Migração para Tasks XML - Cappy v2.2.0

## 📋 O que mudou?

A partir da versão 2.2.0, o Cappy utiliza um **arquivo XML único** para definir e gerenciar tasks, substituindo o sistema anterior de múltiplos arquivos Markdown.

## 🎯 Principais Benefícios

### ✅ **Estrutura Unificada**
- **Antes**: Múltiplos arquivos (.md) espalhados
- **Agora**: Um único arquivo `task.xml` com toda a informação

### ✅ **Progresso Granular**  
- **Antes**: Status binário (ativo/pausado/completo)
- **Agora**: Acompanhamento step-by-step com critérios e entregas

### ✅ **Dependências Claras**
- **Antes**: Dependências implícitas ou documentadas em texto
- **Agora**: Dependências explícitas entre steps (`dependeDe="step001"`)

### ✅ **Validação Estruturada**
- **Antes**: Critérios de sucesso em texto livre
- **Agora**: Critérios estruturados e checklist de validação

## 📁 Nova Estrutura de Arquivos

```
.cappy/
├── config.json                         # Configurações do Cappy
├── prevention-rules.md                 # Regras de prevenção (mantido)
├── task-id-exemplo/                    # Pasta da task (novo padrão)
│   ├── task.xml                        # ⭐ Arquivo principal da task
│   └── artifacts/                      # Arquivos gerados
└── history/                           # Tasks completadas
    └── STEP_0001_task_completed/       # Movidas quando concluídas
        └── task.xml                    # Mantém histórico completo
```

## 🔧 Estrutura do XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<task id="cadastro-cliente-react" versao="1.0">
    <metadados>
        <titulo>Criar página de cadastro de clientes</titulo>
        <descricao>Desenvolver componente React para cadastro de novos clientes</descricao>
        <status>em-andamento</status>
        <progresso>2/7</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>react-hook-form</lib>
            <lib>yup</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="true" obrigatorio="true">
            <titulo>Configurar estrutura do componente</titulo>
            <descricao>Criar arquivo ClienteForm.jsx com estrutura básica</descricao>
            <criterios>
                <criterio>Componente funcional criado</criterio>
                <criterio>Imports necessários adicionados</criterio>
                <criterio>Export default configurado</criterio>
            </criterios>
            <entrega>ClienteForm.jsx</entrega>
        </step>
        
        <step id="step002" ordem="2" concluido="true" obrigatorio="true" dependeDe="step001">
            <titulo>Implementar campos do formulário</titulo>
            <descricao>Adicionar campos nome, email e telefone</descricao>
            <criterios>
                <criterio>Campo nome (input text)</criterio>
                <criterio>Campo email (input email)</criterio>
                <criterio>Campo telefone (input tel)</criterio>
                <criterio>Labels associadas aos campos</criterio>
            </criterios>
        </step>
        
        <step id="step003" ordem="3" concluido="false" obrigatorio="true" dependeDe="step002">
            <titulo>Configurar validação</titulo>
            <descricao>Implementar validação usando react-hook-form e yup</descricao>
            <criterios>
                <criterio>Schema de validação criado</criterio>
                <criterio>Validação integrada ao formulário</criterio>
                <criterio>Mensagens de erro exibidas</criterio>
            </criterios>
            <entrega>clienteValidation.js</entrega>
        </step>
        
        <!-- Mais steps... -->
    </steps>
    
    <validacao>
        <checklist>
            <item>Todos os steps obrigatórios concluídos</item>
            <item>Critérios de cada step atendidos</item>
            <item>Entregas geradas conforme especificado</item>
        </checklist>
    </validacao>
</task>
```

## 🚀 Novo Workflow

### 1. **Criar Task**
```bash
Ctrl+Shift+P → "Cappy: Create New Task"
```
- Define ID, título, descrição e tecnologia principal
- Gera `task.xml` com steps básicos
- Task fica ativa automaticamente

### 2. **Acompanhar Progresso**
```bash
Ctrl+Shift+P → "Cappy: Show Step Progress"
```
- Visualiza status de todos os steps
- Mostra dependências e critérios
- Indica steps obrigatórios vs opcionais

### 3. **Marcar Steps como Concluídos**
```bash
Ctrl+Shift+P → "Cappy: Mark Step Completed"
```
- Seleciona step para marcar como concluído
- Valida dependências automaticamente
- Mostra critérios antes da confirmação

### 4. **Completar Task**
```bash
Ctrl+Shift+P → "Cappy: Complete Current Task"
```
- Move task para `.cappy/history/STEP_XXXX_nome/`
- Preserva todo o histórico em XML
- Libera para nova task

## 🔄 Compatibilidade com Versões Antigas

O sistema mantém **compatibilidade com tasks antigas**:
- Tasks no formato JSON ainda funcionam
- São convertidas automaticamente para visualização
- Recomenda-se migrar gradualmente para XML

## 🎯 Instruções Atualizadas para o Copilot

O arquivo `.github/copilot-instructions.md` foi atualizado para incluir:

```markdown
### **📄 Estrutura XML das Tasks:**
- Use `task.xml` como arquivo principal
- Steps com dependências explícitas (`dependeDe`)
- Critérios estruturados para cada step
- Progresso granular (`concluido="true/false"`)
- Status da task (`em-andamento`, `pausada`, `concluida`)
```

## 🛠️ Comandos Disponíveis

### ✅ **Novos Comandos Funcionais:**
- `Cappy: Create New Task` - Cria task em XML
- `Cappy: Show Step Progress` - Visualiza progresso detalhado
- `Cappy: Mark Step Completed` - Marca step como concluído
- `Cappy: Mark Step Incomplete` - Reverte conclusão de step

### 🚧 **Em Desenvolvimento:**
- `Cappy: Complete Task` - Completar e mover para histórico
- `Cappy: Resume Task` - Retomar task pausada
- `Cappy: Manage All Tasks` - Gerenciar múltiplas tasks

## 📝 Exemplos Práticos

### **Editando Manualmente o XML**
```xml
<!-- Marcar step como concluído -->
<step id="step001" concluido="true" ...>

<!-- Adicionar dependência -->
<step id="step003" dependeDe="step002" ...>

<!-- Definir step opcional -->
<step id="step006" obrigatorio="false" ...>

<!-- Adicionar entrega específica -->
<entrega>ClienteForm.jsx</entrega>
<entrega>styles.css</entrega>
```

### **Estrutura de Critérios**
```xml
<criterios>
    <criterio>Componente renderiza corretamente</criterio>
    <criterio>Validação funciona com inputs inválidos</criterio>
    <criterio>Submit previne envio com erros</criterio>
    <criterio>CSS responsivo aplicado</criterio>
</criterios>
```

## 🎉 Resultado

Com o novo sistema XML, você terá:
- ✅ **Visibilidade completa** do progresso da task
- ✅ **Dependências claras** entre steps
- ✅ **Critérios objetivos** para cada etapa
- ✅ **Histórico preservado** de forma estruturada
- ✅ **Workflow mais eficiente** com o Copilot

---

**🎯 Próximos passos:** Teste o novo sistema criando uma task e acompanhe como o XML mantém toda a informação organizada em um só lugar!
