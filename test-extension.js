const fs = require('fs');
const path = require('path');

async function insertTestContent() {
    const filePath = 'd:\\projetos\\forge-framework\\.github\\copilot-instructions.md';
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';
        
        const testContent = `${start}
# 🔨 Cappy — TESTE FINAL DA EXTENSÃO (LLM Runtime)

## Este conteúdo deve ser substituído pelo comando init
- Se você ainda vê "TESTE FINAL DA EXTENSÃO" após executar init, o problema persiste
- O título deveria mudar para "Manual de Comandos e Fluxos"
- Agora com logs detalhados no output.txt
${end}`;
        
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        const updated = content.replace(pattern, testContent);
        
        await fs.promises.writeFile(filePath, updated, 'utf8');
        console.log('✅ Conteúdo de teste inserido!');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

insertTestContent().catch(console.error);
