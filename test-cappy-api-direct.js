const vscode = require('vscode');

// Mock para teste fora do VS Code
if (typeof vscode === 'undefined' || !vscode.commands) {
    console.log('❌ Este script deve ser executado dentro do VS Code');
    console.log('💡 Para testar:');
    console.log('1. Abra o VS Code: code .');
    console.log('2. Abra o terminal integrado (Ctrl+`)');
    console.log('3. Execute: node test-cappy-api-direct.js');
    process.exit(1);
}

async function testCappyAPI() {
    console.log('🦫 Testando API Cappy diretamente...\n');
    
    try {
        // Teste 1: Verificar se a extensão está ativa
        console.log('1️⃣ Verificando extensão...');
        const extension = vscode.extensions.getExtension('eduardocecon.cappy');
        
        if (!extension) {
            console.log('❌ Extensão não encontrada');
            return;
        }
        
        console.log(`✅ Extensão encontrada: ${extension.id}`);
        console.log(`📦 Versão: ${extension.packageJSON.version}`);
        console.log(`🔄 Ativa: ${extension.isActive}`);
        
        if (!extension.isActive) {
            console.log('🚀 Ativando extensão...');
            await extension.activate();
        }
        
        // Teste 2: Testar comando cappy.version
        console.log('\n2️⃣ Testando cappy.version...');
        const version = await vscode.commands.executeCommand('cappy.version');
        console.log(`✅ Versão retornada: "${version}"`);
        
        // Verificar se output.txt foi criado
        setTimeout(() => {
            const fs = require('fs');
            const path = require('path');
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const outputPath = path.join(workspaceFolder.uri.fsPath, '.cappy', 'output.txt');
                
                if (fs.existsSync(outputPath)) {
                    const content = fs.readFileSync(outputPath, 'utf8');
                    console.log(`✅ output.txt criado com conteúdo: "${content}"`);
                } else {
                    console.log('❌ output.txt não foi criado');
                }
            }
        }, 500);
        
        // Teste 3: Testar outros comandos
        const commandsToTest = [
            'cappy.init',
            'cappy.knowstack',
            'cappy.new'
        ];
        
        for (const cmd of commandsToTest) {
            console.log(`\n3️⃣ Testando ${cmd}...`);
            try {
                const result = await vscode.commands.executeCommand(cmd);
                console.log(`✅ ${cmd} executado: ${result ? 'com retorno' : 'sem retorno'}`);
            } catch (error) {
                console.log(`❌ Erro em ${cmd}: ${error.message}`);
            }
        }
        
        console.log('\n🎉 Teste concluído!');
        
    } catch (error) {
        console.log(`💥 Erro geral: ${error.message}`);
    }
}

// Executar o teste
testCappyAPI();