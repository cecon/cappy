/**
 * Text Prompt Input Component
 * Componente visual para responder perguntas de clarificação
 */

import { useState } from "react";
import { SendHorizontalIcon } from "lucide-react";
import type { PendingTextPrompt, TextPromptActions } from './types.ts';

interface TextPromptInputProps {
  readonly pendingPrompt: PendingTextPrompt;
  readonly actions: TextPromptActions;
}

export function TextPromptInput({ 
  pendingPrompt, 
  actions 
}: TextPromptInputProps) {
  const [response, setResponse] = useState("");

  const handleSubmit = (value: string) => {
    if (value.trim()) {
      actions.respondToPrompt(pendingPrompt.messageId, value.trim());
      setResponse("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(response);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSubmit(suggestion);
  };

  return (
    <div className="my-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
      <div className="mb-2">
        <div className="font-medium text-sm mb-1">
          💭 {pendingPrompt.question}
        </div>
      </div>
      
      {pendingPrompt.suggestions && pendingPrompt.suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {pendingPrompt.suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      
      <div className="flex gap-2">
        <input
          type="text"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua resposta..."
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
        <button
          onClick={() => handleSubmit(response)}
          disabled={!response.trim()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendHorizontalIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
