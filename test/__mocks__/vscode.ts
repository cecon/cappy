// Minimal mock of VS Code API for tests
export const lm = {
  // Return no models by default; code should handle empty list gracefully
  selectChatModels: async (_opts?: unknown) => [] as Array<{ vendor: string; family: string }>,
};

export class CancellationTokenSource {
  token = {} as unknown;
  cancel() {}
  dispose() {}
}

export const LanguageModelChatMessage = {
  User: (content: string) => ({ role: 'user' as const, content }),
};

export type LanguageModelChat = {
  vendor: string;
  family: string;
  sendRequest: (
    messages: Array<{ role: string; content: string }>,
    _options: unknown,
    _token: unknown
  ) => Promise<{ text: AsyncIterable<string> }>;
};

// Provide a dummy window API if any code references vscode.window in tests
export const window = {
  showInformationMessage: async (_message: string) => undefined as unknown,
  showWarningMessage: async (_message: string, _options?: unknown, _button?: string) => undefined as unknown,
  showErrorMessage: async (_message: string) => undefined as unknown,
};
