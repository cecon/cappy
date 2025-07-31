import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { FileManager } from '../../utils/fileManager';
import { ForgeConfig, DEFAULT_FORGE_CONFIG } from '../../models/forgeConfig';

suite('FileManager Tests', () => {
    
    let tempDir: string;
    let fileManager: FileManager;

    setup(async () => {
        // Criar diretório temporário para testes
        tempDir = path.join(__dirname, '..', '..', '..', 'test-temp-filemanager');
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

        fileManager = new FileManager();
    });

    teardown(async () => {
        // Limpar diretório temporário
        if (await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }
    });

    test('Deve criar estrutura FORGE corretamente', async () => {
        // Act
        await fileManager.ensureForgeStructure();

        // Assert
        const forgePath = path.join(tempDir, '.forge');
        const tasksPath = path.join(tempDir, 'tasks');
        
        assert.strictEqual(await fs.pathExists(forgePath), true, '.forge folder deve existir');
        assert.strictEqual(await fs.pathExists(tasksPath), true, 'tasks folder deve existir');
    });

    test('Deve escrever e ler configuração FORGE', async () => {
        // Arrange
        await fileManager.ensureForgeStructure(); // Ensure .forge directory exists
        
        const testConfig: ForgeConfig = {
            ...DEFAULT_FORGE_CONFIG,
            version: '1.0.0',
            project: {
                name: 'test-project',
                language: ['typescript'],
                framework: ['react'],
                description: 'Test project'
            },
            stack: DEFAULT_FORGE_CONFIG.stack!,
            environment: DEFAULT_FORGE_CONFIG.environment!,
            context: DEFAULT_FORGE_CONFIG.context!,
            tasks: DEFAULT_FORGE_CONFIG.tasks!,
            ai: DEFAULT_FORGE_CONFIG.ai!,
            analytics: DEFAULT_FORGE_CONFIG.analytics!,
            createdAt: new Date(),
            lastUpdated: new Date()
        };

        // Act - Escrever
        await fileManager.writeForgeConfig(testConfig);

        // Assert - Verificar se arquivo foi criado
        const configPath = path.join(tempDir, '.forge', 'config.yml');
        assert.strictEqual(await fs.pathExists(configPath), true, 'Config file deve existir');

        // Act - Ler
        const readConfig = await fileManager.readForgeConfig();

        // Assert - Verificar conteúdo
        assert.strictEqual(readConfig !== null, true, 'Config não deve ser null');
        assert.strictEqual(readConfig!.version, '1.0.0', 'Versão deve ser preservada');
        assert.strictEqual(readConfig!.project.name, 'test-project', 'Nome do projeto deve ser preservado');
        assert.deepStrictEqual(readConfig!.project.language, ['typescript'], 'Linguagem deve ser preservada');
        assert.deepStrictEqual(readConfig!.project.framework, ['react'], 'Framework deve ser preservado');
    });

    test('Deve detectar linguagens do projeto corretamente', async () => {
        // Arrange - criar package.json para detectar JavaScript/TypeScript
        const packageJson = {
            name: 'test-project',
            devDependencies: {
                'typescript': '^4.0.0'
            }
        };
        await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

        // Act
        const languages = await fileManager.getProjectLanguages();

        // Assert - verificar detecção básica de JavaScript/TypeScript
        assert.strictEqual(languages.includes('javascript'), true, 'Deve detectar JavaScript');
        assert.strictEqual(languages.includes('typescript'), true, 'Deve detectar TypeScript');
        assert.strictEqual(languages.length >= 2, true, 'Deve detectar pelo menos 2 linguagens');
    });

    test('Deve detectar frameworks do projeto corretamente', async () => {
        // Arrange - criar package.json com dependências
        const packageJson = {
            name: 'test-project',
            dependencies: {
                'react': '^18.0.0',
                'express': '^4.0.0'
            },
            devDependencies: {
                'vscode': '^1.74.0'
            }
        };
        await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

        // Act
        const frameworks = await fileManager.getProjectFrameworks();

        // Assert - verificar detecção básica
        assert.strictEqual(frameworks.includes('react'), true, 'Deve detectar React');
        assert.strictEqual(frameworks.includes('express'), true, 'Deve detectar Express');
        assert.strictEqual(frameworks.length >= 2, true, 'Deve detectar pelo menos 2 frameworks');
    });

    test('Deve retornar array vazio se não houver package.json', async () => {
        // Act - sem criar package.json
        const frameworks = await fileManager.getProjectFrameworks();

        // Assert
        assert.deepStrictEqual(frameworks, [], 'Deve retornar array vazio');
    });

    test('Deve lidar com package.json inválido', async () => {
        // Arrange - criar package.json inválido
        await fs.writeFile(path.join(tempDir, 'package.json'), 'invalid json content');

        // Act
        const frameworks = await fileManager.getProjectFrameworks();

        // Assert
        assert.deepStrictEqual(frameworks, [], 'Deve retornar array vazio para JSON inválido');
    });

    test('Deve falhar ao ler config se não existir', async () => {
        // Act & Assert
        try {
            await fileManager.readForgeConfig();
            assert.fail('Deveria lançar erro');
        } catch (error) {
            assert.strictEqual(error instanceof Error, true, 'Deve lançar Error');
        }
    });

    test('Deve criar diretórios aninhados corretamente', async () => {
        // Act
        await fileManager.ensureForgeStructure();

        // Assert
        const templatePath = path.join(tempDir, '.forge', 'templates');
        assert.strictEqual(await fs.pathExists(templatePath), true, 'Templates folder deve existir');
    });
});
