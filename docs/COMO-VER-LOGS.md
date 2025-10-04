# 🔍 Como Ver os Logs do Cappy no VS Code

## Opção 1: Output Channel (Recomendado)

1. **Abrir o painel de Saída**:
   - Menu: `View` > `Output` (ou `Exibir` > `Saída`)
   - Atalho: `Ctrl + Shift + U`

2. **Selecionar o canal correto**:
   - No dropdown à direita, procure por:
     - ✅ **"Cappy"** - Log específico do Cappy
     - ✅ **"Extension Host"** - Log geral de todas as extensões
     - ✅ **"Log (Extension Host)"** - Log detalhado de ativação

## Opção 2: Developer Tools (Mais Detalhado)

1. **Abrir Developer Tools**:
   - Menu: `Help` > `Toggle Developer Tools`
   - Atalho: `Ctrl + Shift + I` (ou `Ctrl + Alt + I`)

2. **Verificar a aba Console**:
   - Procure por mensagens que começam com:
     - `🦫 Cappy:`
     - `Cappy Memory`
     - Erros em vermelho relacionados ao Cappy

## Opção 3: Command Palette

1. **Abrir Command Palette**:
   - Atalho: `Ctrl + Shift + P`

2. **Digitar e executar**:
   ```
   Developer: Show Logs...
   ```

3. **Selecionar**:
   - `Extension Host`
   - `Window`

## Opção 4: Arquivo de Log (Linha de Comando)

Execute no PowerShell para abrir a pasta de logs:

```powershell
# Abrir pasta de logs do VS Code
code "$env:APPDATA\Code\logs"

# Ou abrir diretamente no Explorer
explorer "$env:APPDATA\Code\logs"
```

Os logs mais recentes estão na pasta com data/hora mais recente.

## O Que Procurar nos Logs

### ✅ Sinais de sucesso:
```
🦫 Cappy: Starting activation...
Cappy: Running in VS Code
🦫 Cappy: Output channel created...
```

### ❌ Sinais de erro:
```
command 'cappy.version' not found
Cannot find module './commands/getVersion'
Extension activation failed
TypeError: ...
```

## Comando Rápido para Ver Logs

Execute no terminal integrado do VS Code:

```powershell
# Ver últimas linhas do log de extensões
Get-Content "$env:APPDATA\Code\logs\*\exthost*\output.log" -Tail 50
```

## Teste Rápido de Ativação

1. Abra Command Palette (`Ctrl + Shift + P`)
2. Digite: `Developer: Reload Window`
3. Observe o Output Channel "Extension Host" durante o reload
4. Procure pela mensagem: `🦫 Cappy: Starting activation...`

---

**💡 Dica**: Se você não ver nenhuma mensagem do Cappy nos logs, a extensão não está sendo ativada. Isso pode indicar:
- Extensão instalada incorretamente
- Conflito com outra extensão
- Erro no package.json
