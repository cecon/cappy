const fs = require('fs');
const path = require('path');

async function testRefresh() {
    const workspaceRoot = 'd:\\projetos\\forge-framework';
    const githubDir = path.join(workspaceRoot, '.github');
    const targetPath = path.join(githubDir, 'copilot-instructions.md');
    const templatePath = path.join(workspaceRoot, 'resources', 'templates', 'cappy-copilot-instructions.md');

    console.log('Testing refresh functionality...');
    
    try {
        // Read template
        const tpl = await fs.promises.readFile(templatePath, 'utf8');
        
        // Read existing
        const existing = await fs.promises.readFile(targetPath, 'utf8');
        
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';
        
        // Replace only the marked block
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        
        // Extract content between markers from template
        const templatePattern = new RegExp(`${start}([\\s\\S]*?)${end}`);
        const templateMatch = tpl.match(templatePattern);
        const templateContent = templateMatch ? templateMatch[1].trim() : tpl.trim();
        
        // Replace with markers preserved
        const replacement = `${start}\n${templateContent}\n${end}`;
        const updated = existing.replace(pattern, replacement);
        
        // Write the updated content
        await fs.promises.writeFile(targetPath, updated, 'utf8');
        
        console.log('✅ File updated successfully!');
        console.log('Check if the title changed from "Instruções para GitHub Copilot" to "Manual de Comandos e Fluxos"');
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testRefresh().catch(console.error);
