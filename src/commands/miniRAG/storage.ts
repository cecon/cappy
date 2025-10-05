import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class MiniRAGStorage {
    private context: vscode.ExtensionContext;
    private storagePath: string;
    private lanceDbPath: string;
    private cachePath: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.storagePath = path.join(context.globalStorageUri.fsPath, 'miniRAG');
        this.lanceDbPath = path.join(this.storagePath, 'lancedb');
        this.cachePath = path.join(this.storagePath, 'cache');
    }

    async initialize(): Promise<void> {
        try {
            // Create storage directories
            await fs.promises.mkdir(this.storagePath, { recursive: true });
            await fs.promises.mkdir(this.lanceDbPath, { recursive: true });
            await fs.promises.mkdir(this.cachePath, { recursive: true });

            // Check permissions
            await this.checkPermissions();
            
            // Check disk space
            await this.checkDiskSpace();

            console.log('Mini-LightRAG storage initialized successfully');
            console.log(`Storage path: ${this.storagePath}`);
            console.log(`LanceDB path: ${this.lanceDbPath}`);
            console.log(`Cache path: ${this.cachePath}`);

        } catch (error) {
            console.error('Failed to initialize Mini-LightRAG storage:', error);
            throw error;
        }
    }

    private async checkPermissions(): Promise<void> {
        try {
            // Test write permission by creating a temporary file
            const testFile = path.join(this.storagePath, '.test-write');
            await fs.promises.writeFile(testFile, 'test');
            await fs.promises.unlink(testFile);
        } catch (error) {
            throw new Error(`No write permission for storage directory: ${this.storagePath}`);
        }
    }

    private async checkDiskSpace(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('miniRAG');
            const maxStorageGB = config.get<number>('maxStorageGB', 2);
            const maxBytes = maxStorageGB * 1024 * 1024 * 1024; // Convert GB to bytes

            // Get current storage size
            const currentSize = await this.getDirectorySize(this.storagePath);
            
            if (currentSize > maxBytes) {
                throw new Error(`Storage limit exceeded: ${(currentSize / 1024 / 1024 / 1024).toFixed(2)}GB > ${maxStorageGB}GB`);
            }

            console.log(`Storage usage: ${(currentSize / 1024 / 1024).toFixed(2)}MB / ${maxStorageGB * 1024}MB`);

        } catch (error) {
            console.warn('Could not check disk space:', error);
            // Don't throw - this is not critical
        }
    }

    private async getDirectorySize(dirPath: string): Promise<number> {
        let totalSize = 0;
        try {
            const items = await fs.promises.readdir(dirPath);
            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.promises.stat(itemPath);
                if (stats.isDirectory()) {
                    totalSize += await this.getDirectorySize(itemPath);
                } else {
                    totalSize += stats.size;
                }
            }
        } catch (error) {
            // Directory might not exist yet
        }
        return totalSize;
    }

    // Getter methods
    getStoragePath(): string {
        return this.storagePath;
    }

    getLanceDbPath(): string {
        return this.lanceDbPath;
    }

    getCachePath(): string {
        return this.cachePath;
    }

    getContext(): vscode.ExtensionContext {
        return this.context;
    }
}
