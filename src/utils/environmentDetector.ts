import * as vscode from 'vscode';

/**
 * Utility to detect the current development environment
 */
export class EnvironmentDetector {
  private static _isCursor: boolean | undefined;
  
  /**
   * Detects if the extension is running in Cursor
   */
  static isCursor(): boolean {
    if (this._isCursor !== undefined) {
      return this._isCursor;
    }
    
    try {
      // Check for Cursor-specific indicators
      const appName = vscode.env.appName.toLowerCase();
      const uriScheme = vscode.env.uriScheme.toLowerCase();
      
      // Cursor typically has 'cursor' in app name or uses 'cursor' as URI scheme
      this._isCursor = appName.includes('cursor') || uriScheme.includes('cursor');
      
      // Also check for Cursor-specific extensions or context
      if (!this._isCursor) {
        const cursorExtensions = vscode.extensions.all.filter(ext => 
          ext.id.toLowerCase().includes('cursor')
        );
        this._isCursor = cursorExtensions.length > 0;
      }
      
      return this._isCursor;
    } catch (error) {
      console.warn('Failed to detect Cursor environment:', error);
      this._isCursor = false;
      return false;
    }
  }
  
  /**
   * Detects if the extension is running in VS Code
   */
  static isVSCode(): boolean {
    return !this.isCursor();
  }
  
  /**
   * Gets the environment name
   */
  static getEnvironmentName(): string {
    return this.isCursor() ? 'Cursor' : 'VS Code';
  }
  
  /**
   * Gets a display message based on the environment
   */
  static getWelcomeMessage(): string {
    const env = this.getEnvironmentName();
    return `🦫 Cappy Memory: Activating in ${env}...`;
  }
}



