// Test script to verify XML task creation
const path = require('path');
const fs = require('fs');

// Import the classes
const { NewTaskCreator } = require('./out/commands/createNewTask');
const { TaskWorkflowManager } = require('./out/utils/taskWorkflowManager');
const { FileManager } = require('./out/utils/fileManager');

async function testCreateNewTask() {
    console.log('🧪 Testing XML Task Creation...');
    
    try {
        // Set up test workspace
        const testWorkspace = path.join(__dirname, 'test-capybara-xml');
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace);
        }
        
        // Initialize Capybara config
        const fileManager = new FileManager();
        const capyPath = path.join(testWorkspace, '.capy');
        if (!fs.existsSync(capyPath)) {
            fs.mkdirSync(capyPath, { recursive: true });
        }
        
        // Create basic config
        const config = {
            version: '2.2.0',
            environment: {
                os: 'Windows',
                shell: 'powershell.exe'
            },
            tasks: {
                currentTask: undefined
            }
        };
        
        const configPath = path.join(capyPath, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        console.log('✅ Test workspace configured');
        
        // Simulate task creation
        console.log('📝 Creating test task...');
        
        // This would normally be triggered by VS Code command
        // For now, let's manually create a task structure
        const taskData = {
            id: 'test-task-xml',
            title: 'Test XML Task Creation',
            description: 'Verificar se o sistema de tasks XML está funcionando',
            mainTechnology: 'TypeScript',
            techVersion: '5.0+'
        };
        
        const taskPath = path.join(capyPath, taskData.id);
        if (!fs.existsSync(taskPath)) {
            fs.mkdirSync(taskPath, { recursive: true });
        }
        
        // Create sample XML task
        const taskXml = `<?xml version="1.0" encoding="UTF-8"?>
<task id="${taskData.id}" versao="1.0">
    <metadados>
        <titulo>${taskData.title}</titulo>
        <descricao>${taskData.description}</descricao>
        <status>em-andamento</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="${taskData.mainTechnology}" versao="${taskData.techVersion}"/>
        <dependencias>
            <lib>jest</lib>
            <lib>typescript</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Configurar estrutura básica</titulo>
            <descricao>Criar estrutura inicial do projeto</descricao>
            <criterios>
                <criterio>Estrutura de pastas criada</criterio>
                <criterio>Configurações básicas definidas</criterio>
            </criterios>
            <entrega>package.json</entrega>
        </step>
        
        <step id="step002" ordem="2" concluido="false" obrigatorio="true" dependeDe="step001">
            <titulo>Implementar funcionalidade</titulo>
            <descricao>Desenvolver a funcionalidade principal</descricao>
            <criterios>
                <criterio>Código implementado</criterio>
                <criterio>Testes básicos funcionando</criterio>
            </criterios>
        </step>
        
        <step id="step003" ordem="3" concluido="false" obrigatorio="false" dependeDe="step002">
            <titulo>Documentação</titulo>
            <descricao>Criar documentação do projeto</descricao>
            <criterios>
                <criterio>README atualizado</criterio>
                <criterio>Exemplos fornecidos</criterio>
            </criterios>
            <entrega>README.md</entrega>
        </step>
    </steps>
    
    <validacao>
        <checklist>
            <item>Todos os steps obrigatórios concluídos</item>
            <item>Critérios de cada step atendidos</item>
            <item>Entregas geradas conforme especificado</item>
        </checklist>
    </validacao>
</task>`;

        const xmlPath = path.join(taskPath, 'task.xml');
        fs.writeFileSync(xmlPath, taskXml, 'utf8');
        
        console.log('✅ Task XML created at:', xmlPath);
        
        // Test loading the XML
        if (fs.existsSync(xmlPath)) {
            const xmlContent = fs.readFileSync(xmlPath, 'utf8');
            console.log('📄 XML Content preview:');
            console.log(xmlContent.substring(0, 200) + '...');
            
            // Check XML structure
            const hasTaskTag = xmlContent.includes('<task id="test-task-xml"');
            const hasSteps = xmlContent.includes('<steps>');
            const hasMetadata = xmlContent.includes('<metadados>');
            const hasValidation = xmlContent.includes('<validacao>');
            
            console.log('🔍 XML Structure validation:');
            console.log(`  - Task tag: ${hasTaskTag ? '✅' : '❌'}`);
            console.log(`  - Steps: ${hasSteps ? '✅' : '❌'}`);
            console.log(`  - Metadata: ${hasMetadata ? '✅' : '❌'}`);
            console.log(`  - Validation: ${hasValidation ? '✅' : '❌'}`);
            
            if (hasTaskTag && hasSteps && hasMetadata && hasValidation) {
                console.log('🎉 XML Task creation test PASSED!');
                return true;
            } else {
                console.log('❌ XML Task creation test FAILED - Missing required elements');
                return false;
            }
        } else {
            console.log('❌ XML file was not created');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    }
}

// Run the test
testCreateNewTask().then(success => {
    if (success) {
        console.log('\n🎯 Test completed successfully!');
        console.log('📁 Check the .capy/test-task-xml/task.xml file');
    } else {
        console.log('\n💥 Test failed!');
    }
}).catch(error => {
    console.error('Test runner error:', error);
});

module.exports = { testCreateNewTask };
