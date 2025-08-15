const fs = require('fs');
const path = require('path');

async function insertTestContentAgain() {
    const filePath = 'd:\\projetos\\forge-framework\\.github\\copilot-instructions.md';
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';
        
        const testContent = `${start}
# 🔨 Cappy — VERSÃO ANTERIOR PARA TESTE (LLM Runtime)

## Este é conteúdo antigo para verificar se o comando init funciona
- Este conteúdo deve ser **substituído** quando executar cappy init
- Se você ver este texto após executar o init, significa que há um problema
- O título deveria mudar para "Manual de Comandos e Fluxos"

---

## 🧭 Regras Antigas
1. Esta é uma versão antiga das regras
2. Deveria ser substituída pelo template novo

${end}`;
        
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        const updated = content.replace(pattern, testContent);
        
        await fs.promises.writeFile(filePath, updated, 'utf8');
        console.log('✅ Test content inserted!');
        console.log('🔧 Now execute "Cappy: Initialize" from VS Code Command Palette (Ctrl+Shift+P)');
        console.log('📝 Check if the title changes from "VERSÃO ANTERIOR PARA TESTE" to "Manual de Comandos e Fluxos"');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

insertTestContentAgain().catch(console.error);
