import * as vscode from 'vscode';
import { LightRAGSearchCommand } from './lightragSearch';

/**
 * Register all LightRAG commands with VS Code
 */
export function registerLightRAGCommands(context: vscode.ExtensionContext): void {
    const lightragCommand = new LightRAGSearchCommand(context);

    // Register all commands
    const commands = [
        // Core LightRAG commands
        vscode.commands.registerCommand('cappy.lightrag.initialize', async () => {
            await lightragCommand.initialize();
        }),

        vscode.commands.registerCommand('cappy.lightrag.search', async () => {
            await lightragCommand.executeSearch();
        }),

        vscode.commands.registerCommand('cappy.lightrag.searchSelection', async () => {
            await lightragCommand.searchInContext();
        }),

        vscode.commands.registerCommand('cappy.lightrag.indexWorkspace', async () => {
            await lightragCommand.indexWorkspace();
        }),

        vscode.commands.registerCommand('cappy.lightrag.status', async () => {
            await lightragCommand.showStatus();
        }),

        // Quick access commands
        vscode.commands.registerCommand('cappy.lightrag.quickSearch', async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Quick semantic search',
                placeHolder: 'Enter search terms...',
                ignoreFocusOut: true
            });
            
            if (query) {
                await lightragCommand.executeSearch(query);
            }
        }),

        vscode.commands.registerCommand('cappy.lightrag.searchHere', async () => {
            await lightragCommand.searchInContext();
        })
    ];

    // Add all commands to subscriptions
    context.subscriptions.push(...commands);

    // Register context menu commands
    registerContextMenuCommands(context, lightragCommand);

    // Register keybindings
    registerKeybindings(context, lightragCommand);

    // Cleanup on deactivation
    context.subscriptions.push({
        dispose: () => lightragCommand.dispose()
    });
}

/**
 * Register context menu commands
 */
function registerContextMenuCommands(context: vscode.ExtensionContext, lightragCommand: LightRAGSearchCommand): void {
    // Search selected text
    const searchSelectedCommand = vscode.commands.registerCommand(
        'cappy.lightrag.searchSelected',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (selectedText.trim()) {
                await lightragCommand.executeSearch(selectedText.trim());
            } else {
                vscode.window.showInformationMessage('No text selected.');
            }
        }
    );

    context.subscriptions.push(searchSelectedCommand);
}

/**
 * Register keyboard shortcuts
 */
function registerKeybindings(context: vscode.ExtensionContext, lightragCommand: LightRAGSearchCommand): void {
    // These are registered via package.json keybindings, but we can add dynamic ones here
    
    // Example: Register a command that can be bound to keys
    const quickSearchCommand = vscode.commands.registerCommand(
        'cappy.lightrag.quickSearchKeyboard',
        async () => {
            // Quick search with current word under cursor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const position = editor.selection.active;
                const wordRange = editor.document.getWordRangeAtPosition(position);
                
                if (wordRange) {
                    const word = editor.document.getText(wordRange);
                    if (word.trim()) {
                        await lightragCommand.executeSearch(word);
                        return;
                    }
                }
            }
            
            // Fallback to input box
            await lightragCommand.executeSearch();
        }
    );

    context.subscriptions.push(quickSearchCommand);
}

/**
 * Configuration for command palette entries and menus
 */
export const LIGHTRAG_COMMANDS_CONFIG = {
    // Command definitions for package.json
    commands: [
        {
            command: 'cappy.lightrag.initialize',
            title: 'Initialize LightRAG',
            category: 'Cappy'
        },
        {
            command: 'cappy.lightrag.search',
            title: 'Search with LightRAG',
            category: 'Cappy'
        },
        {
            command: 'cappy.lightrag.searchSelection',
            title: 'Search Selection with LightRAG',
            category: 'Cappy'
        },
        {
            command: 'cappy.lightrag.indexWorkspace',
            title: 'Index Workspace with LightRAG',
            category: 'Cappy'
        },
        {
            command: 'cappy.lightrag.status',
            title: 'Show LightRAG Status',
            category: 'Cappy'
        },
        {
            command: 'cappy.lightrag.quickSearch',
            title: 'Quick Search',
            category: 'Cappy'
        },
        {
            command: 'cappy.lightrag.searchHere',
            title: 'Search from Here',
            category: 'Cappy'
        }
    ],

    // Keybindings for package.json
    keybindings: [
        {
            command: 'cappy.lightrag.search',
            key: 'ctrl+shift+f',
            mac: 'cmd+shift+f',
            when: 'editorTextFocus'
        },
        {
            command: 'cappy.lightrag.searchSelection',
            key: 'ctrl+shift+s',
            mac: 'cmd+shift+s',
            when: 'editorHasSelection'
        },
        {
            command: 'cappy.lightrag.quickSearch',
            key: 'ctrl+alt+f',
            mac: 'cmd+alt+f'
        }
    ],

    // Context menu entries for package.json
    menus: {
        'editorContext': [
            {
                command: 'cappy.lightrag.searchSelected',
                when: 'editorHasSelection',
                group: 'navigation@1'
            },
            {
                command: 'cappy.lightrag.searchHere',
                when: 'editorTextFocus',
                group: 'navigation@2'
            }
        ],
        'commandPalette': [
            {
                command: 'cappy.lightrag.initialize'
            },
            {
                command: 'cappy.lightrag.search'
            },
            {
                command: 'cappy.lightrag.indexWorkspace'
            },
            {
                command: 'cappy.lightrag.status'
            }
        ]
    }
};