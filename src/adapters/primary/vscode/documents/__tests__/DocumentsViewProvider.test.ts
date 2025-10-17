/**
 * @fileoverview Tests for DocumentsViewProvider
 * @module adapters/primary/vscode/documents/__tests__/DocumentsViewProvider.test
 * @author Cappy Team
 * @since 3.0.4
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentsViewProvider } from '../DocumentsViewProvider';

// Mock VS Code API
vi.mock('vscode', () => ({
  window: {
    showOpenDialog: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, toString: () => path }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    joinPath: (base: any, ...pathSegments: string[]) => ({
      fsPath: `${base.fsPath}/${pathSegments.join('/')}`,
      toString: () => `${base.fsPath}/${pathSegments.join('/')}`
    }),
  },
  WebviewView: vi.fn(),
}));

describe('DocumentsViewProvider', () => {
  let provider: DocumentsViewProvider;
  let mockExtensionUri: vscode.Uri;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWebviewView: any;
  let testFilePath: string;
  let testWorkspaceDir: string;

  beforeEach(() => {
    // Create test workspace directory
    testWorkspaceDir = fs.mkdtempSync(path.join(__dirname, 'test-workspace-'));
    testFilePath = path.join(testWorkspaceDir, 'test-file.ts');
    
    // Create a test TypeScript file
    fs.writeFileSync(testFilePath, `
/**
 * Test user service
 */
export class UserService {
  /**
   * Get user by ID
   */
  getUser(id: string): User {
    return { id, name: 'Test' };
  }
}
`);

    console.log('\n🧪 Test Setup:');
    console.log(`  📁 Test workspace: ${testWorkspaceDir}`);
    console.log(`  📝 Test file: ${testFilePath}`);
    console.log(`  📊 File size: ${fs.statSync(testFilePath).size} bytes`);

    // Mock extension URI
    mockExtensionUri = { fsPath: '/mock/extension/path' } as vscode.Uri;

    // Create provider instance
    provider = new DocumentsViewProvider(mockExtensionUri);

    // Mock webview view
    mockWebviewView = {
      webview: {
        options: {},
        html: '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onDidReceiveMessage: vi.fn((callback: any) => {
          mockWebviewView._messageCallback = callback;
          return { dispose: vi.fn() };
        }),
        postMessage: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        asWebviewUri: vi.fn((uri: any) => ({
          ...uri,
          toString: () => `webview://${uri.fsPath}`
        })),
      },
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup test workspace
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
      console.log('  🗑️  Cleaned up test workspace');
    }
  });

  describe('Upload File Flow', () => {
    it('should handle upload when user selects files', async () => {
      console.log('\n📝 Test: should handle upload when user selects files');
      
      // Step 1: Resolve webview
      console.log('  ⚙️  Step 1: Resolving webview...');
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );
      console.log('  ✅ Webview resolved');

      // Step 2: Mock showOpenDialog to return test file
      console.log('  ⚙️  Step 2: Mocking file selection...');
      const mockFileUri = { fsPath: testFilePath };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockFileUri] as any);
      console.log(`  ✅ Mock will return: ${testFilePath}`);

      // Step 3: Mock executeCommand to simulate processing
      console.log('  ⚙️  Step 3: Mocking command execution...');
      let commandCalled = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let commandOptions: any = null;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(vscode.commands.executeCommand).mockImplementation(async (command: string, options: any) => {
        console.log(`  📞 Command called: ${command}`, options);
        commandCalled = true;
        commandOptions = options;
        
        if (command === 'cappy.processSingleFileInternal') {
          // Simulate progress callbacks
          if (options?.onProgress) {
            console.log('  📊 Simulating progress updates...');
            options.onProgress('Initializing services...', 10);
            options.onProgress('Parsing file...', 30);
            options.onProgress('Creating chunks...', 50);
            options.onProgress('Storing in database...', 80);
            options.onProgress('Completed', 100);
            console.log('  ✅ Progress simulation complete');
          }
        }
        
        return Promise.resolve();
      });

      // Step 4: Send upload message from webview
      console.log('  ⚙️  Step 4: Sending upload message from webview...');
      const messageCallback = mockWebviewView._messageCallback;
      expect(messageCallback).toBeDefined();
      
      console.log('  📤 Calling message callback with type: document/upload');
      await messageCallback({ type: 'document/upload' });
      console.log('  ✅ Message callback executed');

      // Step 5: Verify showOpenDialog was called
      console.log('  ⚙️  Step 5: Verifying showOpenDialog...');
      expect(vscode.window.showOpenDialog).toHaveBeenCalledTimes(1);
      expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        filters: {
          'TypeScript': ['ts', 'tsx'],
          'JavaScript': ['js', 'jsx'],
          'Markdown': ['md', 'mdx'],
          'All Files': ['*']
        },
        title: 'Select files to process'
      });
      console.log('  ✅ showOpenDialog was called with correct options');

      // Step 6: Verify command was executed
      console.log('  ⚙️  Step 6: Verifying command execution...');
      expect(commandCalled).toBe(true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'cappy.processSingleFileInternal',
        expect.objectContaining({
          filePath: testFilePath,
          onProgress: expect.any(Function)
        })
      );
      console.log('  ✅ Command was executed with correct parameters');

      // Step 7: Verify onProgress callback was provided
      console.log('  ⚙️  Step 7: Verifying onProgress callback...');
      expect(commandOptions).toBeDefined();
      expect(commandOptions.filePath).toBe(testFilePath);
      expect(typeof commandOptions.onProgress).toBe('function');
      console.log('  ✅ onProgress callback is present');

      console.log('  ✨ Test passed!');
    });

    it('should handle upload when user cancels file selection', async () => {
      console.log('\n📝 Test: should handle upload when user cancels');
      
      // Resolve webview
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      // Mock showOpenDialog to return undefined (user cancelled)
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(undefined);
      console.log('  ⚙️  Mock will return: undefined (cancelled)');

      // Send upload message
      const messageCallback = mockWebviewView._messageCallback;
      await messageCallback({ type: 'document/upload' });

      // Verify showOpenDialog was called
      expect(vscode.window.showOpenDialog).toHaveBeenCalledTimes(1);
      console.log('  ✅ showOpenDialog was called');

      // Verify executeCommand was NOT called
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
      console.log('  ✅ Command was NOT executed (as expected)');
      
      console.log('  ✨ Test passed!');
    });

    it('should handle upload with multiple files', async () => {
      console.log('\n📝 Test: should handle upload with multiple files');
      
      // Create additional test files
      const testFile2 = path.join(testWorkspaceDir, 'test-file2.ts');
      const testFile3 = path.join(testWorkspaceDir, 'test-file3.ts');
      
      fs.writeFileSync(testFile2, 'export const test2 = "test";');
      fs.writeFileSync(testFile3, 'export const test3 = "test";');
      
      console.log(`  📝 Created additional files: ${testFile2}, ${testFile3}`);

      // Resolve webview
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      // Mock showOpenDialog to return multiple files
      const mockFileUris = [
        { fsPath: testFilePath },
        { fsPath: testFile2 },
        { fsPath: testFile3 }
      ];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue(mockFileUris as any);
      console.log(`  ⚙️  Mock will return ${mockFileUris.length} files`);

      // Mock executeCommand
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

      // Send upload message
      const messageCallback = mockWebviewView._messageCallback;
      await messageCallback({ type: 'document/upload' });

      // Verify showOpenDialog was called
      expect(vscode.window.showOpenDialog).toHaveBeenCalledTimes(1);
      console.log('  ✅ showOpenDialog was called');

      // Verify executeCommand was called 3 times
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(3);
      console.log('  ✅ Command was called 3 times (once per file)');

      // Verify each file was processed
      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        1,
        'cappy.processSingleFileInternal',
        expect.objectContaining({ filePath: testFilePath })
      );
      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        2,
        'cappy.processSingleFileInternal',
        expect.objectContaining({ filePath: testFile2 })
      );
      expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(
        3,
        'cappy.processSingleFileInternal',
        expect.objectContaining({ filePath: testFile3 })
      );
      console.log('  ✅ All files were processed in order');
      
      console.log('  ✨ Test passed!');
    });

    it('should handle errors during file processing', async () => {
      console.log('\n📝 Test: should handle errors during processing');
      
      // Resolve webview
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      // Mock showOpenDialog to return test file
      const mockFileUri = { fsPath: testFilePath };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([mockFileUri] as any);

      // Mock executeCommand to throw error
      const testError = new Error('Test processing error');
      vi.mocked(vscode.commands.executeCommand).mockRejectedValue(testError);
      console.log('  ⚙️  Mock will throw error:', testError.message);

      // Send upload message
      const messageCallback = mockWebviewView._messageCallback;
      await messageCallback({ type: 'document/upload' });

      // Verify showOpenDialog was called
      expect(vscode.window.showOpenDialog).toHaveBeenCalledTimes(1);
      console.log('  ✅ showOpenDialog was called');

      // Verify executeCommand was called
      expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
      console.log('  ✅ Command was called');

      // Verify error message was shown
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Test processing error')
      );
      console.log('  ✅ Error message was shown to user');
      
      console.log('  ✨ Test passed!');
    });
  });

  describe('Message Handling', () => {
    it('should catch and log errors in message handler', async () => {
      console.log('\n📝 Test: should catch errors in message handler');
      
      // Resolve webview
      provider.resolveWebviewView(
        mockWebviewView,
        {} as vscode.WebviewViewResolveContext,
        {} as vscode.CancellationToken
      );

      // Mock showOpenDialog to throw error
      const testError = new Error('Dialog error');
      vi.mocked(vscode.window.showOpenDialog).mockRejectedValue(testError);
      console.log('  ⚙️  Mock will throw error:', testError.message);

      // Send upload message
      const messageCallback = mockWebviewView._messageCallback;
      await messageCallback({ type: 'document/upload' });

      // Verify error message was shown
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Dialog error')
      );
      console.log('  ✅ Error was caught and shown to user');
      
      console.log('  ✨ Test passed!');
    });
  });
});
