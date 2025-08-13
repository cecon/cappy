const path = require('path');
const fs = require('fs').promises;

// Simular o InitCappyCommand
class TestInitCappy {
    constructor() {
        this.extensionPath = 'd:\\projetos\\forge-framework';
    }

    async testInit() {
        const workspacePath = 'd:\\temp\\test-cappy-init';
        const cappyDir = path.join(workspacePath, '.cappy');
        const githubDir = path.join(workspacePath, '.github');

        console.log('🧪 Testando InitCappy...');

        try {
            // 1. Setup .cappy directory
            await this.setupCappyDirectory(cappyDir);
            console.log('✅ Pasta .cappy criada');

            // 2. Collect project info
            const projectInfo = await this.collectProjectInfo(workspacePath);
            console.log('✅ Informações do projeto coletadas:', projectInfo);

            // 3. Create config.yaml
            await this.createConfigYaml(cappyDir, projectInfo);
            console.log('✅ config.yaml criado');

            // 4. Inject copilot instructions
            await this.injectCopilotInstructions(githubDir, projectInfo);
            console.log('✅ Instruções Copilot injetadas');

            // 5. Copy instructions files
            await this.copyInstructionsFiles(cappyDir);
            console.log('✅ Arquivos de instruções copiados');

            // Verificar estrutura final
            await this.verifyStructure(workspacePath);

            console.log('🎉 Teste concluído com sucesso!');

        } catch (error) {
            console.error('❌ Erro no teste:', error);
        }
    }

    async setupCappyDirectory(cappyDir) {
        try {
            await fs.access(cappyDir);
            const configPath = path.join(cappyDir, 'config.yaml');
            try {
                await fs.access(configPath);
                return;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    await fs.rmdir(cappyDir, { recursive: true });
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        await fs.mkdir(cappyDir, { recursive: true });
        await fs.mkdir(path.join(cappyDir, 'tasks'), { recursive: true });
        await fs.mkdir(path.join(cappyDir, 'history'), { recursive: true });
        await fs.mkdir(path.join(cappyDir, 'instructions'), { recursive: true });
    }

    async collectProjectInfo(workspacePath) {
        const projectName = path.basename(workspacePath);
        
        // Detectar se tem package.json
        const languages = [];
        try {
            await fs.access(path.join(workspacePath, 'package.json'));
            languages.push('javascript');
        } catch (error) {
            // Ignorar se não tem
        }

        return {
            name: projectName,
            description: `Projeto ${projectName} - Desenvolvimento solo com Cappy`,
            languages: languages.length > 0 ? languages : ['unknown'],
            framework: [],
            type: languages.length > 0 ? 'node-app' : 'general'
        };
    }

    async createConfigYaml(cappyDir, projectInfo) {
        const configContent = `# Cappy Configuration
version: "1.0.0"
project:
  name: "${projectInfo.name}"
  type: "${projectInfo.type}"
  languages: 
    - ${projectInfo.languages.map(lang => `"${lang}"`).join('\n    - ')}
  frameworks:
    - ${projectInfo.framework.map(fw => `"${fw}"`).join('\n    - ')}
  description: "${projectInfo.description}"

cappy:
  initialized_at: "${new Date().toISOString()}"
  last_updated: "${new Date().toISOString()}"
  
tasks:
  directory: "tasks"
  history_directory: "history"
  
instructions:
  directory: "instructions"
`;

        const configPath = path.join(cappyDir, 'config.yaml');
        await fs.writeFile(configPath, configContent, 'utf8');
    }

    async injectCopilotInstructions(githubDir, projectInfo) {
        await fs.mkdir(githubDir, { recursive: true });
        
        const copilotInstructionsPath = path.join(githubDir, 'copilot-instructions.md');
        
        // Ler template das instruções
        const templatePath = path.join(this.extensionPath, 'resources', 'templates', 'cappy-copilot-instructions.md');
        const templateContent = await fs.readFile(templatePath, 'utf8');

        // Substituir placeholders
        const instructions = templateContent
            .replace(/{PROJECT_NAME}/g, projectInfo.name)
            .replace(/{PROJECT_TYPE}/g, projectInfo.type)
            .replace(/{MAIN_LANGUAGE}/g, projectInfo.languages.join(', '))
            .replace(/{FRAMEWORKS}/g, projectInfo.framework?.join(', ') || 'Nenhum detectado');

        const cappyInstructions = `
-- CAPYBARA MEMORY INSTRUCTIONS INIT --
${instructions}
-- CAPYBARA MEMORY INSTRUCTIONS END --
`;

        let finalContent = cappyInstructions;

        try {
            const existingContent = await fs.readFile(copilotInstructionsPath, 'utf8');
            const cleanContent = existingContent.replace(
                /-- CAPYBARA MEMORY INSTRUCTIONS INIT --[\s\S]*?-- CAPYBARA MEMORY INSTRUCTIONS END --/g,
                ''
            ).trim();
            finalContent = cleanContent ? `${cleanContent}\n\n${cappyInstructions}` : cappyInstructions;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Erro ao ler arquivo existente:', error);
            }
        }

        await fs.writeFile(copilotInstructionsPath, finalContent, 'utf8');
    }

    async copyInstructionsFiles(cappyDir) {
        const sourceDir = path.join(this.extensionPath, 'resources', 'instructions');
        const targetDir = path.join(cappyDir, 'instructions');
        await this.copyDirectory(sourceDir, targetDir);
    }

    async copyDirectory(source, destination) {
        const entries = await fs.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);
            
            if (entry.isDirectory()) {
                await fs.mkdir(destPath, { recursive: true });
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    async verifyStructure(workspacePath) {
        console.log('\n📁 Verificando estrutura criada:');
        
        const cappyDir = path.join(workspacePath, '.cappy');
        const githubDir = path.join(workspacePath, '.github');

        // Verificar estrutura .cappy
        const cappyExists = await this.fileExists(cappyDir);
        console.log(`  .cappy/: ${cappyExists ? '✅' : '❌'}`);

        const configExists = await this.fileExists(path.join(cappyDir, 'config.yaml'));
        console.log(`  .cappy/config.yaml: ${configExists ? '✅' : '❌'}`);

        const tasksExists = await this.fileExists(path.join(cappyDir, 'tasks'));
        console.log(`  .cappy/tasks/: ${tasksExists ? '✅' : '❌'}`);

        const historyExists = await this.fileExists(path.join(cappyDir, 'history'));
        console.log(`  .cappy/history/: ${historyExists ? '✅' : '❌'}`);

        const instructionsExists = await this.fileExists(path.join(cappyDir, 'instructions'));
        console.log(`  .cappy/instructions/: ${instructionsExists ? '✅' : '❌'}`);

        // Verificar alguns arquivos de instruções
    const scriptExists = await this.fileExists(path.join(cappyDir, 'instructions', 'script-new-task.xml'));
    console.log(`  .cappy/instructions/script-new-task.xml: ${scriptExists ? '✅' : '❌'}`);

        // Verificar copilot instructions
        const copilotExists = await this.fileExists(path.join(githubDir, 'copilot-instructions.md'));
        console.log(`  .github/copilot-instructions.md: ${copilotExists ? '✅' : '❌'}`);

        if (copilotExists) {
            const content = await fs.readFile(path.join(githubDir, 'copilot-instructions.md'), 'utf8');
            const hasMarkers = content.includes('-- CAPYBARA MEMORY INSTRUCTIONS INIT --');
            console.log(`    Marcadores Cappy: ${hasMarkers ? '✅' : '❌'}`);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// Executar teste
const test = new TestInitCappy();
test.testInit().catch(console.error);
