# 🚀 Guia de Inicialização do Cappy

## Visão Geral

A partir da versão 3.1.0, o Cappy requer inicialização explícita do workspace antes de começar a indexar arquivos. Isso garante que:

1. A extensão não cria pastas automaticamente em todos os workspaces
2. O usuário tem controle sobre quando e onde o Cappy é ativado
3. A pasta `.cappy/data` é automaticamente adicionada ao `.gitignore` para evitar commit de dados de indexação

## Fluxo de Inicialização

### 1. Primeira Vez no Workspace

Quando você abre um workspace pela primeira vez com o Cappy instalado:

1. A extensão **NÃO** cria automaticamente a pasta `.cappy`
2. Os comandos de indexação mostrarão um aviso pedindo para inicializar o workspace
3. Você precisa executar o comando **"Cappy: Initialize Workspace"** (`cappy.init`)

### 2. Comando `cappy.init`

O comando de inicialização realiza as seguintes ações:

```
1. Cria a pasta .cappy/
2. Cria a subpasta .cappy/data/
3. Adiciona .cappy/data/ ao .gitignore (ou cria .gitignore se não existir)
4. Oferece opção de iniciar o processamento de arquivos
```

**Como executar:**
- Abra a paleta de comandos (Ctrl+Shift+P / Cmd+Shift+P)
- Digite "Cappy: Initialize Workspace"
- Confirme a inicialização

### 3. Auto-Start do Sistema de Processamento

Após a inicialização:

- Se a pasta `.cappy` existe, o sistema de processamento inicia automaticamente ao abrir o VS Code
- Se a pasta `.cappy` NÃO existe, o sistema aguarda a inicialização manual

## Estrutura de Pastas

Após a inicialização, a estrutura do workspace será:

```
meu-projeto/
├── .cappy/                    # Pasta raiz do Cappy
│   ├── data/                  # Dados de indexação (excluído do git)
│   │   ├── graph-store.db     # Banco de dados do grafo
│   │   └── file-metadata.db   # Metadados dos arquivos
│   └── config.json            # Configuração do Cappy (opcional)
├── .gitignore                 # Atualizado com .cappy/data/
└── ...
```

## .gitignore

A linha adicionada ao `.gitignore`:

```gitignore
# Cappy data files (databases, indexes)
.cappy/data/
```

Isso garante que:
- Os bancos de dados locais não sejam commitados
- Cada desenvolvedor tenha sua própria indexação
- Não haja conflitos de merge em arquivos de dados

## Comandos que Requerem Inicialização

Os seguintes comandos verificam se o Cappy está inicializado antes de executar:

- ✅ `cappy.scanWorkspace` - Escanear workspace
- ✅ `cappy.processSingleFile` - Processar arquivo único
- ✅ `cappy.resetDatabase` - Resetar banco de dados
- ✅ `cappy.startProcessing` - Iniciar sistema de processamento
- ✅ `cappy.openGraph` - Abrir visualização do grafo (via IndexingInitializer)

## Migração de Workspaces Existentes

Se você já tinha o Cappy instalado e a pasta `.cappy` foi criada automaticamente:

### Opção 1: Manter e Adicionar ao .gitignore

```bash
# Execute o comando de inicialização
# Ele detectará a pasta existente e oferecerá reinicializar
# Escolha "No" para apenas adicionar ao .gitignore
```

### Opção 2: Remover e Reinicializar

```bash
# 1. Remova a pasta .cappy
rm -rf .cappy

# 2. Execute o comando de inicialização
# Ctrl+Shift+P -> "Cappy: Initialize Workspace"

# 3. Execute o scan para reindexar
# Ctrl+Shift+P -> "Cappy: Scan Workspace"
```

## Verificação de Status

Para verificar se o Cappy está inicializado:

1. Verifique se existe a pasta `.cappy` na raiz do workspace
2. Verifique se existe `.cappy/data/`
3. Verifique se `.cappy/data/` está no `.gitignore`

## Troubleshooting

### "Cappy is not initialized"

**Solução:** Execute "Cappy: Initialize Workspace"

### "File processing system failed to start"

**Causas possíveis:**
1. Pasta `.cappy` não existe → Execute `cappy.init`
2. Permissões de arquivo → Verifique permissões da pasta
3. Banco de dados corrompido → Execute "Cappy: Reset Database"

### Pasta .cappy não aparece no Explorer

**Normal:** A pasta `.cappy` pode estar oculta dependendo das configurações do VS Code para arquivos que começam com ponto.

Para visualizar:
- VS Code Settings → `files.exclude`
- Remova `**/.cappy` se estiver listado

## Boas Práticas

### ✅ Fazer

- Inicializar o Cappy em cada workspace que você quer indexar
- Manter `.cappy/data/` no `.gitignore`
- Executar "Scan Workspace" após clonar um repositório
- Resetar o banco de dados se encontrar problemas

### ❌ Não Fazer

- Não commitar arquivos da pasta `.cappy/data/`
- Não compartilhar bancos de dados entre desenvolvedores
- Não mover manualmente arquivos da pasta `.cappy/`
- Não editar diretamente os arquivos de banco de dados

## API para Extensões

Se você está desenvolvendo uma extensão que integra com o Cappy:

```typescript
import { isCappyInitialized, ensureCappyInitialized } from './shared/utils/workspace-check';

// Verificar se está inicializado
if (isCappyInitialized()) {
  // Fazer algo
}

// Verificar e mostrar prompt se não estiver inicializado
if (await ensureCappyInitialized()) {
  // Executar comando
}
```

## Changelog

### v3.1.0
- ✨ Adicionado comando `cappy.init` para inicialização explícita
- 🔒 Removido auto-criação da pasta `.cappy`
- 📝 Adição automática de `.cappy/data/` ao `.gitignore`
- ✅ Verificações de inicialização em comandos críticos
- 📚 Documentação do fluxo de inicialização

---

**Última atualização:** 2025-11-01
**Versão:** 3.1.0
