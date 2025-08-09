# Sistema de Versionamento de Instruções - Capybara

## 🎯 **Como Funciona**

O sistema de versionamento garante que as instruções LLM estejam sempre atualizadas automaticamente.

### **Fluxo de Atualização:**

1. **Verificação de Versão**: `initCapybara.ts` compara `config.instructionsVersion` com versão da extensão
2. **Atualização Automática**: Se versão for diferente, remove `.capy/instructions/` e copia nova versão
3. **Fonte Única**: Todos os arquivos vêm de `resources/instructions/`
4. **Preservação de Dados**: Apenas instructions são atualizadas, config e prevention-rules são mantidos

### **Estrutura do Sistema:**

```
Extension:
├── resources/instructions/          ← FONTE DE VERDADE
│   ├── capybara-methodology.md     ← Princípios Capybara
│   ├── capybara-patterns.md        ← Padrões de decomposição  
│   ├── script-new-task.xml         ← Script: New task (create and prepare)
│   ├── script-view-current-task.xml    ← Script: Ver progresso
│   ├── script-marcar-step-concluido.md ← Script: Completar step
│   └── script-completar-task.md    ← Script: Finalizar task

Projeto:
├── .capy/
│   ├── config.json                 ← { instructionsVersion: "2.0.0" }
│   ├── instructions/               ← CÓPIA AUTOMÁTICA de resources/
│   ├── tasks/                      ← Tasks ativas
│   ├── history/                    ← Tasks finalizadas
│   └── prevention-rules.md         ← Regras específicas do projeto
```

### **Versionamento:**

- **v1.0.0**: Sistema inicial com XML básico
- **v2.0.0**: Scripts LLM + comandos virtuais + patterns + methodology  
- **v2.1.0**: (Futuro) Novas funcionalidades...

### **Código Responsável:**

```typescript
// src/models/capybaraConfig.ts
instructionsVersion: '2.0.0'  // ← Versão atual

// src/commands/initCapybara.ts
await this.updateInstructionsFiles(capyDir, config);
```

### **Benefícios:**

✅ **Atualizações Automáticas**: Nova versão da extensão = instruções atualizadas  
✅ **Sem Conflitos**: Remove pasta antiga e cria nova  
✅ **Preservação**: Config e prevention-rules são mantidos  
✅ **Fallback**: Se algo falhar, cria instruções básicas  
✅ **Versionamento**: Controle preciso de compatibilidade  

### **Para Desenvolvedores:**

1. **Adicionar nova instrução**: Criar arquivo em `resources/instructions/`
2. **Atualizar versão**: Incrementar `instructionsVersion` em `capybaraConfig.ts`
3. **Deploy**: Usuários recebem automática na próxima inicialização

---

**Resultado**: Sistema robusto que mantém instruções sempre atualizadas sem intervenção manual! 🚀
