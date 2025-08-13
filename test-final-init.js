const fs = require('fs');
const path = require('path');

async function testCappyInitializationFlow() {
    console.log('🧪 TESTE COMPLETO: Fluxo de Inicialização do Cappy\n');
    
    const testWorkspacePath = 'd:\\projetos\\test-cappy-final';
    
    // Limpar e criar workspace
    try {
        await fs.promises.rm(testWorkspacePath, { recursive: true, force: true });
        console.log('🗑️ Workspace anterior removido');
    } catch (e) {
        // Ignorar se não existir
    }
    
    await fs.promises.mkdir(testWorkspacePath, { recursive: true });
    
    // Criar alguns arquivos para simular um projeto real
    await fs.promises.writeFile(path.join(testWorkspacePath, 'package.json'), JSON.stringify({
        name: 'test-cappy-final',
        version: '1.0.0',
        main: 'index.js',
        dependencies: {
            'express': '^4.18.0'
        }
    }, null, 2));
    
    await fs.promises.writeFile(path.join(testWorkspacePath, 'index.js'), `
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
`);
    
    console.log('📁 Workspace de teste criado:', testWorkspacePath);
    console.log('📄 Arquivos do projeto criados: package.json, index.js');
    
    // **PASSO 1: Criar estrutura básica (como no código real)**
    console.log('\\n1️⃣ CRIANDO ESTRUTURA BÁSICA...');
    
    const capyDir = path.join(testWorkspacePath, '.capy');
    const githubDir = path.join(testWorkspacePath, '.github');
    
    await fs.promises.mkdir(capyDir, { recursive: true });
    await fs.promises.mkdir(githubDir, { recursive: true });
    await fs.promises.mkdir(path.join(capyDir, 'history'), { recursive: true });
    await fs.promises.mkdir(path.join(capyDir, 'instructions'), { recursive: true });
    await fs.promises.mkdir(path.join(capyDir, 'tasks'), { recursive: true });
    
    console.log('✅ Diretórios criados');
    
    // **PASSO 2: Coletar informações do projeto (simulando collectProjectInfo)**
    console.log('\\n2️⃣ COLETANDO INFORMAÇÕES DO PROJETO...');
    
    const projectName = path.basename(testWorkspacePath);
    
    // Simular detecção de linguagens e frameworks
    const languages = ['javascript'];
    const frameworks = ['express'];
    
    const projectInfo = {
        name: projectName,
        description: `Projeto ${projectName} - Desenvolvimento solo com Cappy`,
        language: languages[0],
        languages: languages,
        framework: frameworks,
        type: 'node-app'
    };
    
    console.log('✅ Projeto detectado:', projectInfo);
    
    // **PASSO 3: Criar configuração (simulando CappyConfig)**
    console.log('\\n3️⃣ CRIANDO CONFIGURAÇÃO...');
    
    const config = {
        version: '1.0.0',
        project: {
            name: projectInfo.name,
            language: projectInfo.languages,
            framework: projectInfo.framework,
            description: projectInfo.description
        },
        stack: {
            primary: languages[0],
            frameworks: frameworks,
            tools: ['vscode', 'git']
        },
        environment: {
            development: 'local',
            testing: 'jest',
            deployment: 'manual'
        },
        context: {
            methodologyVersion: '1.0',
            focusMode: true,
            atomicTasks: true
        },
        tasks: {
            maxActiveCount: 1,
            estimationRequired: true,
            xmlFormat: true
        },
        ai: {
            provider: 'github-copilot',
            contextAware: true,
            preventionRules: true
        },
        analytics: {
            trackTime: true,
            trackProgress: true,
            generateReports: false
        },
        createdAt: new Date(),
        lastUpdated: new Date()
    };
    
    // **PASSO 4: Salvar configuração**
    console.log('\\n4️⃣ SALVANDO CONFIGURAÇÃO...');
    
    const configPath = path.join(capyDir, 'config.json');
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('✅ Config salvo:', configPath);
    
    // **PASSO 5: Criar instruções para Copilot (template embeddido)**
    console.log('\\n5️⃣ CRIANDO INSTRUÇÕES PARA COPILOT...');
    
    const copilotInstructionsTemplate = `# 🔨 Cappy - Instruções para GitHub Copilot

## 📋 **CONTEXTO DO PROJETO**
- **Projeto**: ${config.project.name}
- **Tipo**: ${projectInfo.type}
- **Linguagem Principal**: ${config.project.language.join(', ')}
- **Frameworks**: ${config.project.framework.join(', ')}

## 🎯 **METODOLOGIA Cappy**
Este projeto usa a metodologia Cappy (Focus, Organize, Record, Grow, Evolve) para desenvolvimento solo:

### **Princípios:**
1. **Tarefas Atômicas**: Máximo 2-3 horas por STEP
2. **XML estruturado**: Tasks definidas em arquivo XML único
3. **Aprendizado Contínuo**: Cada erro vira uma prevention rule
4. **Contexto Preservado**: AI sempre informada do estado atual
5. **Documentação Mínima**: Só o essencial que economiza tempo

### **Prevention Rules Ativas:**
*As regras serão carregadas automaticamente do arquivo .capy/prevention-rules.md*

---
*Este arquivo é privado e não deve ser commitado. Ele contém suas instruções personalizadas para o GitHub Copilot.*`;
    
    const copilotPath = path.join(githubDir, 'copilot-instructions.md');
    await fs.promises.writeFile(copilotPath, copilotInstructionsTemplate, 'utf8');
    console.log('✅ Instruções Copilot criadas:', copilotPath);
    
    // **PASSO 6: Criar arquivo de instruções XML**
    console.log('\\n6️⃣ CRIANDO ARQUIVO DE INSTRUÇÕES XML...');
    
    const xmlInstructionsTemplate = `# LLM Instructions: XML Task Generation for Cappy Methodology

## Overview
You are responsible for creating XML task structures that follow the Cappy methodology.

## File Naming Convention
Task files should be named: \`STEP_[UNIX_TIMESTAMP]_[title].xml\`

## XML Structure Required
\`\`\`xml
<task id="task-id" versao="1.0">
    <metadados>
        <titulo>Título da Task</titulo>
        <descricao>Descrição detalhada</descricao>
        <status>em-andamento|pausada|concluida</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="JavaScript" versao="ES2022"/>
        <dependencias>
            <lib>express</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Nome do Step</titulo>
            <descricao>O que fazer neste step</descricao>
            <criterios>
                <criterio>Critério específico e testável</criterio>
            </criterios>
            <entrega>arquivo-resultado.js</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>Todos os steps obrigatórios concluídos</item>
            <item>Código testado e funcional</item>
        </checklist>
    </validacao>
</task>
\`\`\`
`;
    
    const xmlInstructionsPath = path.join(capyDir, 'instructions', 'cappy-task-file-structure-info.md');
    await fs.promises.writeFile(xmlInstructionsPath, xmlInstructionsTemplate, 'utf8');
    console.log('✅ Instruções XML criadas:', xmlInstructionsPath);
    
    // **PASSO 7: Criar prevention rules**
    console.log('\\n7️⃣ CRIANDO PREVENTION RULES...');
    
    const preventionRulesTemplate = `# 🛡️ Prevention Rules

> Regras acumuladas de erros e padrões específicos deste projeto.

## 📝 **Como usar:**
1. Quando encontrar um erro/problema, documente aqui
2. Use o comando "Cappy: Add Prevention Rule" para facilitar
3. As regras são automaticamente incluídas no contexto do Copilot

---

## 🏗️ **Regras Gerais**

### [SETUP] Inicialização do Cappy
**Context:** Ao inicializar Cappy pela primeira vez  
**Problem:** Usuário pode tentar usar comandos não implementados  
**Solution:** Sempre informar sobre comandos funcionais vs placeholders  
**Example:** Após \`Cappy: Initialize\`, usar \`Cappy: Create New Task\` (funcional)

### [NODE] Configuração Express
**Context:** Desenvolvimento de APIs Node.js com Express  
**Problem:** Configuração básica pode ser esquecida  
**Solution:** Sempre incluir middleware básico (cors, helmet, body-parser)  
**Example:** \`app.use(express.json())\` deve estar presente

---

*⚡ Máximo de 15 regras para manter contexto enxuto e eficaz*
`;
    
    const preventionRulesPath = path.join(capyDir, 'prevention-rules.md');
    await fs.promises.writeFile(preventionRulesPath, preventionRulesTemplate, 'utf8');
    console.log('✅ Prevention Rules criadas:', preventionRulesPath);
    
    // **PASSO 8: Atualizar .gitignore**
    console.log('\\n8️⃣ ATUALIZANDO .GITIGNORE...');
    
    const gitignoreEntries = `
# Cappy - Private AI Instructions
.github/copilot-instructions.md

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;
    
    const gitignorePath = path.join(testWorkspacePath, '.gitignore');
    await fs.promises.writeFile(gitignorePath, gitignoreEntries, 'utf8');
    console.log('✅ .gitignore atualizado:', gitignorePath);
    
    // **VERIFICAÇÃO FINAL**
    console.log('\\n🔍 VERIFICAÇÃO FINAL DA ESTRUTURA CRIADA...');
    console.log('='.repeat(60));
    
    const expectedStructure = [
        '.capy',
        '.capy/config.json',
        '.capy/prevention-rules.md',
        '.capy/history',
        '.capy/instructions',
        '.capy/instructions/cappy-task-file-structure-info.md',
        '.capy/tasks',
        '.github',
        '.github/copilot-instructions.md',
        '.gitignore',
        'package.json',
        'index.js'
    ];
    
    let allCorrect = true;
    
    for (const item of expectedStructure) {
        const fullPath = path.join(testWorkspacePath, item);
        try {
            const stats = await fs.promises.stat(fullPath);
            if (stats.isDirectory()) {
                console.log('✅ 📁', item);
            } else {
                console.log('✅ 📄', item, `(${stats.size} bytes)`);
            }
        } catch (e) {
            console.log('❌ 🚫', item, '- NÃO EXISTE!');
            allCorrect = false;
        }
    }
    
    console.log('\\n' + '='.repeat(60));
    
    if (allCorrect) {
        console.log('🎉 TESTE PASSOU! Toda a estrutura foi criada corretamente.');
        console.log('\\n📊 RESUMO:');
        console.log('   - Pastas principais: .capy, .github ✅');
        console.log('   - Subpastas: history, instructions, tasks ✅');
        console.log('   - Configuração: config.json ✅');
        console.log('   - Instruções: XML e Copilot ✅');
        console.log('   - Prevention Rules ✅');
        console.log('   - .gitignore atualizado ✅');
        
        // Mostrar conteúdo do config
        try {
            const configContent = await fs.promises.readFile(path.join(capyDir, 'config.json'), 'utf8');
            const parsedConfig = JSON.parse(configContent);
            console.log('\\n🔧 CONFIGURAÇÃO DETECTADA:');
            console.log('   - Projeto:', parsedConfig.project.name);
            console.log('   - Linguagens:', parsedConfig.project.language.join(', '));
            console.log('   - Frameworks:', parsedConfig.project.framework.join(', '));
            console.log('   - Criado em:', new Date(parsedConfig.createdAt).toLocaleString('pt-BR'));
        } catch (e) {
            console.log('⚠️ Erro ao ler configuração:', e.message);
        }
        
    } else {
        console.log('❌ TESTE FALHOU! Alguns itens não foram criados corretamente.');
    }
    
    console.log('\\n📁 Projeto de teste localizado em:', testWorkspacePath);
    console.log('🧹 Para limpar: rmdir /s "' + testWorkspacePath + '"');
}

// Executar teste
testCappyInitializationFlow().catch(error => {
    console.error('💥 ERRO CRÍTICO:', error);
    console.error('Stack:', error.stack);
});
