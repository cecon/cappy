import { useEffect, useMemo, useRef, useState } from "react";
import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { ActiveAgent, CappyConfig } from "../lib/types";
import styles from "./ConfigPanel.module.css";

const bridge = getBridge();
const SAVE_SUCCESS_MS = 2000;
const MODEL_OPTIONS = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct",
  "deepseek/deepseek-r1",
] as const;
const AGENT_OPTIONS: ActiveAgent[] = ["coder", "planner", "reviewer"];
const AGENT_PROMPTS: Record<ActiveAgent, string> = {
  coder:
    "You are Cappy, an expert coding assistant. You write clean, well-typed TypeScript and follow best practices.",
  planner:
    "You are Cappy, a technical planning assistant. You break down complex tasks into clear steps, create structured plans, and document decisions.",
  reviewer:
    "You are Cappy, a code review assistant. You identify bugs, suggest improvements, enforce best practices, and explain your reasoning.",
};

/**
 * Returns local default config while host data has not loaded yet.
 */
function getDefaultConfig(): CappyConfig {
  return {
    openrouter: {
      apiKey: "",
      model: "anthropic/claude-sonnet-4-5",
      maxTokens: 4096,
    },
    agent: {
      activeAgent: "coder",
      systemPrompt: AGENT_PROMPTS.coder,
      maxIterations: 20,
    },
    mcp: {
      servers: [],
    },
  };
}

/**
 * Config panel for editing and persisting `.cappy/config.json`.
 */
export function ConfigPanel(): JSX.Element {
  const [config, setConfig] = useState<CappyConfig>(getDefaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const saveFeedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    bridge.onMessage((message: IncomingMessage) => {
      if (message.type === "config:loaded") {
        setConfig(message.config);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      if (message.type === "config:saved") {
        setIsSaving(false);
        setShowSavedFeedback(true);
        if (saveFeedbackTimeoutRef.current) {
          window.clearTimeout(saveFeedbackTimeoutRef.current);
        }
        saveFeedbackTimeoutRef.current = window.setTimeout(() => {
          setShowSavedFeedback(false);
          saveFeedbackTimeoutRef.current = null;
        }, SAVE_SUCCESS_MS);
        return;
      }

      if (message.type === "error") {
        setIsLoading(false);
        setIsSaving(false);
        setErrorMessage(message.message);
      }
    });

    bridge.send({ type: "config:load" });

    return () => {
      if (saveFeedbackTimeoutRef.current) {
        window.clearTimeout(saveFeedbackTimeoutRef.current);
        saveFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  const canAddServer = useMemo(() => {
    return newServerName.trim().length > 0 && newServerUrl.trim().length > 0;
  }, [newServerName, newServerUrl]);

  /**
   * Persists the current in-memory config through bridge.
   */
  function handleSave(): void {
    setErrorMessage(null);
    setIsSaving(true);
    setShowSavedFeedback(false);
    bridge.send({ type: "config:save", config });
  }

  /**
   * Appends one MCP server from inline form fields.
   */
  function handleAddServer(): void {
    if (!canAddServer) {
      return;
    }
    setConfig((previousConfig) => ({
      ...previousConfig,
      mcp: {
        servers: [
          ...previousConfig.mcp.servers,
          {
            name: newServerName.trim(),
            url: newServerUrl.trim(),
          },
        ],
      },
    }));
    setNewServerName("");
    setNewServerUrl("");
    setIsAddingServer(false);
  }

  /**
   * Removes one MCP server by index.
   */
  function handleRemoveServer(index: number): void {
    setConfig((previousConfig) => ({
      ...previousConfig,
      mcp: {
        servers: previousConfig.mcp.servers.filter((_, currentIndex) => currentIndex !== index),
      },
    }));
  }

  return (
    <section className={styles.container}>
      <h2 className={styles.title}>Configurações</h2>
      {isLoading ? <p className={styles.loading}>Carregando configuração...</p> : null}

      <div className={styles.section}>
        <h3>OpenRouter</h3>
        <label className={styles.label} htmlFor="openrouter-api-key">
          API Key
        </label>
        <div className={styles.apiKeyRow}>
          <input
            id="openrouter-api-key"
            className={styles.input}
            type={showApiKey ? "text" : "password"}
            value={config.openrouter.apiKey}
            onChange={(event) =>
              setConfig((previousConfig) => ({
                ...previousConfig,
                openrouter: { ...previousConfig.openrouter, apiKey: event.target.value },
              }))
            }
            disabled={isLoading || isSaving}
          />
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setShowApiKey((value) => !value)}
            disabled={isLoading || isSaving}
          >
            {showApiKey ? "Ocultar" : "Mostrar"}
          </button>
        </div>

        <label className={styles.label} htmlFor="openrouter-model">
          Modelo
        </label>
        <select
          id="openrouter-model"
          className={styles.input}
          value={config.openrouter.model}
          onChange={(event) =>
            setConfig((previousConfig) => ({
              ...previousConfig,
              openrouter: { ...previousConfig.openrouter, model: event.target.value },
            }))
          }
          disabled={isLoading || isSaving}
        >
          {MODEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="openrouter-max-tokens">
          Max Tokens
        </label>
        <input
          id="openrouter-max-tokens"
          className={styles.input}
          type="number"
          min={256}
          max={32768}
          value={config.openrouter.maxTokens}
          onChange={(event) =>
            setConfig((previousConfig) => ({
              ...previousConfig,
              openrouter: {
                ...previousConfig.openrouter,
                maxTokens: clampNumber(event.target.value, 256, 32768, previousConfig.openrouter.maxTokens),
              },
            }))
          }
          disabled={isLoading || isSaving}
        />
      </div>

      <div className={styles.section}>
        <h3>Agent</h3>
        <label className={styles.label} htmlFor="agent-active-agent">
          Agente Ativo
        </label>
        <select
          id="agent-active-agent"
          className={styles.input}
          value={config.agent.activeAgent}
          onChange={(event) => {
            const nextAgent = parseActiveAgent(event.target.value);
            if (!nextAgent) {
              return;
            }
            setConfig((previousConfig) => ({
              ...previousConfig,
              agent: {
                ...previousConfig.agent,
                activeAgent: nextAgent,
                systemPrompt: AGENT_PROMPTS[nextAgent],
              },
            }));
          }}
          disabled={isLoading || isSaving}
        >
          {AGENT_OPTIONS.map((agentOption) => (
            <option key={agentOption} value={agentOption}>
              {agentOption}
            </option>
          ))}
        </select>

        <label className={styles.label} htmlFor="agent-system-prompt">
          System Prompt
        </label>
        <textarea
          id="agent-system-prompt"
          className={styles.textarea}
          rows={4}
          value={config.agent.systemPrompt}
          onChange={(event) =>
            setConfig((previousConfig) => ({
              ...previousConfig,
              agent: { ...previousConfig.agent, systemPrompt: event.target.value },
            }))
          }
          disabled={isLoading || isSaving}
        />

        <label className={styles.label} htmlFor="agent-max-iterations">
          Max Iterations
        </label>
        <input
          id="agent-max-iterations"
          className={styles.input}
          type="number"
          min={1}
          max={100}
          value={config.agent.maxIterations}
          onChange={(event) =>
            setConfig((previousConfig) => ({
              ...previousConfig,
              agent: {
                ...previousConfig.agent,
                maxIterations: clampNumber(event.target.value, 1, 100, previousConfig.agent.maxIterations),
              },
            }))
          }
          disabled={isLoading || isSaving}
        />
      </div>

      <div className={styles.section}>
        <h3>MCP Servers</h3>
        {config.mcp.servers.length === 0 ? <p className={styles.emptyText}>Nenhum servidor configurado.</p> : null}
        <ul className={styles.serverList}>
          {config.mcp.servers.map((server, index) => (
            <li key={`${server.name}-${index}`} className={styles.serverItem}>
              <div className={styles.serverInfo}>
                <strong>{server.name}</strong>
                <span>{server.url}</span>
              </div>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => handleRemoveServer(index)}
                disabled={isLoading || isSaving}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>

        {isAddingServer ? (
          <div className={styles.inlineForm}>
            <input
              className={styles.input}
              placeholder="Nome do servidor"
              value={newServerName}
              onChange={(event) => setNewServerName(event.target.value)}
              disabled={isLoading || isSaving}
            />
            <input
              className={styles.input}
              placeholder="URL do servidor"
              value={newServerUrl}
              onChange={(event) => setNewServerUrl(event.target.value)}
              disabled={isLoading || isSaving}
            />
            <div className={styles.inlineActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleAddServer}
                disabled={!canAddServer || isLoading || isSaving}
              >
                Confirmar
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setIsAddingServer(false);
                  setNewServerName("");
                  setNewServerUrl("");
                }}
                disabled={isLoading || isSaving}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setIsAddingServer(true)}
            disabled={isLoading || isSaving}
          >
            Adicionar servidor
          </button>
        )}
      </div>

      <footer className={styles.footer}>
        {errorMessage ? <span className={styles.error}>{errorMessage}</span> : null}
        {showSavedFeedback ? <span className={styles.saved}>Configurações salvas</span> : null}
        <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isLoading || isSaving}>
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </footer>
    </section>
  );
}

/**
 * Parses and clamps one numeric input value.
 */
function clampNumber(rawValue: string, min: number, max: number, fallback: number): number {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }
  if (parsedValue < min) {
    return min;
  }
  if (parsedValue > max) {
    return max;
  }
  return Math.trunc(parsedValue);
}

/**
 * Parses one string value as ActiveAgent.
 */
function parseActiveAgent(value: string): ActiveAgent | null {
  if (value === "coder" || value === "planner" || value === "reviewer") {
    return value;
  }
  return null;
}
