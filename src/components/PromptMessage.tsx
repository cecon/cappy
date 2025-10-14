import { useState } from 'react'
import type { UserPrompt } from '../domains/chat/entities/prompt'

interface PromptMessageProps {
  prompt: UserPrompt
  onResponse: (response: string) => void
}

export const PromptMessage = ({ prompt, onResponse }: PromptMessageProps) => {
  const [inputValue, setInputValue] = useState(prompt.defaultValue || '')
  const [responded, setResponded] = useState(false)
  
  const handleResponse = (response: string) => {
    setResponded(true)
    onResponse(response)
  }
  
  if (responded) {
    return (
      <div className="message-prompt message-prompt--responded">
        <div className="prompt-question">{prompt.question}</div>
        <div className="prompt-response">
          ✅ Respondido
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className="message-prompt"
      role="dialog"
      aria-labelledby="prompt-question"
      aria-live="polite"
    >
      <div className="message-content">
        <div 
          id="prompt-question"
          className="prompt-question"
        >
          ❓ {prompt.question}
        </div>
        
        {prompt.toolCall && (
          <div className="prompt-tool-details">
            <code>
              🔧 <strong>{prompt.toolCall.name}</strong>
              <pre>{JSON.stringify(prompt.toolCall.input, null, 2)}</pre>
            </code>
          </div>
        )}
        
        {prompt.promptType === 'confirm' && (
          <div className="prompt-actions">
            <button 
              className="prompt-button prompt-button--primary"
              onClick={() => handleResponse('yes')}
            >
              ✅ Sim
            </button>
            <button 
              className="prompt-button prompt-button--secondary"
              onClick={() => handleResponse('no')}
            >
              ❌ Não
            </button>
          </div>
        )}
        
        {prompt.promptType === 'input' && (
          <div className="prompt-input">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Digite sua resposta..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  handleResponse(inputValue)
                }
              }}
            />
            <button 
              className="prompt-button prompt-button--primary"
              onClick={() => handleResponse(inputValue)}
              disabled={!inputValue.trim()}
            >
              Enviar
            </button>
          </div>
        )}
        
        {prompt.promptType === 'select' && prompt.options && (
          <div className="prompt-select">
            {prompt.options.map((option) => (
              <button 
                key={option}
                className="prompt-option"
                onClick={() => handleResponse(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
