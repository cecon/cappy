# Change Task Status Command

## Visão Geral

O comando `cappy.changeTaskStatus` permite alterar o status de uma tarefa entre "active" (ativo) e "paused" (pausado). O comando renomeia o arquivo da tarefa e atualiza internamente as propriedades de status e ID.

## Funcionalidades

### 🔄 Alteração de Status
- **Active**: Tarefa em andamento (`status="em-andamento"`)
- **Paused**: Tarefa pausada (`status="pausada"`)

### 📝 Modificações Realizadas
1. **Renomeação do arquivo**: 
   - `TASK_20250814_exemplo.ACTIVE.xml` → `TASK_20250814_exemplo.ACTIVE.xml`
   - `TASK_20250814_exemplo.paused.xml` → `TASK_20250814_exemplo.PAUSED.xml`

2. **Atualização do XML**:
   - Propriedade `status` no elemento `<task>`
   - Propriedade `id` no elemento `<task>`
   - Timestamp `<updated>` na seção `<meta>`

## Como Usar

### Via Command Palette
1. Abra o Command Palette (`Ctrl+Shift+P`)
2. Digite "Cappy: Change Task Status"
3. Informe o nome do arquivo da tarefa
4. Selecione o novo status (active/paused)

### Via API Programática
```typescript
import { changeTaskStatus } from './commands/changeTaskStatus';

// Alterar para pausado
const result = await changeTaskStatus('TASK_20250814_exemplo.ACTIVE.xml', 'paused');

// Alterar para ativo
const result = await changeTaskStatus('TASK_20250814_exemplo.paused.xml', 'active');
```

## Estrutura de Arquivos

### Antes da Alteração
```
.cappy/tasks/
├── TASK_20250814_exemplo.ACTIVE.xml (status="em-andamento")
```

### Depois da Alteração (active → paused)
```
.cappy/tasks/
├── TASK_20250814_exemplo.PAUSED.xml (status="pausada")
```

## Exemplo de Transformação XML

### Arquivo Original (Active)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task id="TASK_20250814_exemplo.ACTIVE" status="em-andamento">
    <meta>
        <created>2025-08-14T10:00:00.000Z</created>
        <updated>2025-08-14T10:00:00.000Z</updated>
        <file>TASK_20250814_exemplo.ACTIVE.xml</file>
    </meta>
    <!-- ... resto do conteúdo ... -->
</task>
```

### Arquivo Transformado (Paused)
```xml
<?xml version="1.0" encoding="UTF-8"?>
<task id="TASK_20250814_exemplo.PAUSED" status="pausada">
    <meta>
        <created>2025-08-14T10:00:00.000Z</created>
        <updated>2025-08-14T23:15:30.456Z</updated>
        <file>TASK_20250814_exemplo.PAUSED.xml</file>
    </meta>
    <!-- ... resto do conteúdo ... -->
</task>
```

## Tratamento de Erros

### Arquivo não encontrado
```
❌ Arquivo de tarefa não encontrado: TASK_exemplo.xml
```

### Status inválido
```
❌ Status deve ser 'active' ou 'paused'
```

### Diretório não existe
```
❌ Diretório .cappy/tasks não encontrado
```

## Retorno do Comando

### Sucesso
O comando retorna o caminho completo do novo arquivo:
```
D:\projeto\.cappy\tasks\TASK_20250814_exemplo.PAUSED.xml
```

### Falha
O comando retorna uma mensagem de erro começando com `❌`.

## Implementação Técnica

### Arquivo Principal
- **Localização**: `src/commands/changeTaskStatus.ts`
- **Função Principal**: `changeTaskStatus(fileName: string, newStatus: 'active' | 'paused')`
- **Output**: Escreve resultado em `.cappy/output.txt`

### Registro no VS Code
- **Command ID**: `cappy.changeTaskStatus`
- **Categoria**: "Cappy"
- **Título**: "🔄 Cappy: Change Task Status"

### Testes
- **Localização**: `src/test/suite/changeTaskStatus.test.ts`
- **Cobertura**: 
  - Alteração active → paused
  - Alteração paused → active
  - Tratamento de arquivos inexistentes
  - Validação de status inválido

## Integração com Cappy Workflow

Este comando se integra ao fluxo de trabalho do Cappy permitindo:
1. **Pausar tarefas** quando necessário focar em outras prioridades
2. **Reativar tarefas** quando retomar o trabalho
3. **Organizar o estado** das tarefas no diretório `.cappy/tasks/`
4. **Manter histórico** com timestamps atualizados

## Próximos Passos

Para usar o comando:
1. Certifique-se de que há tarefas no diretório `.cappy/tasks/`
2. Execute o comando via Command Palette
3. O resultado será mostrado tanto no VS Code quanto em `.cappy/output.txt`
