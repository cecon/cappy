const fs = require('fs');
const path = require('path');

// Importar as classes reais da extensão compilada
try {
    const { InitCapybaraCommand } = require('./out/commands/initCapybara');
    const { FileManager } = require('./out/utils/fileManager');
    
    console.log('✅ Classes importadas com sucesso');
    
    // Criar um teste mais realista
    async function testRealInitialization() {
        console.log('🧪 Teste REAL da inicialização do Capybara...\n');
        
        const testWorkspacePath = 'd:\\projetos\\test-capybara-real';
        
        // Criar workspace de teste
        try {
            await fs.promises.rm(testWorkspacePath, { recursive: true, force: true });
        } catch (e) {
            // Ignorar se não existir
        }
        
        await fs.promises.mkdir(testWorkspacePath, { recursive: true });
        await fs.promises.writeFile(path.join(testWorkspacePath, 'package.json'), JSON.stringify({
            name: 'test-project',
            version: '1.0.0'
        }, null, 2));
        
        console.log('📁 Workspace de teste criado:', testWorkspacePath);
        
        // Simular vscode.workspace
        const mockVscode = {
            workspace: {
                workspaceFolders: [{
                    uri: { fsPath: testWorkspacePath }
                }]
            },
            window: {
                withProgress: async (options, callback) => {
                    console.log('📊 Progress:', options.title);
                    const mockProgress = {
                        report: (data) => console.log(`   ${data.increment}% - ${data.message}`)
                    };
                    return await callback(mockProgress);
                },
                showInformationMessage: (message, ...buttons) => {
                    console.log('ℹ️ Info:', message);
                    return Promise.resolve(buttons[0]); // Simular clique no primeiro botão
                },
                showWarningMessage: (message, ...buttons) => {
                    console.log('⚠️ Warning:', message);
                    return Promise.resolve(buttons[0]);
                }
            }
        };
        
        // Substituir globalmente o vscode
        global.vscode = mockVscode;
        
        try {
            // Criar instância real das classes
            const fileManager = new FileManager();
            const initCommand = new InitCapybaraCommand(fileManager);
            
            console.log('🚀 Executando InitCapybaraCommand...\n');
            
            // Executar o comando real
            const result = await initCommand.execute();
            
            console.log('\\n📋 Resultado da execução:', result);
            
            // Verificar estrutura criada
            console.log('\\n🔍 Verificando estrutura criada...');
            
            const expectedDirs = [
                '.capy',
                '.capy/history',
                '.capy/instructions', 
                '.capy/tasks',
                '.github'
            ];
            
            const expectedFiles = [
                '.capy/config.json',
                '.capy/prevention-rules.md',
                '.capy/instructions/capybara-task-file-structure-info.md'
            ];
            
            for (const dir of expectedDirs) {
                const fullPath = path.join(testWorkspacePath, dir);
                try {
                    await fs.promises.access(fullPath, fs.constants.F_OK);
                    console.log('✅ Diretório:', dir);
                } catch (e) {
                    console.log('❌ Diretório FALTANDO:', dir);
                }
            }
            
            for (const file of expectedFiles) {
                const fullPath = path.join(testWorkspacePath, file);
                try {
                    const stats = await fs.promises.stat(fullPath);
                    console.log('✅ Arquivo:', file, `(${stats.size} bytes)`);
                } catch (e) {
                    console.log('❌ Arquivo FALTANDO:', file);
                }
            }
            
            // Verificar conteúdo do config
            try {
                const configPath = path.join(testWorkspacePath, '.capy/config.json');
                const configContent = await fs.promises.readFile(configPath, 'utf8');
                const config = JSON.parse(configContent);
                console.log('\\n📄 Configuração criada:');
                console.log('   - Nome do projeto:', config.project?.name);
                console.log('   - Linguagens:', config.project?.language);
                console.log('   - Versão:', config.version);
                console.log('   - Data de criação:', config.createdAt);
            } catch (e) {
                console.log('❌ Erro ao ler configuração:', e.message);
            }
            
        } catch (error) {
            console.error('❌ Erro durante execução real:', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    // Executar teste
    testRealInitialization();
    
} catch (importError) {
    console.error('❌ Erro ao importar classes da extensão:', importError);
    console.log('\\nℹ️ Certifique-se de que a extensão foi compilada com: npm run compile');
}
