# Storage Architecture - Local vs Global

## 🎯 Decisão Arquitetural

### ✅ Banco de Dados: **LOCAL ao Workspace**
### ✅ Modelos LLM: **GLOBAL (compartilhado)**

---

## 📂 Estrutura de Storage

```
workspace-root/
├── .cappy/
│   ├── config.yaml              # Config local (pode sobrescrever global)
│   ├── stack.md                 # KnowStack do projeto
│   ├── output.txt               # Output de comandos
│   ├── tasks/                   # Tasks ativas (.ACTIVE.xml)
│   ├── history/                 # Tasks concluídas
│   └── data/                    # 📊 BANCO DE DADOS LOCAL
│       └── mini-lightrag/
│           ├── chunks.lance/    # Chunks do workspace
│           ├── nodes.lance/     # Nodes do grafo
│           ├── edges.lance/     # Edges do grafo
│           └── backup/
│               ├── chunks.json
│               ├── nodes.json
│               └── edges.json

VS Code globalStorage/
└── cappy/
    └── models/                  # 🤖 Modelos LLM compartilhados
        ├── embeddings/
        │   └── all-MiniLM-L6-v2/
        └── llm/
            └── phi-3-mini/
```

---

## ❓ Por que Banco Local?

### 1. **Isolamento de Contexto**
Cada workspace tem seu próprio domínio:
```
/projetos/ecommerce/     → Contexto de e-commerce
/projetos/data-science/  → Contexto de ciência de dados
```

Se usássemos um banco global, teríamos:
- ❌ Chunks de diferentes projetos misturados
- ❌ Grafo com nós de contextos incompatíveis
- ❌ Resultados de busca semântica irrelevantes

### 2. **Performance**
- ✅ Bancos menores = queries mais rápidas
- ✅ Índices otimizados para o contexto específico
- ✅ Sem overhead de filtrar por workspace em cada query

### 3. **Versionamento Seletivo**
```gitignore
# .gitignore
.cappy/data/    # Dados gerados, não versionados
```

Mas você PODE versionar configs:
```gitignore
# .gitignore personalizado
.cappy/data/
# .cappy/config.yaml  ← NÃO ignorado, versionado!
```

### 4. **Limpeza e Manutenção**
```bash
# Deletar banco de um projeto específico
rm -rf .cappy/data/

# Reindexar apenas um projeto
cd projeto-especifico
> CAPPY: Reindex Workspace
```

### 5. **Portabilidade**
- ✅ Compartilhar workspace com outros devs
- ✅ Cada um gera seu próprio índice local
- ✅ Sem conflitos de dados

---

## 🤖 Por que Modelos Globais?

### 1. **Evitar Redundância**
Modelo de embeddings (all-MiniLM-L6-v2):
- Tamanho: ~80MB
- Se fosse local: 80MB × N projetos = muito espaço desperdiçado

### 2. **Atualização Centralizada**
```bash
# Atualizar modelo uma vez, beneficia todos os projetos
cappy.updateEmbeddingModel
```

### 3. **Cache de Modelos**
- ✅ Primeiro projeto carrega o modelo (lento)
- ✅ Próximos projetos reusam modelo em memória (rápido)

---

## 📊 Comparação

| Aspecto | Local (`.cappy/data/`) | Global (`globalStorage`) |
|---------|------------------------|--------------------------|
| **Dados (chunks/nodes/edges)** | ✅ **SIM** | ❌ Não |
| **Modelos LLM** | ❌ Não | ✅ **SIM** |
| **Config padrão** | ❌ Não | ✅ **SIM** |
| **Config sobrescrita** | ✅ **SIM** | ❌ Não |
| **Tasks/History** | ✅ **SIM** | ❌ Não |

---

## 🔄 Migração de Dados Antigos

Se você tinha dados no globalStorage antes:

```typescript
// Script de migração (rodar uma vez)
const oldPath = context.globalStorageUri.fsPath + '/mini-lightrag';
const newPath = workspaceFolder.uri.fsPath + '/.cappy/data/mini-lightrag';

if (fs.existsSync(oldPath)) {
    await fs.promises.cp(oldPath, newPath, { recursive: true });
    console.log('✅ Dados migrados para workspace local');
    
    // Opcional: deletar dados antigos
    await fs.promises.rm(oldPath, { recursive: true });
}
```

**Mas recomendamos:** Simplesmente rodar `cappy.reindex` no workspace.

---

## 🛠️ Implementação no Código

### Antes (❌ Global)
```typescript
private async setupStorage(): Promise<string> {
    const globalStoragePath = this.extensionContext.globalStorageUri.fsPath;
    const miniLightRagPath = path.join(globalStoragePath, 'mini-lightrag');
    // ...
}
```

### Depois (✅ Local)
```typescript
private async cleanAndSetupStorage(): Promise<string> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const cappyPath = path.join(workspaceFolder.uri.fsPath, '.cappy');
    const dataPath = path.join(cappyPath, 'data');
    const miniLightRagPath = path.join(dataPath, 'mini-lightrag');
    // ...
}
```

---

## 🎯 Casos de Uso

### Caso 1: Desenvolvedor Solo
```
/meus-projetos/
├── projeto-a/
│   └── .cappy/data/       # Banco A (isolado)
└── projeto-b/
    └── .cappy/data/       # Banco B (isolado)
```

### Caso 2: Time Colaborativo
```
# Desenvolvedor 1
git clone projeto
cappy.reindex              # Gera .cappy/data/ localmente

# Desenvolvedor 2
git clone projeto          # .cappy/data/ não vem no git
cappy.reindex              # Gera .cappy/data/ localmente
```

### Caso 3: CI/CD
```yaml
# .github/workflows/cappy-analysis.yml
steps:
  - uses: actions/checkout@v2
  - run: npm install
  - run: cappy.reindex      # Gera banco temporário no CI
  - run: cappy.analyzeCode  # Usa banco para análise
  # .cappy/data/ é descartado após o job
```

---

## ✅ Benefícios Finais

1. **Clareza**: Dados locais ao contexto que representam
2. **Performance**: Queries mais rápidas em bancos menores
3. **Manutenção**: Fácil limpar/reindexar projetos específicos
4. **Economia**: Modelos compartilhados evitam redundância
5. **Portabilidade**: Workspaces podem ser compartilhados sem conflitos

---

**Versão:** 2.9.16  
**Data:** 4 de outubro de 2025  
**Status:** ✅ Implementado
