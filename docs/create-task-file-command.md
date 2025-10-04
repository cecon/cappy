# Teste do comando createTaskFile

Este arquivo demonstra o uso do novo comando `cappy.createTaskFile`.

## Como usar:

1. **Comando básico**: `cappy.createTaskFile` - cria tarefa com valores padrão
2. **Comando com parâmetros**: `cappy.createTaskFile` com argumentos:
   - `title`: título da tarefa
   - `description`: descrição da tarefa  
   - `area`: área da tarefa
   - `priority`: prioridade (baixa, media, alta)
   - `estimate`: estimativa de tempo

## Resultado:

- Arquivo criado em `.cappy/tasks/`
- Formato: `TASK_{yyyyMMddHHmmss}_.ACTIVE.xml`
- Conteúdo salvo em `.cappy/output.txt`
- Retorna o XML completo da tarefa criada

## Exemplo de uso via código:

```typescript
// Comando básico
const result = await vscode.commands.executeCommand('cappy.createTaskFile');

// Comando com parâmetros
const result = await vscode.commands.executeCommand('cappy.createTaskFile', {
  title: 'Implementar nova funcionalidade',
  description: 'Adicionar suporte para upload de arquivos',
  area: 'backend',
  priority: 'alta',
  estimate: '2h'
});
```
