// Teste das APIs do Cappy
const vscode = require('vscode');

async function testCappyAPIs() {
    console.log('🦫 Testando APIs do Cappy...');
    
    try {
        // Teste 1: Verificar se a extensão está ativa
        console.log('\n1️⃣ Verificando extensão...');
        const extension = vscode.extensions.getExtension('eduardocecon.cappy');
        if (extension) {
            console.log('✅ Extensão encontrada:', extension.id);
            console.log('📦 Versão:', extension.packageJSON.version);
            console.log('🔄 Ativa:', extension.isActive);
            
            if (!extension.isActive) {
                await extension.activate();
                console.log('🚀 Extensão ativada');
            }
        } else {
            console.log('❌ Extensão não encontrada');
            return;
        }

        // Teste 2: Testar comando de versão
        console.log('\n2️⃣ Testando cappy.version...');
        try {
            const version = await vscode.commands.executeCommand('cappy.version');
            console.log('✅ Versão retornada:', version);
        } catch (error) {
            console.log('❌ Erro no cappy.version:', error.message);
        }

        // Teste 3: Testar comando init
        console.log('\n3️⃣ Testando cappy.init...');
        try {
            const initResult = await vscode.commands.executeCommand('cappy.init');
            console.log('✅ Init executado:', initResult ? 'com retorno' : 'sem retorno');
        } catch (error) {
            console.log('❌ Erro no cappy.init:', error.message);
        }

        // Teste 4: Verificar estrutura criada
        console.log('\n4️⃣ Verificando estrutura .cappy...');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const cappyPath = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy');
            try {
                const stat = await vscode.workspace.fs.stat(cappyPath);
                console.log('✅ Pasta .cappy existe');
                
                // Verificar arquivos importantes
                const files = ['config.yaml', 'output.txt'];
                for (const file of files) {
                    try {
                        const filePath = vscode.Uri.joinPath(cappyPath, file);
                        await vscode.workspace.fs.stat(filePath);
                        console.log(`✅ ${file} existe`);
                    } catch {
                        console.log(`⚠️ ${file} não encontrado`);
                    }
                }
            } catch {
                console.log('❌ Pasta .cappy não existe');
            }
        }

        // Teste 5: Testar comando knowstack
        console.log('\n5️⃣ Testando cappy.knowstack...');
        try {
            const knowstackResult = await vscode.commands.executeCommand('cappy.knowstack');
            console.log('✅ KnowStack executado:', knowstackResult ? 'com retorno' : 'sem retorno');
            
            // Verificar se criou o stack.md
            if (workspaceFolder) {
                const stackPath = vscode.Uri.joinPath(workspaceFolder.uri, '.cappy', 'stack.md');
                try {
                    await vscode.workspace.fs.stat(stackPath);
                    console.log('✅ stack.md criado');
                } catch {
                    console.log('⚠️ stack.md não encontrado');
                }
            }
        } catch (error) {
            console.log('❌ Erro no cappy.knowstack:', error.message);
        }

        // Teste 6: Testar comando new task
        console.log('\n6️⃣ Testando cappy.new...');
        try {
            const newTaskResult = await vscode.commands.executeCommand('cappy.new');
            console.log('✅ New task executado:', newTaskResult ? 'com retorno' : 'sem retorno');
        } catch (error) {
            console.log('❌ Erro no cappy.new:', error.message);
        }

        // Teste 7: Listar todos os comandos disponíveis
        console.log('\n7️⃣ Comandos Cappy disponíveis:');
        const allCommands = await vscode.commands.getCommands();
        const cappyCommands = allCommands.filter(cmd => cmd.startsWith('cappy.'));
        cappyCommands.forEach(cmd => console.log(`📋 ${cmd}`));

        console.log('\n🎉 Teste concluído!');

    } catch (error) {
        console.log('💥 Erro geral:', error);
    }
}

// Exportar para uso em ambiente de teste
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testCappyAPIs };
}

// Se estiver sendo executado diretamente no VS Code
if (typeof vscode !== 'undefined') {
    testCappyAPIs();
}