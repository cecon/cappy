"use strict";
// @copilot: GitHub Copilot Integration for Knowledge Graph
/**
 * QUESTION: How to use GitHub Copilot Chat API in VS Code extension?
 *
 * Requirements:
 * - Use VS Code's built-in Copilot Chat API
 * - Send entity/relationship extraction prompts
 * - Parse structured JSON responses
 * - Handle errors gracefully
 * - Respect rate limits
 */
/**
 * QUESTION: How to generate embeddings locally in VS Code extension?
 *
 * Requirements:
 * - Use @xenova/transformers package
 * - Load all-MiniLM-L6-v2 model locally
 * - Generate 384-dimensional vectors
 * - Batch processing for performance
 * - Model caching and lazy loading
 */
/**
 * QUESTION: How to connect to existing LanceDB instance?
 *
 * Context:
 * - Existing file: src/store/cappyragLanceDb.ts
 * - Class: CappyRAGLanceDatabase
 * - Methods: getEntitiesAsync(), getRelationshipsAsync()
 * - Need to query top entities for context
 */
// Example usage with Copilot Chat:
async function extractWithCopilot() {
    // Use Copilot Chat API to extract entities and relationships
    const prompt = "Extract entities and relationships from this text...";
    const response = await vscode.chat.sendRequest(prompt);
    return JSON.parse(response);
}
//# sourceMappingURL=copilot-questions.js.map