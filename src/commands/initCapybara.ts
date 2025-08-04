import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from '../utils/fileManager';
import { CapybaraConfig, DEFAULT_CAPYBARA_CONFIG } from '../models/capybaraConfig';

export class InitCapybaraCommand {
    constructor(
        private fileManager: FileManager,
        private extensionContext?: vscode.ExtensionContext
    ) {}

    async execute(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const openFolder = await vscode.window.showInformationMessage(
                    '� Capybara precisa de uma pasta de projeto para ser inicializado.\n\nAbra uma pasta primeiro e depois execute "Capybara: Initialize" novamente.',
                    'Abrir Pasta', 'Cancelar'
                );
                
                if (openFolder === 'Abrir Pasta') {
                    try {
                        await vscode.commands.executeCommand('vscode.openFolder');
                    } catch (error) {
                        // Silently handle error - user can open folder manually
                        vscode.window.showInformationMessage('Por favor, abra uma pasta manualmente via File > Open Folder');
                    }
                }
                return false;
            }

            const capyDir = path.join(workspaceFolder.uri.fsPath, '.capy');
            const githubDir = path.join(workspaceFolder.uri.fsPath, '.github');

            // Verificar se já existe
            try {
                await fs.promises.access(capyDir, fs.constants.F_OK);
                const overwrite = await vscode.window.showWarningMessage(
                    '⚠️ Capybara já foi inicializado neste projeto. Sobrescrever?',
                    'Sim', 'Não'
                );
                if (overwrite !== 'Sim') {
                    return false;
                }
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            // Mostrar progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔨 Inicializando Capybara',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Criando estrutura...' });
                
                // 1. Criar estrutura básica
                await fs.promises.mkdir(capyDir, { recursive: true });
                await fs.promises.mkdir(githubDir, { recursive: true });
                await fs.promises.mkdir(path.join(capyDir, 'history'), { recursive: true });
                await fs.promises.mkdir(path.join(capyDir, 'instructions'), { recursive: true });
                await fs.promises.mkdir(path.join(capyDir, 'tasks'), { recursive: true });

                progress.report({ increment: 20, message: 'Coletando informações do projeto...' });

                // 2. Coletar informações do projeto
                const projectInfo = await this.collectProjectInfo(workspaceFolder.uri.fsPath);

                progress.report({ increment: 40, message: 'Configurando Capybara...' });

                // 3. Criar configuração
                const config: CapybaraConfig = {
                    version: DEFAULT_CAPYBARA_CONFIG.version || '1.0.0',
                    project: {
                        name: projectInfo.name,
                        language: projectInfo.languages && projectInfo.languages.length > 0 ? projectInfo.languages : ['unknown'],
                        framework: projectInfo.framework || [],
                        description: projectInfo.description
                    },
                    stack: DEFAULT_CAPYBARA_CONFIG.stack!,
                    environment: DEFAULT_CAPYBARA_CONFIG.environment!,
                    context: DEFAULT_CAPYBARA_CONFIG.context!,
                    tasks: DEFAULT_CAPYBARA_CONFIG.tasks!,
                    ai: DEFAULT_CAPYBARA_CONFIG.ai!,
                    analytics: DEFAULT_CAPYBARA_CONFIG.analytics!,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                };

                progress.report({ increment: 60, message: 'Criando arquivos de configuração...' });

                // 4. Salvar configuração
                await this.fileManager.writeCapybaraConfig(config);

                progress.report({ increment: 80, message: 'Criando instruções para Copilot...' });

                // 5. Criar instruções personalizadas para Copilot
                await this.createOrUpdateCopilotInstructions(config, githubDir, projectInfo);

                // 6. Injetar arquivo de instruções XML para LLM
                await this.injectTaskInstructionsFile(capyDir);

                // 7. Criar arquivo de prevention rules
                await this.createInitialPreventionRules(capyDir);

                // 8. Adicionar ao .gitignore
                await this.updateGitignore(workspaceFolder.uri.fsPath);

                progress.report({ increment: 100, message: 'Finalizado!' });

                vscode.window.showInformationMessage(
                    '🎉 Capybara inicializado com sucesso! Use "Capybara: Create New Task" para começar.'
                );

                return true;
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Erro ao inicializar Capybara: ${error}`);
            return false;
        }
    }

    private async collectProjectInfo(workspacePath: string): Promise<any> {
        const projectName = path.basename(workspacePath);
        
        // Detectar linguagens
        const languages = await this.detectLanguages(workspacePath);
        
        // Detectar frameworks
        const frameworks = await this.detectFrameworks(workspacePath);

        return {
            name: projectName,
            description: `Projeto ${projectName} - Desenvolvimento solo com Capybara`,
            language: languages.length > 0 ? languages[0] : 'unknown',
            languages: languages,
            framework: frameworks,
            type: this.inferProjectType(languages, frameworks)
        };
    }

    private async detectLanguages(workspacePath: string): Promise<string[]> {
        const languages: string[] = [];
        
        // Verificar arquivos comuns
        try {
            await fs.promises.access(path.join(workspacePath, 'package.json'), fs.constants.F_OK);
            languages.push('javascript');
            
            // Verificar se é TypeScript
            try {
                await fs.promises.access(path.join(workspacePath, 'tsconfig.json'), fs.constants.F_OK);
                languages.push('typescript');
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // Check for .ts files
                    if (await this.hasFilesWithExtension(workspacePath, '.ts')) {
                        languages.push('typescript');
                    }
                }
            }
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('Error checking package.json:', error);
            }
        }
        
        if (await this.hasFilesWithExtension(workspacePath, '.py')) {
            languages.push('python');
        }
        
        if (await this.hasFilesWithExtension(workspacePath, '.cs')) {
            languages.push('csharp');
        }
        
        if (await this.hasFilesWithExtension(workspacePath, '.java')) {
            languages.push('java');
        }
        
        return languages;
    }

    private async detectFrameworks(workspacePath: string): Promise<string[]> {
        const frameworks: string[] = [];
        
        try {
            const packageJsonPath = path.join(workspacePath, 'package.json');
            try {
                await fs.promises.access(packageJsonPath, fs.constants.F_OK);
                const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf8');
                const packageJson = JSON.parse(packageJsonContent);
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                if (deps['react']) { frameworks.push('react'); }
                if (deps['next']) { frameworks.push('nextjs'); }
                if (deps['vue']) { frameworks.push('vue'); }
                if (deps['@angular/core']) { frameworks.push('angular'); }
                if (deps['express']) { frameworks.push('express'); }
                if (deps['vscode']) { frameworks.push('vscode-extension'); }
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    console.error('Error reading package.json:', error);
                }
            }
        } catch (error) {
            // Ignore errors
        }
        
        return frameworks;
    }

    private async hasFilesWithExtension(dirPath: string, extension: string): Promise<boolean> {
        try {
            const files = await fs.promises.readdir(dirPath);
            return files.some((file: string) => file.endsWith(extension));
        } catch {
            return false;
        }
    }

    private inferProjectType(languages: string[], frameworks: string[]): string {
        if (frameworks.includes('vscode-extension')) { return 'vscode-extension'; }
        if (frameworks.includes('nextjs')) { return 'web-app'; }
        if (frameworks.includes('react')) { return 'web-app'; }
        if (languages.includes('python')) { return 'python-app'; }
        if (languages.includes('typescript') || languages.includes('javascript')) { return 'node-app'; }
        return 'general';
    }

    private async createCopilotInstructions(config: CapybaraConfig, githubDir: string, projectInfo: any): Promise<void> {
        const capybaraVersion = "1.0.0";
        const instructions = this.generateCapybaraInstructions(config, projectInfo, capybaraVersion);

        // Use FileManager to handle version-controlled instructions
        const fileManager = new FileManager();
        await fileManager.updateCapybaraInstructions(instructions, capybaraVersion);
    }

    private generateCapybaraInstructions(config: CapybaraConfig, projectInfo: any, version: string): string {
        return `=====================START CAPYBARA MEMORY v${version}=====================
# 🔨 Capybara - GitHub Copilot Instructions

## 📋 **PROJECT CONTEXT**
- **Project**: ${config.project.name}
- **Type**: ${projectInfo.type}
- **Main Language**: ${config.project.language.join(', ')}
- **Frameworks**: ${config.project.framework?.join(', ') || 'None detected'}

## 🎯 **CAPYBARA METHODOLOGY**
This project uses Capybara methodology (Focus, Organize, Record, Grow, Evolve) for solo development:

### **Principles:**
1. **Atomic Tasks**: Maximum 2-3 hours per STEP
2. **XML Structure**: Tasks defined in single XML file
3. **Continuous Learning**: Every error becomes a prevention rule
4. **Preserved Context**: AI always informed of current state
5. **Minimal Documentation**: Only what saves time

### **Active Prevention Rules:**
*Rules will be automatically loaded from .capy/prevention-rules.md file*

## 🤖 **LLM TASK MANAGEMENT COMMANDS**

### **Task Creation Detection:**
When the user says something like:
- "vamos adicionar a auth do supabase nesse projeto"
- "preciso implementar um sistema de login"
- "criar um dashboard administrativo"
- "adicionar integração com API X"

**You MUST:**

1. **Check for Active Tasks** first:
   - Look for existing task.xml files in .capy/tasks/ directory
   - If any task has status="em-andamento" or status="pausada", ask the user:
     "⚠️ Existe uma tarefa ativa: [TASK_TITLE]. Deseja pausar esta tarefa para iniciar uma nova? (Digite 'sim' para pausar ou 'não' para continuar a tarefa atual)"

2. **If user confirms task creation:**
   - Read the complete instructions from \`.capy/instructions/capybara-task-file-structure-info.md\`
   - Follow those instructions exactly to generate a proper XML task structure
   - Create the XML file in .capy/tasks/ with a unique ID
   - Inform the user: "✅ Nova tarefa criada: [TASK_TITLE]. Use 'Capybara: Current Task' para ver detalhes."

3. **If user wants to continue existing task:**
   - Show the current task status and next steps
   - Ask what specific step they want to work on

### **Task Status Management:**
- Always check .capy/tasks/ for current tasks before suggesting new work
- When showing task information, display progress and next steps clearly
- Remind users to mark steps as completed by changing \`concluido="true"\`

### **XML Generation Rules:**
- **ALWAYS** read \`.capy/instructions/capybara-task-file-structure-info.md\` before generating XML
- Follow the exact structure and requirements specified there
- Include all required sections: metadata, context, steps, validation
- Ensure steps are logical, sequential, and testable
- Add specific criteria for each step
- Include proper file listings and dependencies

## 🛠️ **SPECIFIC INSTRUCTIONS**

### **For this project:**
- Always check prevention rules before suggesting code
- Work with tasks in XML format (task.xml)
- Focus on simple and direct solutions
- Document problems found to create new rules

### **⚠️ Current Extension State:**
- **Initialization**: Fully functional
- **Focus**: Minimal, focused extension with only essential initialization

### **🎯 Recommended Workflow:**
1. Use \`Capybara: Initialize\` to configure new project
2. Manually create and edit task.xml files in .capy folder
3. Mark steps as complete by changing \`concluido="true"\`
4. Use external tools or manual processes for task management

### **📄 XML Task Structure:**

\`\`\`xml
<task id="task-id" versao="1.0">
    <metadados>
        <titulo>Task Title</titulo>
        <descricao>Detailed description</descricao>
        <status>em-andamento|pausada|concluida</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>example-library</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Step Name</titulo>
            <descricao>What to do in this step</descricao>
            <criterios>
                <criterio>Criteria 1</criterio>
                <criterio>Criteria 2</criterio>
            </criterios>
            <entrega>File.jsx</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>All mandatory steps completed</item>
        </checklist>
    </validacao>
</task>
\`\`\`

### **Available Capybara Commands:**

#### **✅ Functional Commands:**
- \`Capybara: Initialize\` - Initialize Capybara in workspace
- \`Capybara: Test Capybara Extension\` - Test if extension is working

#### **� Manual File Management:**
- Create task.xml files manually in .capy/tasks/
- Edit prevention-rules.md manually
- Manage project structure manually
- Use standard VS Code features for file operations

### **📝 Current Development State:**
- ✅ Initialization and configuration: **Complete**
- ✅ Project setup: **Functional**
- � Task management: **Manual file-based**
- � History and analytics: **Manual tracking**

### **🎯 Philosophy:**
This extension focuses on **initialization only** - providing the essential structure and 
documentation for Capybara methodology. All task management is done manually through 
file editing, keeping the extension lightweight and focused.

---
*This file is private and should not be committed. It contains your personalized instructions for GitHub Copilot.*
======================END CAPYBARA MEMORY v${version}======================
`;
    }

    private async createOrUpdateCopilotInstructions(config: CapybaraConfig, githubDir: string, projectInfo: any): Promise<void> {
        try {
            const targetPath = path.join(githubDir, 'copilot-instructions.md');
            
            // Usar template embeddado ao invés de ler de arquivos
            let content = this.getEmbeddedCopilotTemplate();
            
            // Substituir placeholders
            content = content
                .replace(/{PROJECT_NAME}/g, config.project.name)
                .replace(/{PROJECT_TYPE}/g, projectInfo.type)
                .replace(/{MAIN_LANGUAGE}/g, config.project.language.join(', '))
                .replace(/{FRAMEWORKS}/g, config.project.framework?.join(', ') || 'Nenhum detectado');

            // Verificar se arquivo já existe
            let shouldUpdate = true;
            try {
                const existingContent = await fs.promises.readFile(targetPath, 'utf8');
                
                // Se já existe e contém instruções Capybara, perguntar se quer atualizar
                if (existingContent.includes('🔨 Capybara') || existingContent.includes('METODOLOGIA Capybara')) {
                    const overwrite = await vscode.window.showWarningMessage(
                        '⚠️ Já existe um arquivo copilot-instructions.md com instruções Capybara. Atualizar com a versão mais recente?',
                        'Sim, atualizar', 'Não, manter existente'
                    );
                    shouldUpdate = overwrite === 'Sim, atualizar';
                } else {
                    // Se não contém Capybara, adicionar as instruções no final
                    content = existingContent + '\n\n' + content;
                }
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    console.error('Erro ao ler arquivo existente:', error);
                }
                // Arquivo não existe, pode criar
            }

            if (shouldUpdate) {
                await fs.promises.writeFile(targetPath, content, 'utf8');
            }

        } catch (error) {
            console.error('Erro ao criar/atualizar copilot-instructions.md:', error);
            // Fallback para o método antigo
            await this.createCopilotInstructions(config, githubDir, projectInfo);
        }
    }

    private getEmbeddedCopilotTemplate(): string {
        return `# 🔨 Capybara - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: {PROJECT_NAME}
- **Tipo**: {PROJECT_TYPE}
- **Linguagem Principal**: {MAIN_LANGUAGE}
- **Frameworks**: {FRAMEWORKS}

## 🎯 **METODOLOGIA Capybara**
Este projeto usa a metodologia Capybara (Focus, Organize, Record, Grow, Evolve) para desenvolvimento solo:

### **Princípios:**
1. **Tarefas Atômicas**: Máximo 2-3 horas por STEP
2. **XML estruturado**: Tasks definidas em arquivo XML único
3. **Aprendizado Contínuo**: Cada erro vira uma prevention rule
4. **Contexto Preservado**: AI sempre informada do estado atual
5. **Documentação Mínima**: Só o essencial que economiza tempo

### **Prevention Rules Ativas:**
*As regras serão carregadas automaticamente do arquivo .capy/prevention-rules.md*

## 🤖 **COMANDOS DE DETECÇÃO LLM**

### **Detecção de Criação de Tarefas:**
Quando o usuário disser algo como:
- "vamos adicionar a auth do supabase nesse projeto"
- "preciso implementar um sistema de login"
- "criar um dashboard administrativo"
- "adicionar integração com API X"

**VOCÊ DEVE:**

1. **Verificar Tarefas Ativas** primeiro:
   - Procurar por arquivos task.xml existentes em .capy/tasks/
   - Se alguma task tem status="em-andamento" ou status="pausada", perguntar ao usuário:
     "⚠️ Existe uma tarefa ativa: [TASK_TITLE]. Deseja pausar esta tarefa para iniciar uma nova? (Digite 'sim' para pausar ou 'não' para continuar a tarefa atual)"

2. **Se usuário confirmar criação da task:**
   - Ler as instruções completas de \`.capy/instructions/capybara-task-file-structure-info.md\`
   - Seguir essas instruções exatamente para gerar uma estrutura XML adequada
   - Criar o arquivo XML em .capy/tasks/ com ID único
   - Informar o usuário: "✅ Nova tarefa criada: [TASK_TITLE]. Use 'Capybara: Current Task' para ver detalhes."

3. **Se usuário quiser continuar tarefa existente:**
   - Mostrar o status da tarefa atual e próximos steps
   - Perguntar em que step específico quer trabalhar

### **Gerenciamento de Status de Tarefas:**
- Sempre verificar .capy/tasks/ para tarefas atuais antes de sugerir novo trabalho
- Ao mostrar informações de task, exibir progresso e próximos steps claramente
- Lembrar usuários de marcar steps como concluídos alterando \`concluido="true"\`

### **Regras de Geração XML:**
- **SEMPRE** ler \`.capy/instructions/capybara-task-file-structure-info.md\` antes de gerar XML
- Seguir a estrutura exata e requisitos especificados lá
- Incluir todas as seções obrigatórias: metadata, context, steps, validation
- Garantir que steps sejam lógicos, sequenciais e testáveis
- Adicionar critérios específicos para cada step
- Incluir listagens adequadas de arquivos e dependências

## 🛠️ **INSTRUÇÕES ESPECÍFICAS**

### **Para este projeto:**
- Sempre verificar prevention rules antes de sugerir código
- Trabalhar com tasks em formato XML (task.xml)
- Focar em soluções simples e diretas
- Documentar problemas encontrados para criar novas rules

### **⚠️ Estado Atual da Extensão:**
- **Inicialização**: Totalmente funcional
- **Criação de Tasks**: XML estruturado com steps, critérios e validação
- **Gestão de Progress**: Tracking de conclusão por step
- **Outros comandos**: Majoritariamente placeholders (mostram "Coming soon!")
- **Foco**: Desenvolvimento incremental com metodologia Capybara

### **🎯 Workflow Recomendado:**
1. Use \`Capybara: Initialize\` para configurar novo projeto
2. Use \`Capybara: Create New Task\` para criar tasks estruturadas em XML
3. Edite o task.xml para definir steps específicos do projeto
4. Marque steps como concluídos alterando \`concluido="true"\`
5. Para outras funcionalidades, aguarde implementação ou contribua!

### **📄 Estrutura XML das Tasks:**

\`\`\`xml
<task id="task-id" versao="1.0">
    <metadados>
        <titulo>Título da Task</titulo>
        <descricao>Descrição detalhada</descricao>
        <status>em-andamento|pausada|concluida</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="React" versao="18+"/>
        <dependencias>
            <lib>biblioteca-exemplo</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Nome do Step</titulo>
            <descricao>O que fazer neste step</descricao>
            <criterios>
                <criterio>Critério 1</criterio>
                <criterio>Critério 2</criterio>
            </criterios>
            <entrega>Arquivo.jsx</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>Todos os steps obrigatórios concluídos</item>
        </checklist>
    </validacao>
</task>
\`\`\`

### **Comandos Capybara disponíveis:**

#### **✅ Comandos Funcionais:**
- \`Capybara: Initialize\` - Inicializar Capybara no workspace
- \`Capybara: Create New Task\` - Criar nova tarefa em XML estruturado
- \`Capybara: Current Task\` - Ver tarefa atual (com validação)
- \`Capybara: Test Capybara Extension\` - Testar se extensão está funcionando

#### **🚧 Comandos em Desenvolvimento:**
- \`Capybara: Manage All Tasks\` - Gerenciar todas as tarefas (em breve)
- \`Capybara: Pause Current Task\` - Pausar tarefa atual (em breve)
- \`Capybara: Complete Task\` - Completar e mover para histórico (em breve)
- \`Capybara: Update Step Progress\` - Marcar steps como concluídos (em breve)
- \`Capybara: Complete Current Task\` - Completar tarefa atual (em breve)
- \`Capybara: Task History\` - Ver histórico de tarefas (em breve)

#### **🔄 Comandos Legacy:**
- \`Capybara: Create Smart Task (Legacy)\` - Redireciona para Create New Task
- \`Capybara: Add Prevention Rule (Legacy)\` - Funcionalidade integrada automaticamente

### **📝 Estado Atual do Desenvolvimento:**
- ✅ Inicialização e configuração: **Completa**
- ✅ Criação básica de tarefas: **Funcional com validação**
- 🚧 Gerenciamento de tarefas: **Em desenvolvimento**
- 🚧 Histórico e analytics: **Planejado**

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*`;
    }

    private async createInitialPreventionRules(capyDir: string): Promise<void> {
        const rulesPath = path.join(capyDir, 'prevention-rules.md');
        
        const initialRules = `# 🛡️ Prevention Rules

> Regras acumuladas de erros e padrões específicos deste projeto.

## 📝 **Como usar:**
1. Quando encontrar um erro/problema, documente aqui
2. Use o comando "Capybara: Add Prevention Rule" para facilitar
3. As regras são automaticamente incluídas no contexto do Copilot

---

## 🏗️ **Regras Gerais**

### [SETUP] Inicialização do Capybara
**Context:** Ao inicializar Capybara pela primeira vez  
**Problem:** Usuário pode tentar usar comandos não implementados  
**Solution:** Sempre informar sobre comandos funcionais vs placeholders  
**Example:** Após \`Capybara: Initialize\`, usar \`Capybara: Create New Task\` (funcional)

### [EXTENSION] Estado dos Comandos
**Context:** Desenvolvimento incremental da extensão  
**Problem:** Nem todos comandos listados estão implementados  
**Solution:** Verificar implementation status antes de sugerir comandos  
**Example:** \`Manage All Tasks\` = placeholder, \`Create New Task\` = funcional  

---

*⚡ Máximo de 15 regras para manter contexto enxuto e eficaz*
`;

        await fs.promises.writeFile(rulesPath, initialRules, 'utf8');
    }

    private async updateGitignore(workspacePath: string): Promise<void> {
        const gitignorePath = path.join(workspacePath, '.gitignore');
        const capybaraEntries = [
            '',
            '# Capybara - Private AI Instructions',
            '.github/copilot-instructions.md',
            ''
        ].join('\n');

        try {
            let gitignoreContent = '';
            try {
                await fs.promises.access(gitignorePath, fs.constants.F_OK);
                gitignoreContent = await fs.promises.readFile(gitignorePath, 'utf8');
            } catch (error: any) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            // Verificar se já tem as entradas
            if (!gitignoreContent.includes('.github/copilot-instructions.md')) {
                gitignoreContent += capybaraEntries;
                await fs.promises.writeFile(gitignorePath, gitignoreContent, 'utf8');
            }
        } catch (error) {
            // Ignorar erros do .gitignore
        }
    }

    private async injectTaskInstructionsFile(capyDir: string): Promise<void> {
        try {
            const targetFile = path.join(capyDir, 'instructions', 'capybara-task-file-structure-info.md');
            
            // Usar conteúdo embeddado ao invés de ler de arquivos
            const content = this.getEmbeddedTaskInstructionsTemplate();
            
            await fs.promises.writeFile(targetFile, content, 'utf8');
        } catch (error) {
            console.error('Erro ao criar arquivo de instruções XML:', error);
            // Não falhar a inicialização por causa disso
        }
    }

    private getEmbeddedTaskInstructionsTemplate(): string {
        return `# LLM Instructions: XML Task Generation for Capybara Methodology

## Overview

You are responsible for creating XML task structures that follow the Capybara methodology. These XML files define atomic, step-by-step instructions for development tasks that can be completed in 1-3 hours with measurable outcomes.

## Your Role - CRITICAL REQUIREMENTS

When a user expresses a development need, you must:

1. **FIRST**: Check for active tasks in \`.capy/tasks/\` directory
2. **ATOMICITY ANALYSIS**: Ensure task can be completed in 1-3 hours  
3. **BREAK DOWN**: Decompose non-atomic tasks into smaller units
4. **GENERATE**: Create structured XML following exact specifications
5. **VALIDATE**: Ensure all criteria are measurable and testable

## File Naming Convention

### **Task File Names: \`STEP_[UNIX_TIMESTAMP]_[title].xml\`**

Task files should be named using Unix timestamps for chronological ordering:

\`\`\`
Examples:
STEP_1722873600_setup-supabase-auth.xml
STEP_1722874200_create-login-form.xml
STEP_1722874800_implement-dashboard.xml
\`\`\`

**Benefits:**
- **Chronological ordering**: Files automatically sort by creation time
- **Unique names**: No conflicts between different tasks
- **Descriptive**: Title immediately shows what the task does
- **Compact**: Unix timestamp is shorter than full date strings

### **Internal Step IDs: Simple Sequential**

Within each task XML, use simple sequential step IDs:

\`\`\`xml
<step id="step001" order="1" completed="false" required="true">
<step id="step002" order="2" completed="false" required="true" depends-on="step001">
<step id="step003" order="3" completed="false" required="true" depends-on="step002">
\`\`\`

**Why this approach:**
- **File level**: Unix timestamps ensure global chronological order
- **Step level**: Simple sequences make internal navigation easy
- **Best of both**: Global ordering + local simplicity

## Pre-Generation Checklist

### **Step 1: Active Task Check**
- Look for XML files in \`.capy/tasks/\` with status="em-andamento" or status="pausada"
- If found, ask: "⚠️ Existe uma tarefa ativa: [TASK_TITLE]. Deseja pausar esta tarefa para iniciar uma nova?"
- Only proceed with user confirmation

### **Step 2: Atomicity Analysis** 
- **ATOMIC**: Single objective, 1-3 hours, clear deliverable
- **NON-ATOMIC**: Multiple objectives, >3 hours, complex scope

\`\`\`
✅ ATOMIC EXAMPLES:
- "Setup Supabase client configuration"  
- "Create user registration form component"
- "Implement JWT token validation middleware"

❌ NON-ATOMIC (decompose first):
- "Implement complete authentication system"
- "Build admin dashboard" 
- "Setup entire backend API"
\`\`\`

### **Step 3: Task Decomposition (if needed)**
If task is non-atomic, break it down using these patterns:
- **Authentication**: config → middleware → endpoints → integration → testing
- **Frontend**: layout → components → styling → state → integration  
- **Backend**: schema → validation → endpoints → testing
- **Database**: schema → migrations → repositories → testing

## XML Structure Requirements

### Basic Template - STRICT FORMAT

Every XML task must follow this exact structure:

\`\`\`xml
<task id="[unique-kebab-case-id]" version="1.0">
    <metadata>
        <title>[Clear, actionable title]</title>
        <description>[Detailed description focusing on the specific outcome]</description>
        <status>em-andamento</status>
        <progress>0/[total-steps]</progress>
    </metadata>
    
    <context>
        <area>[frontend/backend/mobile/devops/fullstack]</area>
        <technology main="[main-tech]" version="[min-version]"/>
        <dependencies>
            <lib>[library-name]</lib>
            <!-- Add ALL dependencies needed -->
        </dependencies>
        <files>
            <file type="creation" required="true">[absolute-file-path]</file>
            <file type="modification" required="false">[absolute-file-path]</file>
            <!-- List EVERY file that will be touched -->
        </files>
    </context>
    
    <steps>
        <!-- 3-7 atomic steps maximum with simple sequential IDs -->
    </steps>
    
    <validation>
        <checklist>
            <item>All required steps completed</item>
            <item>All required files created</item>
            <item>Code compiles without errors</item>
            <item>No linting warnings</item>
            <item>[Add specific validation criteria]</item>
        </checklist>
    </validation>
</task>
\`\`\`

### Key Requirements:
- **Task File Name**: \`STEP_[UNIX_TIMESTAMP]_[KEBAB-CASE-TITLE].xml\`  
  Example: \`STEP_1722873600_setup-supabase-auth.xml\`
- **Internal Steps**: Simple sequential IDs (\`step001\`, \`step002\`, etc.)
- **ID**: Use kebab-case, descriptive, unique (e.g., "setup-supabase-auth", "create-login-form")  
- **Status**: Always start with "em-andamento" for new tasks
- **Area**: Choose ONE primary area where most work will happen
- **Dependencies**: Include ALL libraries, not just the main ones
- **Files**: List EVERY file that will be created or modified with full paths

## Step Creation Guidelines - SIMPLE SEQUENTIAL FORMAT

### Step Structure with Simple Sequential IDs

Each step must follow this exact pattern with simple sequential IDs:

\`\`\`xml
<step id="step[XXX]" order="[N]" completed="false" required="[true/false]" depends-on="[previous-step-id]">
    <title>[What will be accomplished]</title>
    <description>[Detailed explanation of the work to be done]</description>
    <criteria>
        <criterion>[Specific, measurable requirement]</criterion>
        <criterion>[Another specific requirement]</criterion>
        <!-- List ALL criteria that must be met -->
    </criteria>
    <files>
        <file type="[creation/modification]" required="[true/false]">[specific-file-path]</file>
    </files>
    <!-- Optional sections -->
    <dependencies>
        <lib>[step-specific-library]</lib>
    </dependencies>
    <validation>
        <command>[test-command]</command>
        <metric>[specific-metric >= target]</metric>
    </validation>
</step>
\`\`\`

### **STEP ID Format: Simple Sequential**
- **Format**: \`step001\`, \`step002\`, \`step003\`, etc.
- **Internal to task**: Steps are numbered sequentially within each task file
- **Benefits**: 
  - Simple and readable
  - Easy to reference within the task
  - No complexity for internal steps
  - Clear dependency chain

### **Task File Naming with Unix Timestamp:**
- **Format**: \`STEP_[UNIX_TIMESTAMP]_[KEBAB-CASE-TITLE].xml\`
- **Timestamp**: Unix timestamp when task is created
- **Example**: \`STEP_1722873600_setup-supabase-auth.xml\`
- **Benefits**: 
  - Automatic chronological ordering of tasks
  - Unique task file names guaranteed 
  - Clear task identification
  - Easy to sort by creation time

### **LLM CRITICAL INSTRUCTION:**
**Task Files**: Use \`STEP_[timestamp]_[title].xml\` format for file names
**Internal Steps**: Use simple \`step001\`, \`step002\`, \`step003\` format for step IDs
- Generate Unix timestamp for task file name only
- Use sequential numbering for internal steps
- This provides chronological ordering at task level with simplicity at step level

## Output Requirements

Your XML output must:

- Be valid XML syntax
- Follow the exact structure defined above
- Include ALL required elements
- Have logical step dependencies
- Contain specific, measurable criteria
- List all files that will be created/modified
- Include appropriate testing requirements
- Have a comprehensive validation checklist

## Response Format

Always respond with:

1. Brief analysis of the request
2. The complete XML task structure
3. Any assumptions or clarifications made

Example:

\`\`\`
## Analysis
Creating a React customer registration form requires form handling, validation, styling, and testing. This will be a frontend-focused task with 7 sequential steps.

## XML Task Structure
[Complete XML here]

## Assumptions
- Using React 18+
- Implementing with react-hook-form for performance
- Including comprehensive validation with Yup
- Responsive design required
- 80% test coverage target
\`\`\`
`;
    }
}
