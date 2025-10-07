import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EnvironmentDetector } from './environmentDetector';

/**
 * MCP Configuration Manager
 * Automatically configures MCP server settings for VS Code and Cursor
 */
export class MCPConfigManager {
    
    /**
     * Setup MCP server configuration for the current environment
     */
    static async setupMCPConfig(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const isCursor = EnvironmentDetector.isCursor();
            console.log(`[MCP] Setting up MCP config for ${isCursor ? 'Cursor' : 'VS Code'}...`);
            
            if (isCursor) {
                return await this.setupCursorMCP(context);
            } else {
                return await this.setupVSCodeMCP(context);
            }
        } catch (error) {
            console.error('[MCP] Failed to setup MCP configuration:', error);
            return false;
        }
    }
    
    /**
     * Setup MCP for VS Code
     * Creates .vscode/mcp.json in the workspace
     */
    private static async setupVSCodeMCP(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            // Get workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.warn('[MCP] No workspace folder found');
                return false;
            }
            
            // Create .vscode directory if it doesn't exist
            const vscodeDir = path.join(workspaceFolder.uri.fsPath, '.vscode');
            if (!fs.existsSync(vscodeDir)) {
                fs.mkdirSync(vscodeDir, { recursive: true });
            }
            
            // Path to mcp.json
            const mcpConfigPath = path.join(vscodeDir, 'mcp.json');
            
            // Create MCP configuration
            const mcpConfig = {
                servers: {
                    cappy: {
                        type: 'stdio',
                        command: 'node',
                        args: [
                            path.join(context.extensionPath, 'out', 'extension.mcp.js')
                        ],
                        env: {
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            'NODE_ENV': 'production'
                        },
                        description: 'Cappy Memory - Context Orchestration and RAG System'
                    }
                }
            };
            
            // Check if file already exists
            if (fs.existsSync(mcpConfigPath)) {
                try {
                    const existingContent = fs.readFileSync(mcpConfigPath, 'utf8');
                    const existingConfig = JSON.parse(existingContent);
                    
                    // Merge configurations
                    if (!existingConfig.servers) {
                        existingConfig.servers = {};
                    }
                    
                    if (!existingConfig.servers.cappy) {
                        existingConfig.servers.cappy = mcpConfig.servers.cappy;
                        fs.writeFileSync(mcpConfigPath, JSON.stringify(existingConfig, null, 2), 'utf8');
                        console.log('[MCP] Cappy MCP server added to existing mcp.json');
                        return true;
                    } else {
                        console.log('[MCP] Cappy MCP server already configured in mcp.json');
                        return true;
                    }
                } catch (parseError) {
                    console.warn('[MCP] Failed to parse existing mcp.json, creating new one');
                }
            }
            
            // Write new mcp.json
            fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
            console.log('[MCP] Created mcp.json at:', mcpConfigPath);
            
            return true;
            
        } catch (error) {
            console.error('[MCP] Failed to setup VS Code MCP:', error);
            return false;
        }
    }
    
    /**
     * Setup MCP for Cursor
     */
    private static async setupCursorMCP(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const homeDir = os.homedir();
            let configPath: string;
            let configDir: string;
            
            // Determine config path based on OS
            if (process.platform === 'win32') {
                configDir = path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User');
                configPath = path.join(configDir, 'mcp_settings.json');
            } else if (process.platform === 'darwin') {
                configDir = path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User');
                configPath = path.join(configDir, 'mcp_settings.json');
            } else {
                configDir = path.join(homeDir, '.cursor');
                configPath = path.join(configDir, 'mcp_settings.json');
            }
            
            // Ensure directory exists
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            // Read or create config
            let mcpConfig: any = {
                mcpServers: {}
            };
            
            if (fs.existsSync(configPath)) {
                try {
                    const content = fs.readFileSync(configPath, 'utf8');
                    mcpConfig = JSON.parse(content);
                } catch (parseError) {
                    console.warn('[MCP] Failed to parse existing Cursor MCP config, creating new one');
                }
            }
            
            // Ensure mcpServers object exists
            if (!mcpConfig.mcpServers) {
                mcpConfig.mcpServers = {};
            }
            
            // Add or update Cappy MCP server
            if (!mcpConfig.mcpServers['cappy']) {
                mcpConfig.mcpServers['cappy'] = {
                    type: 'stdio',
                    command: 'node',
                    args: [
                        path.join(context.extensionPath, 'out', 'extension.mcp.js')
                    ],
                    env: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'NODE_ENV': 'production'
                    },
                    description: 'Cappy Memory - Context Orchestration and RAG System',
                    enabled: true
                };
                
                // Write config
                fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2), 'utf8');
                
                console.log('[MCP] Cappy MCP server configured for Cursor at:', configPath);
                return true;
            }
            
            console.log('[MCP] Cappy MCP server already configured for Cursor');
            return true;
            
        } catch (error) {
            console.error('[MCP] Failed to setup Cursor MCP:', error);
            return false;
        }
    }
    
    /**
     * Check if MCP is configured
     */
    static async isMCPConfigured(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const isCursor = EnvironmentDetector.isCursor();
            
            if (isCursor) {
                return await this.isCursorMCPConfigured();
            } else {
                return await this.isVSCodeMCPConfigured();
            }
        } catch (error) {
            console.error('[MCP] Failed to check MCP configuration:', error);
            return false;
        }
    }
    
    /**
     * Check if VS Code MCP is configured
     */
    private static async isVSCodeMCPConfigured(): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return false;
            }
            
            const mcpConfigPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'mcp.json');
            
            if (!fs.existsSync(mcpConfigPath)) {
                return false;
            }
            
            const content = fs.readFileSync(mcpConfigPath, 'utf8');
            const mcpConfig = JSON.parse(content);
            
            return !!(mcpConfig.servers && mcpConfig.servers['cappy']);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check if Cursor MCP is configured
     */
    private static async isCursorMCPConfigured(): Promise<boolean> {
        try {
            const homeDir = os.homedir();
            let configPath: string;
            
            if (process.platform === 'win32') {
                configPath = path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User', 'mcp_settings.json');
            } else if (process.platform === 'darwin') {
                configPath = path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'mcp_settings.json');
            } else {
                configPath = path.join(homeDir, '.cursor', 'mcp_settings.json');
            }
            
            if (!fs.existsSync(configPath)) {
                return false;
            }
            
            const content = fs.readFileSync(configPath, 'utf8');
            const mcpConfig = JSON.parse(content);
            
            return !!(mcpConfig.mcpServers && mcpConfig.mcpServers['cappy']);
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Get MCP configuration path for current environment
     */
    static getMCPConfigPath(): string | null {
        try {
            const isCursor = EnvironmentDetector.isCursor();
            const homeDir = os.homedir();
            
            if (isCursor) {
                if (process.platform === 'win32') {
                    return path.join(homeDir, 'AppData', 'Roaming', 'Cursor', 'User', 'mcp_settings.json');
                } else if (process.platform === 'darwin') {
                    return path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'mcp_settings.json');
                } else {
                    return path.join(homeDir, '.cursor', 'mcp_settings.json');
                }
            } else {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    return path.join(workspaceFolder.uri.fsPath, '.vscode', 'mcp.json');
                }
                return null;
            }
        } catch (error) {
            return null;
        }
    }
}
