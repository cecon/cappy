# Teste da Funcionalidade getActiveTask

## Cenário 1: Com arquivo ativo
Quando existe um arquivo `.active.xml` em `.cappy/tasks/`, o comando retorna:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<task-status>
    <active>true</active>
    <file-path>.cappy/tasks/STEP_20250814_example_task.active.xml</file-path>
    <last-modified>[timestamp ISO]</last-modified>
    <line-count>[número de linhas]</line-count>
</task-status>
```

## Cenário 2: Sem arquivo ativo
Quando não existe arquivo `.active.xml` em `.cappy/tasks/`, o comando retorna:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<task-status>
    <active>false</active>
    <file-path>null</file-path>
    <last-modified>null</last-modified>
    <line-count>0</line-count>
</task-status>
```

## Template Utilizado
O XML é gerado usando o template em `resources/templates/task-status.xml` com placeholders:
- `{{ACTIVE}}`
- `{{FILE_PATH}}`
- `{{LAST_MODIFIED}}`
- `{{LINE_COUNT}}`
