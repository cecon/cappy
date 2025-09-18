import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { writeOutputForced } from '../utils/outputWriter';

interface IndexEntry {
    id: string;
    title: string;
    path: string;
    content: string;
    category: string;
    keywords: string[];
    lastModified: string;
    type: 'task' | 'doc' | 'rule';
}

interface TaskIndex {
    tasks: IndexEntry[];
    lastUpdated: string;
}

interface DocsIndex {
    docs: IndexEntry[];
    lastUpdated: string;
}

interface RulesIndex {
    rules: IndexEntry[];
    lastUpdated: string;
}

export class ReindexCommand {
    constructor(private extensionContext?: vscode.ExtensionContext) {}

    async execute(): Promise<string> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                const message = 'No workspace folder found. Please open a project folder first.';
                writeOutputForced(message);
                return message;
            }

            const cappyDir = path.join(workspaceFolder.uri.fsPath, '.cappy');
            
            // Verificar se o projeto está inicializado
            try {
                await fs.promises.access(cappyDir, fs.constants.F_OK);
            } catch (error) {
                const message = 'Cappy not initialized. Please run "cappy.init" first.';
                writeOutputForced(message);
                return message;
            }

            // Executar reindexação com progresso
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '🔄 Reindexing Cappy',
                cancellable: false
            }, async (progress) => {
                
                progress.report({ increment: 0, message: 'Starting reindexation...' });

                const indexesDir = path.join(cappyDir, 'indexes');
                
                // Criar diretório de índices se não existir
                await fs.promises.mkdir(indexesDir, { recursive: true });

                progress.report({ increment: 10, message: 'Indexing tasks...' });
                const tasksIndex = await this.indexTasks(cappyDir);
                
                progress.report({ increment: 30, message: 'Indexing documentation...' });
                const docsIndex = await this.indexDocs(workspaceFolder.uri.fsPath);
                
                progress.report({ increment: 60, message: 'Indexing prevention rules...' });
                const rulesIndex = await this.indexRules(workspaceFolder.uri.fsPath);

                progress.report({ increment: 80, message: 'Writing index files...' });
                await this.writeIndexFiles(indexesDir, tasksIndex, docsIndex, rulesIndex);

                progress.report({ increment: 100, message: 'Reindexation complete!' });

                const summary = this.generateSummary(tasksIndex, docsIndex, rulesIndex);
                writeOutputForced(summary);
                
                return summary;
            });

        } catch (error) {
            const errorMessage = `Reindexation failed: ${error}`;
            writeOutputForced(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
            return errorMessage;
        }
    }

    private async indexTasks(cappyDir: string): Promise<TaskIndex> {
        const tasksIndex: TaskIndex = {
            tasks: [],
            lastUpdated: new Date().toISOString()
        };

        // Indexar tasks ativas
        const tasksDir = path.join(cappyDir, 'tasks');
        if (await this.pathExists(tasksDir)) {
            const taskFiles = await fs.promises.readdir(tasksDir);
            for (const file of taskFiles) {
                if (file.endsWith('.xml')) {
                    const entry = await this.processTaskFile(path.join(tasksDir, file));
                    if (entry) {
                        tasksIndex.tasks.push(entry);
                    }
                }
            }
        }

        // Indexar tasks no histórico
        const historyDir = path.join(cappyDir, 'history');
        if (await this.pathExists(historyDir)) {
            const historyFiles = await fs.promises.readdir(historyDir);
            for (const file of historyFiles) {
                if (file.endsWith('.xml')) {
                    const entry = await this.processTaskFile(path.join(historyDir, file));
                    if (entry) {
                        tasksIndex.tasks.push(entry);
                    }
                }
            }
        }

        return tasksIndex;
    }

    private async indexDocs(workspaceRoot: string): Promise<DocsIndex> {
        const docsIndex: DocsIndex = {
            docs: [],
            lastUpdated: new Date().toISOString()
        };

        const docsDir = path.join(workspaceRoot, 'docs');
        if (await this.pathExists(docsDir)) {
            await this.indexDirectory(docsDir, docsIndex.docs, 'doc');
        }

        return docsIndex;
    }

    private async indexRules(workspaceRoot: string): Promise<RulesIndex> {
        const rulesIndex: RulesIndex = {
            rules: [],
            lastUpdated: new Date().toISOString()
        };

        // Indexar prevention rules
        const preventionDir = path.join(workspaceRoot, 'docs', 'prevention');
        if (await this.pathExists(preventionDir)) {
            await this.indexDirectory(preventionDir, rulesIndex.rules, 'rule');
        }

        return rulesIndex;
    }

    private async indexDirectory(dirPath: string, entries: IndexEntry[], type: 'doc' | 'rule'): Promise<void> {
        try {
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    // Recursivamente indexar subdiretórios
                    await this.indexDirectory(fullPath, entries, type);
                } else if (item.isFile() && this.isSupportedFile(item.name)) {
                    const entry = await this.processDocFile(fullPath, type);
                    if (entry) {
                        entries.push(entry);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to index directory ${dirPath}:`, error);
        }
    }

    private async processTaskFile(filePath: string): Promise<IndexEntry | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const stats = await fs.promises.stat(filePath);
            
            // Extrair informações da task XML
            const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/s);
            const categoryMatch = content.match(/category=["']([^"']+)["']/);
            const idMatch = content.match(/id=["']([^"']+)["']/);
            
            const keywords = await this.extractKeywords(content, filePath);
            
            return {
                id: idMatch?.[1] || path.basename(filePath, '.xml'),
                title: titleMatch?.[1]?.trim() || path.basename(filePath, '.xml'),
                path: filePath,
                content: content.substring(0, 1000), // Primeiros 1000 caracteres para busca
                category: categoryMatch?.[1] || 'general',
                keywords,
                lastModified: stats.mtime.toISOString(),
                type: 'task'
            };
        } catch (error) {
            console.warn(`Failed to process task file ${filePath}:`, error);
            return null;
        }
    }

    private async processDocFile(filePath: string, type: 'doc' | 'rule'): Promise<IndexEntry | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const stats = await fs.promises.stat(filePath);
            
            // Extrair título do arquivo (primeira linha de heading)
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch?.[1] || path.basename(filePath, path.extname(filePath));
            
            const keywords = await this.extractKeywords(content, filePath);
            const category = this.inferCategory(filePath, content);
            
            return {
                id: this.generateId(filePath),
                title: title.trim(),
                path: filePath,
                content: content.substring(0, 1000), // Primeiros 1000 caracteres para busca
                category,
                keywords,
                lastModified: stats.mtime.toISOString(),
                type
            };
        } catch (error) {
            console.warn(`Failed to process doc file ${filePath}:`, error);
            return null;
        }
    }

    private async extractKeywords(content: string, filePath: string): Promise<string[]> {
        // Extrair palavras-chave relevantes do conteúdo
        const keywords = new Set<string>();
        
        // Palavras técnicas comuns
        const technicalTerms = content.match(/\b(?:api|auth|database|ui|test|component|service|function|class|method|error|bug|feature|task|rule|prevention)\b/gi);
        if (technicalTerms) {
            technicalTerms.forEach(term => keywords.add(term.toLowerCase()));
        }
        
        // Palavras em maiúscula (possivelmente acrônimos ou nomes importantes)
        const upperCaseWords = content.match(/\b[A-Z]{2,}\b/g);
        if (upperCaseWords) {
            upperCaseWords.forEach(word => keywords.add(word.toLowerCase()));
        }
        
        // Usar VS Code API para extrair símbolos do workspace se disponível
        try {
            await this.extractWorkspaceSymbols(filePath, keywords);
        } catch (error) {
            // Fallback para extração manual se API falhar
            console.warn('Failed to extract workspace symbols:', error);
        }
        
        // Usar VS Code FindFiles API para encontrar arquivos relacionados
        await this.findRelatedFiles(path.basename(filePath), keywords);
        
        return Array.from(keywords).slice(0, 20); // Limitar a 20 keywords por arquivo
    }

    private async extractWorkspaceSymbols(filePath: string, keywords: Set<string>): Promise<void> {
        try {
            // Usar a API nativa do VS Code para extrair símbolos
            const uri = vscode.Uri.file(filePath);
            
            // Tentar obter símbolos do documento se ele estiver aberto
            const document = await vscode.workspace.openTextDocument(uri);
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeDocumentSymbolProvider', 
                uri
            );
            
            if (symbols) {
                symbols.forEach(symbol => {
                    keywords.add(symbol.name.toLowerCase());
                    if (symbol.containerName) {
                        keywords.add(symbol.containerName.toLowerCase());
                    }
                });
            }
        } catch (error) {
            // Se falhar, continuar sem símbolos específicos
            console.warn(`Failed to extract symbols from ${filePath}:`, error);
        }
    }

    private async findRelatedFiles(fileName: string, keywords: Set<string>): Promise<void> {
        try {
            // Usar VS Code findFiles API para buscar arquivos relacionados
            const baseName = path.basename(fileName, path.extname(fileName));
            const searchPattern = `**/*${baseName}*`;
            
            const relatedFiles = await vscode.workspace.findFiles(searchPattern, null, 10);
            
            relatedFiles.forEach(uri => {
                const relatedFileName = path.basename(uri.fsPath);
                const nameParts = relatedFileName.split(/[-_\.]/).filter(part => part.length > 2);
                nameParts.forEach(part => keywords.add(part.toLowerCase()));
            });
        } catch (error) {
            console.warn('Failed to find related files:', error);
        }
    }

    private inferCategory(filePath: string, content: string): string {
        const pathLower = filePath.toLowerCase();
        const contentLower = content.toLowerCase();
        
        if (pathLower.includes('auth') || contentLower.includes('authentication') || contentLower.includes('login')) {
            return 'auth';
        }
        if (pathLower.includes('database') || contentLower.includes('sql') || contentLower.includes('migration')) {
            return 'database';
        }
        if (pathLower.includes('api') || contentLower.includes('endpoint') || contentLower.includes('route')) {
            return 'api';
        }
        if (pathLower.includes('ui') || pathLower.includes('component') || contentLower.includes('frontend')) {
            return 'ui';
        }
        if (pathLower.includes('test') || contentLower.includes('testing') || contentLower.includes('spec')) {
            return 'testing';
        }
        if (pathLower.includes('prevention') || contentLower.includes('rule') || contentLower.includes('error')) {
            return 'prevention';
        }
        
        return 'general';
    }

    private generateId(filePath: string): string {
        return path.basename(filePath, path.extname(filePath))
            .replace(/[^a-zA-Z0-9]/g, '-')
            .toLowerCase();
    }

    private isSupportedFile(fileName: string): boolean {
        const supportedExtensions = ['.md', '.xml', '.txt', '.json', '.yaml', '.yml'];
        return supportedExtensions.some(ext => fileName.endsWith(ext));
    }

    private async writeIndexFiles(
        indexesDir: string, 
        tasksIndex: TaskIndex, 
        docsIndex: DocsIndex, 
        rulesIndex: RulesIndex
    ): Promise<void> {
        const tasksPath = path.join(indexesDir, 'tasks.json');
        const docsPath = path.join(indexesDir, 'docs.json');
        const rulesPath = path.join(indexesDir, 'rules.json');

        await fs.promises.writeFile(tasksPath, JSON.stringify(tasksIndex, null, 2), 'utf8');
        await fs.promises.writeFile(docsPath, JSON.stringify(docsIndex, null, 2), 'utf8');
        await fs.promises.writeFile(rulesPath, JSON.stringify(rulesIndex, null, 2), 'utf8');
    }

    private generateSummary(tasksIndex: TaskIndex, docsIndex: DocsIndex, rulesIndex: RulesIndex): string {
        const tasksCount = tasksIndex.tasks.length;
        const docsCount = docsIndex.docs.length;
        const rulesCount = rulesIndex.rules.length;
        
        return `Reindexation completed successfully:
- Tasks indexed: ${tasksCount}
- Docs indexed: ${docsCount}
- Rules indexed: ${rulesCount}
- Total entries: ${tasksCount + docsCount + rulesCount}
- Last updated: ${new Date().toISOString()}`;
    }

    private async pathExists(path: string): Promise<boolean> {
        try {
            await fs.promises.access(path, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
}