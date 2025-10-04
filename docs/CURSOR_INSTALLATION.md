# Instalação do CAPPY no Cursor

## 🚀 Guia Rápido de Instalação

### Método 1: Instalação via VSIX (Recomendado)

1. **Localize o arquivo VSIX**
   - O arquivo `cappy-2.9.9.vsix` está na raiz do projeto

2. **Instale no Cursor**
   - Abra o Cursor
   - Pressione `Ctrl+Shift+P` (ou `Cmd+Shift+P` no Mac)
   - Digite: `Extensions: Install from VSIX...`
   - Selecione o arquivo `cappy-2.9.9.vsix`

3. **Confirme a instalação**
   - Aguarde a mensagem de confirmação
   - Reinicie o Cursor se solicitado

### Método 2: Via Linha de Comando

```powershell
# No Windows PowerShell
cursor --install-extension .\cappy-2.9.9.vsix
```

```bash
# No Linux/Mac
cursor --install-extension ./cappy-2.9.9.vsix
```

## ✅ Verificação da Instalação

Após instalar, verifique se funcionou:

1. Abra a paleta de comandos (`Ctrl+Shift+P`)
2. Digite "Cappy"
3. Você deve ver todos os comandos disponíveis:
   - 🦫 Initialize Cappy
   - 🧠 Cappy: KnowStack
   - 🧩 Cappy: New Task
   - E outros...

## 🎯 Primeiros Passos

### 1. Inicialize o CAPPY no seu projeto

```
Ctrl+Shift+P > Cappy: Initialize Project
```

O CAPPY criará a estrutura:
```
.cappy/
├── schemas/
├── tasks/
├── history/
└── stack.md
```

### 2. Configure o ambiente

O CAPPY detectará automaticamente que está rodando no Cursor e mostrará:
```
🦫 Cappy Memory: Activating in Cursor...
```

### 3. Comece a usar

Experimente criar sua primeira tarefa:
```
Ctrl+Shift+P > Cappy: New Task
```

Ou integre com o AI do Cursor:
```
No Cursor Composer:
"Use o CAPPY para criar uma tarefa de implementação de autenticação"
```

## 📚 Recursos Disponíveis

- **Context Orchestration**: Contexto automático baseado na arquitetura do projeto
- **Prevention Rules**: Aprenda com erros e evite-os no futuro
- **Task Management**: Gerenciamento estruturado de tarefas em XML
- **AI Integration**: Funciona perfeitamente com Cursor Composer e Chat

## 🔧 Configurações

Acesse as configurações do CAPPY:
1. `Ctrl+,` para abrir Settings
2. Busque por "Cappy"
3. Configure conforme necessário:
   - `cappy.autoUpdateCopilotContext`: true
   - `cappy.maxPreventionRules`: 50
   - `cappy.taskTimeEstimation`: true
   - `cappy.showNotifications`: true

## 🆘 Resolução de Problemas

### A extensão não aparece
- Reinicie o Cursor completamente
- Verifique se o arquivo .vsix foi instalado corretamente
- Vá em Extensions e procure por "Cappy"

### Comandos não funcionam
- Certifique-se de ter inicializado o projeto (`Cappy: Initialize Project`)
- Verifique se está em um workspace válido
- Consulte o Output: `View > Output > Cappy`

### Performance lenta
- Execute `Cappy: Reindex Files` para otimizar índices
- Verifique o tamanho do diretório `.cappy`

## 📖 Documentação Completa

Para informações detalhadas, consulte:
- [README.md](README.md) - Visão geral completa
- [docs/cursor-compatibility.md](docs/cursor-compatibility.md) - Detalhes de compatibilidade
- [CHANGELOG.md](CHANGELOG.md) - Histórico de versões

## 🎉 Pronto!

Agora você tem o CAPPY rodando no Cursor com todos os recursos de:
- ✅ Context Orchestration
- ✅ Prevention Rules
- ✅ Task Management
- ✅ AI Integration

**Happy Coding!** 🦫🚀

---

## Novidades na v2.9.9

- ✨ Suporte completo ao Cursor
- 🔍 Detecção automática de ambiente
- 📚 Documentação específica para Cursor
- 🚀 Todas funcionalidades testadas e validadas

Para suporte, visite: https://github.com/cecon/cappy/issues



