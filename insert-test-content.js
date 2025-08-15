const fs = require('fs');
const path = require('path');

async function replaceWithTestContent() {
    const filePath = 'd:\\projetos\\forge-framework\\.github\\copilot-instructions.md';
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';
        
        const testContent = `${start}
# 🔨 Cappy — TESTE ANTIGO (LLM Runtime)

## Conteúdo antigo para testar
Este é um conteúdo antigo que deve ser substituído.
- Criar/gerir **tarefas atômicas** em XML.
- Registrar progresso com **poucas linhas** e **sem subjetividade**.
- Reaproveitar **KnowStack** e **Prevention Rules** para reduzir erros.

---

## 🧭 Regras de Ouro
1. **Comando manda** — mensagens iniciadas com \`cappy:\` têm prioridade máxima.  
2. **Fonte única de retorno** — após executar um comando, **leia exclusivamente** \`.cappy/output.txt\`.  
   - Se o arquivo **não existir** ou vier **vazio**, **pare** e informe em **1 linha**:  
     \`⚠️ Comando sem saída em .cappy/output.txt. Reexecute no VS Code.\`
3. **Pergunte 1×1** — quando precisar de contexto, faça **uma pergunta por vez**, até eliminar ambiguidade.  
4. **Respostas curtas** — 2–5 linhas, sempre apontando o **próximo passo**.  
5. **Escopo atômico** — uma task ≤ **3h** de esforço. Se exceder: **interrompa** e recomende decomposição.

---

## 📂 Estrutura de Arquivos
\`\`\`
.cappy/
 ├─ tasks/                  # Tarefas ativas (.active.xml)
 ├─ history/                # Tarefas concluídas
 ├─ prevention-rules.md     # Regras de prevenção
 ├─ config.yaml             # Configuração do Cappy
 ├─ stack.md                # KnowStack do projeto
 └─ output.txt              # Resultado do último comando executado (fonte única)
\`\`\`
${end}`;
        
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        const updated = content.replace(pattern, testContent);
        
        await fs.promises.writeFile(filePath, updated, 'utf8');
        console.log('✅ Test content inserted successfully!');
        console.log('Now the file has old content that should be replaced by cappy init.');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

replaceWithTestContent().catch(console.error);
