export interface LLMProvider {
  generate(prompt: string, options?: Record<string, unknown>): Promise<string>;
}
