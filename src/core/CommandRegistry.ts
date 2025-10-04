import * as vscode from 'vscode';

/**
 * Command configuration interface
 */
export interface CommandConfig {
  /** Command ID (e.g., 'cappy.init') */
  id: string;
  /** Function to execute when command is invoked */
  handler: (...args: any[]) => Promise<any> | any;
  /** Human-readable description for error messages */
  description?: string;
  /** Whether to show error messages to user (default: true) */
  showErrors?: boolean;
  /** Custom error handler */
  errorHandler?: (error: any) => void;
}

/**
 * Centralized command registry with automatic error handling
 * 
 * @example
 * ```typescript
 * const registry = new CommandRegistry(context);
 * 
 * registry.register({
 *   id: 'cappy.init',
 *   handler: async () => { ... },
 *   description: 'Initialize Cappy'
 * });
 * 
 * registry.registerAll();
 * ```
 */
export class CommandRegistry {
  private commands: CommandConfig[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Register a single command
   */
  register(config: CommandConfig): this {
    this.commands.push(config);
    return this;
  }

  /**
   * Register multiple commands at once
   */
  registerMany(configs: CommandConfig[]): this {
    this.commands.push(...configs);
    return this;
  }

  /**
   * Register all commands with VS Code and add to subscriptions
   */
  registerAll(): void {
    this.commands.forEach(config => {
      const disposable = vscode.commands.registerCommand(
        config.id,
        async (...args: any[]) => {
          try {
            return await config.handler(...args);
          } catch (error) {
            this.handleError(error, config);
            return config.handler.constructor.name === 'AsyncFunction' ? '' : undefined;
          }
        }
      );

      this.disposables.push(disposable);
      this.context.subscriptions.push(disposable);
    });

    console.log(`✅ Registered ${this.commands.length} commands`);
  }

  /**
   * Handle command errors with consistent formatting
   */
  private handleError(error: any, config: CommandConfig): void {
    const commandName = config.description || config.id;
    
    // Log to console
    console.error(`❌ ${commandName} error:`, error);

    // Custom error handler
    if (config.errorHandler) {
      config.errorHandler(error);
      return;
    }

    // Default: show error message to user
    if (config.showErrors !== false) {
      vscode.window.showErrorMessage(`${commandName} failed: ${error}`);
    }
  }

  /**
   * Get number of registered commands
   */
  get count(): number {
    return this.commands.length;
  }

  /**
   * Dispose all registered commands
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.commands = [];
  }
}
