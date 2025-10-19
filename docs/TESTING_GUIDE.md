# Guia de Teste - Resetar e Reindexar Database

## 🎯 Objetivo

Limpar completamente o database do grafo e reindexar o workspace do zero para garantir dados limpos e testar o sistema de diagnóstico.

## 📋 Passo a Passo

### 1. Recarregar a Extensão

**Opção A - Se estiver no VS Code de desenvolvimento:**
- Pressione `F5` para recarregar a janela de extensão

**Opção B - Se estiver no VS Code normal:**
- `Cmd+Shift+P` → "Developer: Reload Window"
- Ou feche e abra o VS Code novamente

### 2. Resetar o Database

1. Abra o Command Palette: `Cmd+Shift+P`
2. Digite: **"Cappy: Reset Graph Database"**
3. Selecione o comando
4. Confirme no dialog: **"Yes, Reset Database"**

**Resultado esperado:**
```
✅ Database reset successfully! Now run "Cappy: Scan Workspace" to reindex.
```

### 3. Verificar que o Database Está Vazio

1. `Cmd+Shift+P` → **"Cappy: Open Graph"**
2. O grafo deve estar vazio (0 nodes, 0 edges)
3. Ou mostrar apenas o workspace node

### 4. Reindexar o Workspace

1. `Cmd+Shift+P` → **"Cappy: Scan Workspace"**
2. Aguarde o processo de indexação
3. Observe o progresso no terminal/output

**O que acontece:**
- Escaneia todos os arquivos `.ts`, `.tsx`, `.js`, `.jsx`
- Extrai chunks (funções, classes, interfaces, etc.)
- Cria nós no grafo
- Cria relacionamentos CONTAINS (file → chunk)
- Tenta criar relacionamentos REFERENCES (chunk → chunk)

**Tempo estimado:** 2-10 minutos dependendo do tamanho do workspace

### 5. Verificar o Grafo Atualizado

1. `Cmd+Shift+P` → **"Cappy: Open Graph"**
2. Teste diferentes profundidades:
   - Depth 2
   - Depth 4
   - Depth 6
3. Observe quantos nós e edges aparecem

### 6. Rodar o Diagnóstico

1. `Cmd+Shift+P` → **"Cappy: Diagnose Graph Structure"**
2. Aguarde a análise completar
3. Veja o output no painel **"Cappy Graph Diagnostics"**

**O que o diagnóstico vai mostrar:**
```
🔍 Starting Graph Diagnostics...

📂 Loading all indexed files...
   Found X files

🔬 Analyzing file structure...
   📄 arquivo1.ts: Y chunks
      📥 Z imports: ...
      📤 W exports: ...
      📞 N function calls detected
      🏷️  M type references

🔗 Analyzing relationships...
   Total relationships: X

📊 Testing graph depth traversal...
   Depth 1: X nodes, Y edges
   Depth 2: X nodes, Y edges
   Depth 3: X nodes, Y edges
   ...

⚠️  Issues Found:
   [Lista de problemas identificados]

💡 Recommendations:
   [Sugestões de melhorias]
```

### 7. Copiar e Compartilhar o Output

1. No painel "Cappy Graph Diagnostics", selecione TODO o texto (`Cmd+A`)
2. Copie (`Cmd+C`)
3. Cole aqui na conversa

**Isso me permitirá:**
- Ver exatamente o estado atual do grafo
- Identificar problemas específicos
- Implementar correções direcionadas
- Verificar se os relacionamentos estão sendo criados

### 8. (Opcional) Reanalizar Relacionamentos

Se o diagnóstico mostrar poucos relacionamentos:

1. `Cmd+Shift+P` → **"Cappy: Reanalyze All Relationships"**
2. Aguarde o processo
3. Rode o diagnóstico novamente: **"Cappy: Diagnose Graph Structure"**
4. Compare os resultados

## 🔍 O Que Observar

### Sinais de Problema:

❌ **Profundidade rasa:**
```
Depth 1: 50 nodes
Depth 2: 50 nodes  ← Não aumenta!
Depth 3: 50 nodes
```

❌ **Poucos relacionamentos:**
```
Total files: 50
Total chunks: 300
Total relationships: 300  ← Apenas CONTAINS (1:1 com chunks)
```

❌ **Imports sem cross-file references:**
```
Files with imports: 45
Cross-file references: 0  ← PROBLEMA!
```

### Sinais de Sucesso:

✅ **Profundidade crescente:**
```
Depth 1: 50 nodes
Depth 2: 150 nodes  ← Aumenta!
Depth 3: 280 nodes
Depth 4: 320 nodes
```

✅ **Relacionamentos ricos:**
```
Total relationships: 1200+
  - 300 CONTAINS
  - 400 REFERENCES (intra-file)
  - 200 IMPORTS (cross-file)
  - 300 DOCUMENTS (jsdoc)
```

✅ **Imports conectados:**
```
Files with imports: 45
Cross-file references: 180  ← Conectados!
```

## 📊 Comandos Disponíveis

| Comando | Descrição | Quando Usar |
|---------|-----------|-------------|
| `cappy.resetDatabase` | Limpa o database | Antes de reindexar do zero |
| `cappy.scanWorkspace` | Indexa todos os arquivos | Após reset ou para indexar novos arquivos |
| `cappy.diagnoseGraph` | Analisa estrutura do grafo | Para verificar estado e problemas |
| `cappy.reanalyzeRelationships` | Recria relacionamentos | Se houver poucos relacionamentos |
| `cappy.openGraph` | Visualiza o grafo | Para ver visualmente os nós e edges |

## 🐛 Troubleshooting

### Database não reseta?
- Verifique se `.cappy/data/graph.db` existe
- Tente deletar manualmente o arquivo
- Recarregue a extensão

### Scan não encontra arquivos?
- Verifique se há workspace aberto
- Verifique `.gitignore` e patterns de exclusão
- Cheque o console de logs

### Grafo vazio após scan?
- Veja logs no terminal
- Verifique se houve erros de parsing
- Tente processar um arquivo individual primeiro

### Diagnóstico falha?
- Verifique se graphStore está inicializado
- Veja logs de erro no console
- Tente recarregar a extensão

## ✅ Checklist de Teste

- [ ] Extensão recarregada
- [ ] Database resetado com sucesso
- [ ] Grafo verificado (vazio)
- [ ] Workspace escaneado
- [ ] Grafo atualizado (com dados)
- [ ] Diagnóstico executado
- [ ] Output completo copiado
- [ ] Output compartilhado aqui

## 📝 Próximos Passos

Após compartilhar o output do diagnóstico:

1. ✅ **Analisarei** os dados coletados
2. 🔧 **Identificarei** problemas específicos
3. 💡 **Implementarei** correções no AST Extractor
4. 🚀 **Testaremos** as melhorias
5. 📊 **Validaremos** com novo diagnóstico

---

**Data:** 19 de outubro de 2025
**Versão:** 3.0.4
**Status:** Pronto para teste! 🚀
