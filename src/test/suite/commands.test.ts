import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { TaskCreator } from '../../commands/createTask';
import { TaskCompleter } from '../../commands/completeTask';

suite('Commands Tests', () => {
    
    let tempDir: string;

    setup(async () => {
        // Criar diretório temporário para testes
        tempDir = path.join(__dirname, '..', '..', '..', 'test-temp-commands');
        await fs.ensureDir(tempDir);
        
        // Mock do workspace
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(tempDir),
            name: 'test-workspace',
            index: 0
        };

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [workspaceFolder],
            configurable: true
        });
    });

    teardown(async () => {
        // Limpar diretório temporário
        if (await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }
    });

    test('TaskCreator - Deve ser instanciado corretamente', () => {
        // Act
        const taskCreator = new TaskCreator();

        // Assert
        assert.strictEqual(taskCreator !== null, true, 'TaskCreator deve ser instanciado');
        assert.strictEqual(typeof taskCreator.show, 'function', 'Deve ter método show');
    });

    test('TaskCompleter - Deve ser instanciado corretamente', () => {
        // Act
        const taskCompleter = new TaskCompleter();

        // Assert
        assert.strictEqual(taskCompleter !== null, true, 'TaskCompleter deve ser instanciado');
        assert.strictEqual(typeof taskCompleter.show, 'function', 'Deve ter método show');
    });

    test('TaskCreator - Deve detectar workspace disponível', async () => {
        // Arrange
        const taskCreator = new TaskCreator();

        // Assert - verificar se workspace está configurado
        assert.strictEqual(vscode.workspace.workspaceFolders !== undefined, true, 'Workspace deve estar disponível');
        assert.strictEqual(vscode.workspace.workspaceFolders!.length, 1, 'Deve ter um workspace folder');
        assert.strictEqual(vscode.workspace.workspaceFolders![0].uri.fsPath, tempDir, 'Workspace path deve estar correto');
    });

    test('Estrutura de tasks - Deve criar diretório de tasks se não existir', async () => {
        // Arrange
        const tasksDir = path.join(tempDir, 'tasks');
        
        // Ensure tasks directory doesn't exist
        if (await fs.pathExists(tasksDir)) {
            await fs.remove(tasksDir);
        }

        // Act - create tasks directory
        await fs.ensureDir(tasksDir);

        // Assert
        assert.strictEqual(await fs.pathExists(tasksDir), true, 'Diretório tasks deve ser criado');
    });

    test('Validação de workspace - Deve detectar quando não há workspace', async () => {
        // Arrange
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true
        });

        // Assert
        assert.strictEqual(vscode.workspace.workspaceFolders, undefined, 'Workspace deve estar undefined');
    });

    test('Estrutura de task - Deve criar estrutura básica de task', async () => {
        // Arrange
        const tasksDir = path.join(tempDir, 'tasks');
        await fs.ensureDir(tasksDir);
        
        const taskDir = 'TASK_0001_test_task';
        const taskPath = path.join(tasksDir, taskDir);

        // Act
        await fs.ensureDir(taskPath);
        
        const descriptionFile = path.join(taskPath, `${taskDir}_DESCRIPTION.md`);
        const doneFile = path.join(taskPath, `${taskDir}_DONE.md`);
        
        await fs.writeFile(descriptionFile, '# Test Task\n\nDescrição da tarefa de teste');
        await fs.writeFile(doneFile, '# Critérios de Conclusão\n\n- [ ] Implementar feature');

        // Assert
        assert.strictEqual(await fs.pathExists(taskPath), true, 'Diretório da task deve existir');
        assert.strictEqual(await fs.pathExists(descriptionFile), true, 'Arquivo DESCRIPTION deve existir');
        assert.strictEqual(await fs.pathExists(doneFile), true, 'Arquivo DONE deve existir');
        
        // Verificar conteúdo
        const descContent = await fs.readFile(descriptionFile, 'utf8');
        const doneContent = await fs.readFile(doneFile, 'utf8');
        
        assert.strictEqual(descContent.includes('Test Task'), true, 'DESCRIPTION deve conter título');
        assert.strictEqual(doneContent.includes('Critérios de Conclusão'), true, 'DONE deve conter critérios');
    });

    test('Numeração de tasks - Deve detectar próximo número de task', async () => {
        // Arrange
        const tasksDir = path.join(tempDir, 'tasks');
        await fs.ensureDir(tasksDir);
        
        // Criar algumas tasks existentes
        await fs.ensureDir(path.join(tasksDir, 'TASK_0001_primeira'));
        await fs.ensureDir(path.join(tasksDir, 'TASK_0003_terceira')); // Gap proposital
        await fs.ensureDir(path.join(tasksDir, 'TASK_0005_quinta'));

        // Act - Ler diretórios existentes
        const existingDirs = await fs.readdir(tasksDir);
        const taskNumbers = existingDirs
            .filter(dir => dir.startsWith('TASK_'))
            .map(dir => parseInt(dir.split('_')[1]))
            .filter(num => !isNaN(num))
            .sort((a, b) => a - b);

        const nextNumber = taskNumbers.length > 0 ? Math.max(...taskNumbers) + 1 : 1;

        // Assert
        assert.strictEqual(existingDirs.length, 3, 'Deve ter 3 tasks existentes');
        assert.strictEqual(nextNumber, 6, 'Próximo número deve ser 6');
        assert.deepStrictEqual(taskNumbers, [1, 3, 5], 'Números das tasks devem estar corretos');
    });

    test('Validação de nomes de task - Deve normalizar nomes corretamente', () => {
        // Arrange
        const testCases = [
            { input: 'Implementar Login System', expected: 'implementar_login_system' },
            { input: 'Create User Dashboard', expected: 'create_user_dashboard' },
            { input: 'Fix   Multiple   Spaces', expected: 'fix_multiple_spaces' },
            { input: 'Remove-Special@Characters!', expected: 'removespecialcharacters' }
        ];

        testCases.forEach(testCase => {
            // Act
            const normalized = testCase.input
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .trim();

            // Assert
            assert.strictEqual(normalized, testCase.expected, `'${testCase.input}' deve ser normalizado para '${testCase.expected}'`);
        });
    });
});
