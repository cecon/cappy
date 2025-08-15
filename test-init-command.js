const fs = require('fs');
const path = require('path');

async function testInitCommand() {
    console.log('🧪 Testing cappy init refresh functionality...');
    
    const workspaceRoot = 'd:\\projetos\\forge-framework';
    const githubDir = path.join(workspaceRoot, '.github');
    const targetPath = path.join(githubDir, 'copilot-instructions.md');
    const templatePath = path.join(workspaceRoot, 'resources', 'templates', 'cappy-copilot-instructions.md');

    try {
        console.log('📄 Reading template and existing files...');
        
        const tpl = await fs.promises.readFile(templatePath, 'utf8');
        const existing = await fs.promises.readFile(targetPath, 'utf8');
        
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';

        const hasStart = existing.includes(start);
        const hasEnd = existing.includes(end);
        
        console.log(`🔍 Markers found - start: ${hasStart}, end: ${hasEnd}`);

        if (!hasStart || !hasEnd) {
            console.log('❌ No markers found, would overwrite entire file');
            await fs.promises.writeFile(targetPath, tpl, 'utf8');
            console.log('✅ Entire file overwritten with template');
            return;
        }

        console.log('🔄 Replacing marked block...');
        
        // Replace only the marked block
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        
        // Extract content between markers from template
        const templatePattern = new RegExp(`${start}([\\s\\S]*?)${end}`);
        const templateMatch = tpl.match(templatePattern);
        const templateContent = templateMatch ? templateMatch[1].trim() : tpl.trim();
        
        // Replace with markers preserved
        const replacement = `${start}\n${templateContent}\n${end}`;
        const updated = existing.replace(pattern, replacement);
        
        if (updated === existing) {
            console.log('⚠️ No changes detected - content might be identical');
        } else {
            console.log('✅ Changes detected, writing updated content...');
            await fs.promises.writeFile(targetPath, updated, 'utf8');
            console.log('📝 File updated successfully!');
            
            // Check if the title changed
            const titlePattern = /# 🔨 Cappy — (.+) \(LLM Runtime\)/;
            const oldTitle = existing.match(titlePattern)?.[1];
            const newTitle = updated.match(titlePattern)?.[1];
            
            console.log(`📊 Title change: "${oldTitle}" → "${newTitle}"`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testInitCommand().catch(console.error);
