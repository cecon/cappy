import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import { InitForgeCommand } from '../../commands/initForge';
import { FileManager } from '../../utils/fileManager';

suite('InitForge Command Tests', () => {
    
    let tempDir: string;
    let fileManager: FileManager;
    let initCommand: InitForgeCommand;

    setup(async () => {
        // Criar diretório temporário para testes
        tempDir = path.join(__dirname, '..', '..', '..', 'test-temp');
        await fs.ensureDir(tempDir);
        
        // Mock do workspace
        const workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(tempDir),
            name: 'test-workspace',
            index: 0
        };

        // Mockar vscode.workspace.workspaceFolders
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [workspaceFolder],
            configurable: true
        });

        fileManager = new FileManager();
        initCommand = new InitForgeCommand(fileManager);
    });

    teardown(async () => {
        // Limpar diretório temporário
        if (await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
        }
    });

    test('Deve criar estrutura básica do FORGE', async () => {
        // Arrange & Act
        const result = await initCommand.execute();

        // Assert
        assert.strictEqual(result, true, 'Comando deve retornar true em caso de sucesso');
        
        // Verificar se criou as pastas
        const forgeDir = path.join(tempDir, '.forge');
        const githubDir = path.join(tempDir, '.github');
        
        assert.strictEqual(await fs.pathExists(forgeDir), true, '.forge folder deve existir');
        assert.strictEqual(await fs.pathExists(githubDir), true, '.github folder deve existir');
        assert.strictEqual(await fs.pathExists(path.join(forgeDir, 'history')), true, '.forge/history folder deve existir');
    });

    test('Deve criar arquivo de configuração', async () => {
        // Arrange & Act
        await initCommand.execute();

        // Assert
        const configPath = path.join(tempDir, '.forge', 'config.yml');
        assert.strictEqual(await fs.pathExists(configPath), true, 'Arquivo config.yml deve existir');
        
        const configContent = await fs.readFile(configPath, 'utf8');
        assert.strictEqual(configContent.length > 0, true, 'Config deve ter conteúdo');
        assert.strictEqual(configContent.includes('version:'), true, 'Config deve ter versão');
    });

    test('Deve criar instruções para Copilot', async () => {
        // Arrange & Act
        await initCommand.execute();

        // Assert
        const instructionsPath = path.join(tempDir, '.github', 'copilot-instructions.md');
        assert.strictEqual(await fs.pathExists(instructionsPath), true, 'Instruções do Copilot devem existir');
        
        const instructionsContent = await fs.readFile(instructionsPath, 'utf8');
        assert.strictEqual(instructionsContent.includes('FORGE Framework'), true, 'Instruções devem mencionar FORGE');
        assert.strictEqual(instructionsContent.includes('Prevention Rules'), true, 'Instruções devem mencionar Prevention Rules');
    });

    test('Deve criar prevention rules iniciais', async () => {
        // Arrange & Act
        await initCommand.execute();

        // Assert
        const rulesPath = path.join(tempDir, '.forge', 'prevention-rules.md');
        assert.strictEqual(await fs.pathExists(rulesPath), true, 'Prevention rules devem existir');
        
        const rulesContent = await fs.readFile(rulesPath, 'utf8');
        assert.strictEqual(rulesContent.includes('Prevention Rules'), true, 'Rules devem ter título correto');
        assert.strictEqual(rulesContent.includes('[SETUP]'), true, 'Deve ter regra inicial de setup');
    });

    test('Deve detectar linguagens do projeto', async () => {
        // Arrange - criar um package.json para simular projeto Node.js
        const packageJsonPath = path.join(tempDir, 'package.json');
        await fs.writeFile(packageJsonPath, JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
                'react': '^18.0.0'
            }
        }));

        // Act
        await initCommand.execute();

        // Assert
        const configPath = path.join(tempDir, '.forge', 'config.yml');
        const configContent = await fs.readFile(configPath, 'utf8');
        assert.strictEqual(configContent.includes('javascript'), true, 'Deve detectar JavaScript');
    });

    test('Deve detectar frameworks do projeto', async () => {
        // Arrange - criar package.json com React
        const packageJsonPath = path.join(tempDir, 'package.json');
        await fs.writeFile(packageJsonPath, JSON.stringify({
            name: 'test-project',
            dependencies: {
                'react': '^18.0.0',
                'next': '^13.0.0'
            }
        }));

        // Act
        await initCommand.execute();

        // Assert
        const instructionsPath = path.join(tempDir, '.github', 'copilot-instructions.md');
        const instructionsContent = await fs.readFile(instructionsPath, 'utf8');
        assert.strictEqual(instructionsContent.includes('react'), true, 'Deve detectar React framework');
    });

    test('Deve falhar se não houver workspace', async () => {
        // Arrange - remover workspace
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            configurable: true
        });

        // Act
        const result = await initCommand.execute();

        // Assert
        assert.strictEqual(result, false, 'Deve retornar false se não houver workspace');
    });

    test('Deve permitir sobrescrever configuração existente', async () => {
        // Arrange - criar estrutura existente
        const forgeDir = path.join(tempDir, '.forge');
        await fs.ensureDir(forgeDir);
        await fs.writeFile(path.join(forgeDir, 'config.yml'), 'existing: true');

        // Mock user choosing "Sim" para sobrescrever
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        vscode.window.showWarningMessage = async () => 'Sim' as any;

        try {
            // Act
            const result = await initCommand.execute();

            // Assert
            assert.strictEqual(result, true, 'Deve permitir sobrescrever');
            
            const configContent = await fs.readFile(path.join(forgeDir, 'config.yml'), 'utf8');
            assert.strictEqual(configContent.includes('version:'), true, 'Deve ter nova configuração');
            
        } finally {
            // Restore original function
            vscode.window.showWarningMessage = originalShowWarningMessage;
        }
    });
});
