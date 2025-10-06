import * as vscode from 'vscode';

/**
 * LLM Service for CappyRAG
 * Handles GitHub Copilot Chat integration for entity/relationship extraction
 */
export class LLMService {
    
    /**
     * Call GitHub Copilot LLM with enhanced prompt
     */
    async callLLM(prompt: string): Promise<string> {
        try {
            // Use VS Code's Language Model API (Copilot)
            const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
            
            if (!model) {
                console.warn('[CappyRAG] No Copilot model available, trying fallback');
                // Try without specific family
                const [fallbackModel] = await vscode.lm.selectChatModels({ vendor: 'copilot' });
                if (!fallbackModel) {
                    throw new Error('No Copilot model available');
                }
            }

            const selectedModel = model || (await vscode.lm.selectChatModels({ vendor: 'copilot' }))[0];

            // Add instruction for JSON format
            const enhancedPrompt = `${prompt}

IMPORTANT: You must respond with valid JSON only. No additional text, explanations, or markdown formatting. Just the JSON object as specified in the prompt.`;

            // Create messages for the chat
            const messages = [
                vscode.LanguageModelChatMessage.User(enhancedPrompt)
            ];

            // Send request to Copilot
            const chatResponse = await selectedModel.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
            
            // Collect the full response
            let fullResponse = '';
            for await (const fragment of chatResponse.text) {
                fullResponse += fragment;
            }

            console.log(`[CappyRAG] LLM Response received: ${fullResponse.length} characters`);
            
            // Clean up the response to extract JSON
            const cleanedResponse = this.extractJSONFromResponse(fullResponse);
            
            // Validate JSON format
            try {
                JSON.parse(cleanedResponse);
                return cleanedResponse;
            } catch (parseError) {
                console.warn('[CappyRAG] Invalid JSON response from LLM, attempting to fix...');
                const fixedResponse = this.attemptJSONFix(cleanedResponse);
                JSON.parse(fixedResponse); // Validate
                return fixedResponse;
            }

        } catch (err) {
            console.error('[CappyRAG] LLM Error:', err);
            
            // Handle specific Language Model errors
            if (err instanceof vscode.LanguageModelError) {
                console.log(`LLM Error: ${err.message}, Code: ${err.code}`);
                
                // Check for specific error types
                if (err.message.includes('off_topic')) {
                    throw new Error('Request was considered off-topic by Copilot');
                }
                
                if (err.message.includes('permission') || err.message.includes('subscription')) {
                    throw new Error('No permissions to use Copilot. Please check your Copilot subscription.');
                }
                
                if (err.message.includes('blocked') || err.message.includes('filter')) {
                    throw new Error('Request was blocked by Copilot content filter');
                }
                
                if (err.message.includes('not found') || err.message.includes('unavailable')) {
                    throw new Error('Copilot model not found. Please ensure Copilot is enabled.');
                }
                
                throw new Error(`Copilot error: ${err.message}`);
            }
            
            // Fallback: Return empty JSON structure if LLM fails
            console.warn('[CappyRAG] Falling back to empty response due to LLM failure');
            return JSON.stringify({ entities: [], relationships: [] });
        }
    }

    /**
     * Extract JSON from LLM response that might contain markdown or extra text
     */
    private extractJSONFromResponse(response: string): string {
        // Remove markdown code blocks
        let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Try to find JSON object boundaries
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
        }
        
        return cleaned.trim();
    }

    /**
     * Attempt to fix common JSON formatting issues
     */
    private attemptJSONFix(jsonString: string): string {
        let fixed = jsonString;
        
        // Fix trailing commas
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        
        // Fix unquoted keys
        fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        // If still invalid, return empty structure
        try {
            JSON.parse(fixed);
            return fixed;
        } catch {
            console.warn('[CappyRAG] Could not fix JSON, returning empty structure');
            return JSON.stringify({ entities: [], relationships: [] });
        }
    }
}