import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs-extra';
import { StartActivityCommand } from '../../commands/startActivity';

suite('StartActivityCommand Tests', () => {
    let testWorkspace: string;
    let testForgeDir: string;

    suiteSetup(async () => {
        // Setup test workspace
        testWorkspace = path.join(__dirname, '..', '..', '..', 'test-workspace');
        testForgeDir = path.join(testWorkspace, '.forge');
        
        // Ensure clean test environment
        if (await fs.pathExists(testWorkspace)) {
            await fs.remove(testWorkspace);
        }
        await fs.ensureDir(testWorkspace);
        await fs.ensureDir(testForgeDir);
    });

    suiteTeardown(async () => {
        // Cleanup test workspace
        if (await fs.pathExists(testWorkspace)) {
            await fs.remove(testWorkspace);
        }
    });

    test('generateClarificationQuestions should return authentication questions for login activities', () => {
        const command = new StartActivityCommand();
        const activityName = 'Implementar login com JWT';
        
        // Access private method for testing
        const questions = (command as any).generateClarificationQuestions(activityName);
        
        assert.ok(Array.isArray(questions), 'Should return an array');
        assert.ok(questions.length > 0, 'Should have at least one question');
        assert.ok(questions.length <= 5, 'Should have at most 5 questions');
        
        // Check for authentication-specific questions
        const hasAuthQuestion = questions.some((q: string) => 
            q.includes('autenticação') || q.includes('JWT') || q.includes('OAuth')
        );
        assert.ok(hasAuthQuestion, 'Should include authentication-related questions');
    });

    test('generateClarificationQuestions should return API questions for API activities', () => {
        const command = new StartActivityCommand();
        const activityName = 'Criar API REST para usuários';
        
        const questions = (command as any).generateClarificationQuestions(activityName);
        
        assert.ok(Array.isArray(questions), 'Should return an array');
        assert.ok(questions.length > 0, 'Should have at least one question');
        
        // Check for API-specific questions
        const hasApiQuestion = questions.some((q: string) => 
            q.includes('endpoints') || q.includes('API') || q.includes('REST')
        );
        assert.ok(hasApiQuestion, 'Should include API-related questions');
    });

    test('generateClarificationQuestions should return database questions for database activities', () => {
        const command = new StartActivityCommand();
        const activityName = 'Configurar banco de dados PostgreSQL';
        
        const questions = (command as any).generateClarificationQuestions(activityName);
        
        assert.ok(Array.isArray(questions), 'Should return an array');
        
        // Check for database-specific questions
        const hasDbQuestion = questions.some((q: string) => 
            q.includes('banco') || q.includes('tabelas') || q.includes('schema')
        );
        assert.ok(hasDbQuestion, 'Should include database-related questions');
    });

    test('generateClarificationQuestions should include generic questions for all activities', () => {
        const command = new StartActivityCommand();
        const activityName = 'Atividade genérica';
        
        const questions = (command as any).generateClarificationQuestions(activityName);
        
        assert.ok(Array.isArray(questions), 'Should return an array');
        assert.ok(questions.length >= 3, 'Should have at least 3 generic questions');
        
        // Check for generic questions
        const hasGenericQuestions = questions.some((q: string) => q.includes('escopo')) &&
                                   questions.some((q: string) => q.includes('critérios')) &&
                                   questions.some((q: string) => q.includes('dependências'));
        
        assert.ok(hasGenericQuestions, 'Should include all generic questions');
    });

    test('createActivityTemplate should generate correct template structure', () => {
        const command = new StartActivityCommand();
        const activityName = 'Test Activity';
        const clarifications = new Map([
            ['Qual é o escopo?', 'Test scope'],
            ['Quais critérios?', 'Test criteria']
        ]);
        
        const template = (command as any).createActivityTemplate(activityName, clarifications);
        
        assert.ok(template.includes(`# Atividade: ${activityName}`), 'Should include activity title');
        assert.ok(template.includes('## 📋 Descrição'), 'Should include description section');
        assert.ok(template.includes('## 🎯 Critérios de Aceitação'), 'Should include acceptance criteria');
        assert.ok(template.includes('## 📝 Passo a Passo'), 'Should include steps section');
        assert.ok(template.includes('## 🧪 Testes Unitários'), 'Should include tests section');
        assert.ok(template.includes('## 🔧 Dificuldades Encontradas'), 'Should include difficulties section');
        assert.ok(template.includes('## 📚 Perguntas de Clarificação'), 'Should include clarification section');
        
        // Check clarifications are included
        assert.ok(template.includes('Test scope'), 'Should include clarification answers');
        assert.ok(template.includes('Test criteria'), 'Should include clarification answers');
    });

    test('analyzeProjectContext should detect TypeScript project', async () => {
        const command = new StartActivityCommand();
        
        // Create a TypeScript project structure
        await fs.writeFile(path.join(testWorkspace, 'package.json'), JSON.stringify({
            name: 'test-project',
            dependencies: { typescript: '^4.0.0' }
        }));
        await fs.writeFile(path.join(testWorkspace, 'tsconfig.json'), '{}');
        
        const context = await (command as any).analyzeProjectContext(testWorkspace);
        
        assert.ok(context.includes('TypeScript'), 'Should detect TypeScript project');
    });

    test('analyzeProjectContext should detect VS Code extension', async () => {
        const command = new StartActivityCommand();
        
        // Create a VS Code extension structure
        await fs.writeFile(path.join(testWorkspace, 'package.json'), JSON.stringify({
            name: 'test-extension',
            engines: { vscode: '^1.74.0' },
            main: './out/extension.js'
        }));
        
        const context = await (command as any).analyzeProjectContext(testWorkspace);
        
        assert.ok(context.includes('VS Code'), 'Should detect VS Code extension');
    });
});
