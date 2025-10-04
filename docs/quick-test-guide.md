# 🧪 Quick Test Guide - LightRAG Upload UI

## Teste Imediato

### 1. Recarregar Extensão
```bash
# No VS Code
Ctrl+Shift+P → "Developer: Reload Window"
```

### 2. Abrir Interface de Upload
```bash
# Command Palette
Ctrl+Shift+P → "LightRAG: Upload Documents"
```

### 3. Testar Upload Flow

**Arquivo de Teste**: Use qualquer PDF, DOCX, TXT ou MD (max 50MB)

**Fluxo Completo**:
1. **Upload Zone**: Click ou drag & drop
2. **File Info**: Verificar preview do arquivo
3. **Metadata**: 
   - Title: "Documento Teste" (min 3 chars)
   - Description: "Teste do sistema LightRAG" (min 10 chars)
   - Category: Escolher qualquer
   - Tags: Digite "teste" + Enter, "lightrag" + Enter
4. **Options**: Deixar "Map Relationships" selecionado
5. **Process**: Click "Process Document"
6. **Progress**: Observar animação dos steps
7. **Results**: Ver estatísticas finais

## Verificações Rápidas

### ✅ Interface Visual
- [ ] Gradient azul carregou
- [ ] Upload zone responsiva ao hover
- [ ] Botões com animações suaves
- [ ] Progress bars funcionando

### ✅ Validação
- [ ] Erro se title < 3 caracteres
- [ ] Erro se description < 10 caracteres
- [ ] Botão "Process" disabled até preencher
- [ ] Tags adicionadas/removidas corretamente

### ✅ Processamento
- [ ] Steps animam em sequência
- [ ] Progress bar aumenta gradualmente
- [ ] Resultado final mostra estatísticas
- [ ] Reset button funciona

## Debug (se necessário)

### Console Logs
```bash
# Abrir DevTools
Ctrl+Shift+I → Console tab
# Procurar por mensagens do LightRAG
```

### Comandos Registrados
```javascript
// No console do DevTools
vscode.commands.getCommands().then(cmds => 
  console.log(cmds.filter(c => c.includes('lightrag')))
);
```

### MCP Tools Status
```bash
# Command Palette
Ctrl+Shift+P → buscar "lightrag"
# Deve aparecer: "LightRAG: Upload Documents"
```

## 🎯 Pontos de Atenção

### Se Upload Zone não Responder
- Verificar se arquivo está nos formatos suportados
- Tentar com arquivo menor primeiro
- Usar file picker em vez de drag & drop

### Se Processing Trava
- Normal durante desenvolvimento (LLM ainda não conectado)
- Progress vai simular o processamento
- Results vão mostrar dados mockados

### Se UI não Carrega
- Recarregar window (Ctrl+R no webview)
- Verificar console para erros
- Reinstalar extensão se necessário

## 🚀 Próximos Passos

Após teste bem-sucedido:

1. **Conectar LLM real** para entity extraction
2. **Implementar LanceDB** para storage persistente  
3. **Adicionar batch upload** para múltiplos arquivos
4. **Criar graph viewer** para visualizar entidades/relacionamentos

## 📱 Screenshots Esperadas

**Upload Zone**: Área azul com ícone de pasta e texto "Drop your document here"

**File Selected**: Card cinza com ícone, nome do arquivo e metadados

**Metadata Form**: Campos de input com labels, dropdown de categoria, tags em pills azuis

**Processing**: Progress bar azul com 5 steps (Extract Text → Chunk → Entities → Relations → Save)

**Results**: Card verde com estatísticas: "42 Entities, 18 Relationships, 12 Chunks, 8 Key Insights"

---

**Tudo pronto para teste! 🎉** 

O sistema está 100% funcional para demonstração. A única parte que vai simular é o processamento real (que depois conectamos com LLM e LanceDB).