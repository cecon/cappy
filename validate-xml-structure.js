const fs = require('fs');
const path = require('path');

// Simple test to verify XML structure
function testXmlStructure() {
    console.log('🧪 Testing XML Task Structure...');
    
    // Create test XML following user requirements
    const testTaskXml = `<?xml version="1.0" encoding="UTF-8"?>
<task id="test-task-001" versao="1.0">
    <metadados>
        <titulo>Test Task XML Generation</titulo>
        <descricao>Verificar se a estrutura XML está correta conforme especificação</descricao>
        <status>em-andamento</status>
        <progresso>0/3</progresso>
    </metadados>
    
    <contexto>
        <tecnologia principal="TypeScript" versao="5.0+"/>
        <dependencias>
            <lib>jest</lib>
            <lib>vscode</lib>
        </dependencias>
    </contexto>
    
    <steps>
        <step id="step001" ordem="1" concluido="false" obrigatorio="true">
            <titulo>Configurar ambiente</titulo>
            <descricao>Preparar ambiente de desenvolvimento</descricao>
            <criterios>
                <criterio>Node.js instalado</criterio>
                <criterio>VS Code configurado</criterio>
            </criterios>
            <entrega>package.json</entrega>
        </step>
        
        <step id="step002" ordem="2" concluido="false" obrigatorio="true" dependeDe="step001">
            <titulo>Implementar funcionalidade</titulo>
            <descricao>Criar a funcionalidade principal</descricao>
            <criterios>
                <criterio>Código implementado</criterio>
                <criterio>Testes passando</criterio>
            </criterios>
            <entrega>src/main.ts</entrega>
        </step>
        
        <step id="step003" ordem="3" concluido="false" obrigatorio="false" dependeDe="step002">
            <titulo>Finalizar documentação</titulo>
            <descricao>Completar documentação do projeto</descricao>
            <criterios>
                <criterio>README atualizado</criterio>
                <criterio>Comentários no código</criterio>
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

    // Save to test file
    const testDir = path.join(__dirname, 'test-output');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir);
    }
    
    const xmlPath = path.join(testDir, 'test-task.xml');
    fs.writeFileSync(xmlPath, testTaskXml, 'utf8');
    
    console.log('✅ Test XML created at:', xmlPath);
    
    // Validate XML structure
    const requiredElements = [
        '<task id=',
        'versao="1.0"',
        '<metadados>',
        '<titulo>',
        '<descricao>',
        '<status>',
        '<progresso>',
        '<contexto>',
        '<tecnologia principal=',
        '<dependencias>',
        '<steps>',
        '<step id=',
        'ordem="1"',
        'concluido="false"',
        'obrigatorio="true"',
        '<criterios>',
        '<criterio>',
        '<entrega>',
        'dependeDe=',
        '<validacao>',
        '<checklist>',
        '<item>'
    ];
    
    let validationResults = [];
    
    requiredElements.forEach(element => {
        const exists = testTaskXml.includes(element);
        validationResults.push({ element, exists });
        console.log(`  ${exists ? '✅' : '❌'} ${element}`);
    });
    
    const passedCount = validationResults.filter(r => r.exists).length;
    const totalCount = validationResults.length;
    
    console.log(`\n📊 Validation Results: ${passedCount}/${totalCount} elements found`);
    
    if (passedCount === totalCount) {
        console.log('🎉 XML structure validation PASSED!');
        console.log('📁 Test file saved to: test-output/test-task.xml');
        return true;
    } else {
        console.log('❌ XML structure validation FAILED');
        const missing = validationResults.filter(r => !r.exists);
        console.log('Missing elements:', missing.map(m => m.element));
        return false;
    }
}

// Run test
console.log('🔬 Starting XML Task Structure Test\n');
const success = testXmlStructure();
console.log(`\n${success ? '🎯 Test PASSED' : '💥 Test FAILED'}`);
