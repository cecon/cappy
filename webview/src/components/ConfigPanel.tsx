import {
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { ActiveAgent, CappyConfig } from "../lib/types";
import { cappyPalette } from "../theme";

const bridge = getBridge();
const SAVE_SUCCESS_MS = 2000;
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const FALLBACK_MODEL_OPTIONS = [
  "openai/gpt-oss-120b",
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
      model: "openai/gpt-oss-120b",
      visionModel: "meta-llama/llama-3.2-11b-vision-instruct:free",
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
  const [modelOptions, setModelOptions] = useState<string[]>([...FALLBACK_MODEL_OPTIONS]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const saveFeedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = bridge.onMessage((message: IncomingMessage) => {
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
      unsubscribe();
      if (saveFeedbackTimeoutRef.current) {
        window.clearTimeout(saveFeedbackTimeoutRef.current);
        saveFeedbackTimeoutRef.current = null;
      }
    };
  }, []);

  const canAddServer = useMemo(() => {
    return newServerName.trim().length > 0 && newServerUrl.trim().length > 0;
  }, [newServerName, newServerUrl]);

  const availableModelOptions = useMemo(() => {
    if (modelOptions.includes(config.openrouter.model)) {
      return modelOptions;
    }
    return [config.openrouter.model, ...modelOptions];
  }, [config.openrouter.model, modelOptions]);

  const availableVisionModelOptions = useMemo(() => {
    if (modelOptions.includes(config.openrouter.visionModel)) {
      return modelOptions;
    }
    return [config.openrouter.visionModel, ...modelOptions];
  }, [config.openrouter.visionModel, modelOptions]);

  const modelSelectData = useMemo(
    () => availableModelOptions.map((m) => ({ value: m, label: m })),
    [availableModelOptions],
  );
  const visionSelectData = useMemo(
    () => availableVisionModelOptions.map((m) => ({ value: m, label: m })),
    [availableVisionModelOptions],
  );
  const agentSelectData = useMemo(
    () => AGENT_OPTIONS.map((a) => ({ value: a, label: a })),
    [],
  );

  useEffect(() => {
    let isDisposed = false;
    void loadOpenRouterModels({
      onStart: () => {
        if (!isDisposed) {
          setIsLoadingModels(true);
          setModelLoadError(null);
        }
      },
      onSuccess: (models) => {
        if (!isDisposed) {
          setModelOptions(models);
        }
      },
      onError: () => {
        if (!isDisposed) {
          setModelLoadError("Falha ao carregar modelos da OpenRouter. Usando lista padrão.");
        }
      },
      onFinally: () => {
        if (!isDisposed) {
          setIsLoadingModels(false);
        }
      },
    });
    return () => {
      isDisposed = true;
    };
  }, []);

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
    <Stack gap="md" h="100%" style={{ overflow: "auto" }}>
      <Paper p="md" radius="md" withBorder>
        <Title order={2} size="h4" mb="sm">
          Configurações
        </Title>
        {isLoading ? (
          <Text size="sm" c="dimmed">
            Carregando configuração...
          </Text>
        ) : null}
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Title order={3} size="xs" tt="uppercase" lts={0.5} c="dimmed" mb="sm">
          OpenRouter
        </Title>
        <Stack gap="sm">
          <PasswordInput
            label="API Key"
            id="openrouter-api-key"
            value={config.openrouter.apiKey}
            onChange={(event) =>
              setConfig((previousConfig) => ({
                ...previousConfig,
                openrouter: { ...previousConfig.openrouter, apiKey: event.target.value },
              }))
            }
            disabled={isLoading || isSaving}
            w="100%"
          />

          <Select
            label="Modelo"
            id="openrouter-model"
            data={modelSelectData}
            value={config.openrouter.model}
            onChange={(value) => {
              if (value === null) {
                return;
              }
              setConfig((previousConfig) => ({
                ...previousConfig,
                openrouter: { ...previousConfig.openrouter, model: value },
              }));
            }}
            disabled={isLoading || isSaving}
            searchable
            nothingFoundMessage="Nenhum modelo"
            w="100%"
          />
          {isLoadingModels ? (
            <Text size="xs" c="dimmed">
              Carregando modelos da OpenRouter...
            </Text>
          ) : null}
          {modelLoadError ? (
            <Text size="xs" c="yellow.4">
              {modelLoadError}
            </Text>
          ) : null}

          <Select
            label="Modelo de visão"
            id="openrouter-vision-model"
            data={visionSelectData}
            value={config.openrouter.visionModel}
            onChange={(value) => {
              if (value === null) {
                return;
              }
              setConfig((previousConfig) => ({
                ...previousConfig,
                openrouter: { ...previousConfig.openrouter, visionModel: value },
              }));
            }}
            disabled={isLoading || isSaving}
            searchable
            w="100%"
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Title order={3} size="xs" tt="uppercase" lts={0.5} c="dimmed" mb="sm">
          Agent
        </Title>
        <Stack gap="sm">
          <Select
            label="Agente ativo"
            id="agent-active-agent"
            data={agentSelectData}
            value={config.agent.activeAgent}
            onChange={(value) => {
              const nextAgent = parseActiveAgent(value);
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
            w="100%"
          />

          <Textarea
            label="System prompt"
            id="agent-system-prompt"
            autosize={false}
            minRows={4}
            value={config.agent.systemPrompt}
            onChange={(event) =>
              setConfig((previousConfig) => ({
                ...previousConfig,
                agent: { ...previousConfig.agent, systemPrompt: event.target.value },
              }))
            }
            disabled={isLoading || isSaving}
            w="100%"
          />

          <NumberInput
            label="Max iterations"
            id="agent-max-iterations"
            min={1}
            max={100}
            value={config.agent.maxIterations}
            onChange={(value) =>
              setConfig((previousConfig) => ({
                ...previousConfig,
                agent: {
                  ...previousConfig.agent,
                  maxIterations: clampNumber(value ?? "", 1, 100, previousConfig.agent.maxIterations),
                },
              }))
            }
            disabled={isLoading || isSaving}
            w="100%"
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Title order={3} size="xs" tt="uppercase" lts={0.5} c="dimmed" mb="sm">
          MCP servers
        </Title>
        <Stack gap="sm">
          {config.mcp.servers.length === 0 ? (
            <Text size="sm" c="dimmed">
              Nenhum servidor configurado.
            </Text>
          ) : null}
          <Stack gap="xs">
            {config.mcp.servers.map((server, index) => (
              <Paper key={`${server.name}-${String(index)}`} p="sm" withBorder radius="sm" bg={cappyPalette.bgSurface}>
                <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} truncate>
                      {server.name}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ wordBreak: "break-all" }}>
                      {server.url}
                    </Text>
                  </Stack>
                  <Button
                    type="button"
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => handleRemoveServer(index)}
                    disabled={isLoading || isSaving}
                    flex="none"
                  >
                    Remover
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>

          {isAddingServer ? (
            <Stack gap="xs">
              <TextInput
                placeholder="Nome do servidor"
                value={newServerName}
                onChange={(event) => setNewServerName(event.target.value)}
                disabled={isLoading || isSaving}
              />
              <TextInput
                placeholder="URL do servidor"
                value={newServerUrl}
                onChange={(event) => setNewServerUrl(event.target.value)}
                disabled={isLoading || isSaving}
              />
              <Group gap="xs">
                <Button
                  type="button"
                  size="xs"
                  variant="light"
                  onClick={handleAddServer}
                  disabled={!canAddServer || isLoading || isSaving}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    setIsAddingServer(false);
                    setNewServerName("");
                    setNewServerUrl("");
                  }}
                  disabled={isLoading || isSaving}
                >
                  Cancelar
                </Button>
              </Group>
            </Stack>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="light"
              onClick={() => setIsAddingServer(true)}
              disabled={isLoading || isSaving}
            >
              Adicionar servidor
            </Button>
          )}
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Divider mb="md" color={cappyPalette.borderSubtle} />
        <Group justify="space-between" align="center" gap="md" wrap="wrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            {errorMessage ? (
              <Text size="sm" c="red.4">
                {errorMessage}
              </Text>
            ) : null}
            {showSavedFeedback ? (
              <Text size="sm" c="teal.4">
                Configurações salvas
              </Text>
            ) : null}
          </Stack>
          <Button type="button" onClick={handleSave} disabled={isLoading || isSaving} loading={isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}

/**
 * Parses and clamps one numeric input value.
 */
function clampNumber(rawValue: string | number, min: number, max: number, fallback: number): number {
  if (rawValue === "") {
    return fallback;
  }
  const n = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  const t = Math.trunc(n);
  if (t < min) {
    return min;
  }
  if (t > max) {
    return max;
  }
  return t;
}

/**
 * Parses one string value as ActiveAgent.
 */
function parseActiveAgent(value: string | null): ActiveAgent | null {
  if (value === "coder" || value === "planner" || value === "reviewer") {
    return value;
  }
  return null;
}

interface LoadOpenRouterModelsCallbacks {
  onStart: () => void;
  onSuccess: (models: string[]) => void;
  onError: () => void;
  onFinally: () => void;
}

/**
 * Loads model IDs from OpenRouter public models endpoint.
 */
async function loadOpenRouterModels(callbacks: LoadOpenRouterModelsCallbacks): Promise<void> {
  callbacks.onStart();
  try {
    const response = await fetch(OPENROUTER_MODELS_ENDPOINT);
    if (!response.ok) {
      callbacks.onError();
      return;
    }
    const payload = (await response.json()) as unknown;
    const models = extractModelIds(payload);
    if (models.length === 0) {
      callbacks.onError();
      return;
    }
    callbacks.onSuccess(models);
  } catch {
    callbacks.onError();
  } finally {
    callbacks.onFinally();
  }
}

/**
 * Extracts and sorts model IDs from unknown API payload.
 */
function extractModelIds(payload: unknown): string[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return [];
  }
  const modelIds = payload.data
    .map((model) => {
      if (!isRecord(model) || typeof model.id !== "string") {
        return null;
      }
      return model.id;
    })
    .filter((modelId): modelId is string => Boolean(modelId));
  const uniqueModelIds = Array.from(new Set(modelIds));
  return uniqueModelIds.sort((left, right) => left.localeCompare(right));
}

/**
 * Narrows unknown values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
