const fs = require('fs');
const path = require('path');

async function forceUpdateCopilotInstructions() {
    console.log('🔧 Forçando atualização do copilot-instructions.md...');
    
    const workspaceRoot = 'd:\\projetos\\forge-framework';
    const targetPath = path.join(workspaceRoot, '.github', 'copilot-instructions.md');
    const templatePath = path.join(workspaceRoot, 'resources', 'templates', 'cappy-copilot-instructions.md');
    
    console.log('📍 Paths:', { targetPath, templatePath });
    
    try {
        // Verificar se os arquivos existem
        console.log('📋 Template existe:', fs.existsSync(templatePath));
        console.log('📋 Target existe:', fs.existsSync(targetPath));
        
        if (!fs.existsSync(templatePath)) {
            console.error('❌ Template não encontrado!');
            return;
        }
        
        if (!fs.existsSync(targetPath)) {
            console.error('❌ Target não encontrado!');
            return;
        }
        
        // Ler arquivos
        const template = await fs.promises.readFile(templatePath, 'utf8');
        const existing = await fs.promises.readFile(targetPath, 'utf8');
        
        console.log('📊 Tamanhos - Template:', template.length, 'Existing:', existing.length);
        
        const start = '<!-- CAPPY INI -->';
        const end = '<!-- CAPPY END -->';
        
        const hasStart = existing.includes(start);
        const hasEnd = existing.includes(end);
        
        console.log('🔍 Marcadores encontrados:', { hasStart, hasEnd });
        
        if (!hasStart || !hasEnd) {
            console.log('⚠️ Marcadores não encontrados, substituindo arquivo inteiro');
            await fs.promises.writeFile(targetPath, template, 'utf8');
            console.log('✅ Arquivo substituído completamente');
            return;
        }
        
        // Extrair conteúdo do template entre os marcadores
        const templatePattern = new RegExp(`${start}([\\s\\S]*?)${end}`);
        const templateMatch = template.match(templatePattern);
        
        if (!templateMatch) {
            console.error('❌ Não foi possível extrair conteúdo do template');
            return;
        }
        
        const templateContent = templateMatch[1].trim();
        console.log('📝 Conteúdo do template extraído, tamanho:', templateContent.length);
        
        // Substituir apenas o bloco marcado
        const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
        const replacement = `${start}\n${templateContent}\n${end}`;
        const updated = existing.replace(pattern, replacement);
        
        console.log('🔄 Substituição feita:');
        console.log('  - Tamanho original:', existing.length);
        console.log('  - Tamanho atualizado:', updated.length);
        console.log('  - Conteúdo alterado:', updated !== existing);
        
        if (updated === existing) {
            console.log('⚠️ Nenhuma mudança detectada');
            return;
        }
        
        // Escrever arquivo atualizado
        await fs.promises.writeFile(targetPath, updated, 'utf8');
        console.log('✅ Arquivo atualizado com sucesso!');
        
        // Verificar o título
        const titlePattern = /# 🔨 Cappy — (.+) \(LLM Runtime\)/;
        const oldTitle = existing.match(titlePattern)?.[1];
        const newTitle = updated.match(titlePattern)?.[1];
        
        console.log(`📊 Mudança de título: "${oldTitle}" → "${newTitle}"`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

forceUpdateCopilotInstructions().catch(console.error);
