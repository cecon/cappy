import {
  Button,
  Code,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  PasswordInput,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { AGENT_PROMPTS } from "../lib/agent-presets";
import { FALLBACK_MODEL_OPTIONS, loadOpenRouterModels } from "../lib/openrouter-models";
import { getBridge, type IncomingMessage } from "../lib/vscode-bridge";
import type { CappyConfig } from "../lib/types";
import { cappyPalette } from "../theme";

const bridge = getBridge();
const SAVE_SUCCESS_MS = 2000;

type TestResult =
  | { status: "success"; model: string; reply: string; latencyMs: number }
  | { status: "error"; model: string; apiKey: string; errorMessage: string; detail: string };

/**
 * Chama a API OpenRouter com "olá" e retorna o resultado do teste.
 */
async function runConnectionTest(apiKey: string, model: string): Promise<TestResult> {
  const start = Date.now();
  const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}` : "****";
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "olá" }],
        max_tokens: 64,
      }),
    });
    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      const errMsg =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof (payload as Record<string, unknown>).error === "object"
          ? JSON.stringify((payload as Record<string, unknown>).error, null, 2)
          : JSON.stringify(payload, null, 2);
      return {
        status: "error",
        model,
        apiKey: maskedKey,
        errorMessage: `HTTP ${String(response.status)} ${response.statusText}`,
        detail: errMsg,
      };
    }
    const choice =
      typeof payload === "object" &&
      payload !== null &&
      "choices" in payload &&
      Array.isArray((payload as Record<string, unknown>).choices)
        ? ((payload as Record<string, unknown>).choices as unknown[])[0]
        : null;
    const reply =
      typeof choice === "object" &&
      choice !== null &&
      "message" in choice &&
      typeof (choice as Record<string, unknown>).message === "object"
        ? ((choice as Record<string, unknown>).message as Record<string, unknown>).content
        : null;
    return {
      status: "success",
      model,
      reply: typeof reply === "string" ? reply : "(sem resposta textual)",
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: "error",
      model,
      apiKey: maskedKey,
      errorMessage: err instanceof Error ? err.message : String(err),
      detail: "",
    };
  }
}

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
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
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
   * Testa a conexão com a OpenRouter enviando "olá".
   */
  async function handleTest(): Promise<void> {
    setIsTesting(true);
    setTestResult(null);
    const result = await runConnectionTest(config.openrouter.apiKey, config.openrouter.model);
    setTestResult(result);
    setIsTesting(false);
  }

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
      <Modal
        opened={testResult !== null}
        onClose={() => setTestResult(null)}
        title={
          testResult?.status === "success" ? (
            <Text fw={600} c="teal.4">Conexão bem-sucedida</Text>
          ) : (
            <Text fw={600} c="red.4">Falha na conexão</Text>
          )
        }
        size="lg"
        centered
        withinPortal
      >
        {testResult?.status === "success" ? (
          <Stack gap="sm">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Modelo:</Text>
              <Text size="sm" fw={500}>{testResult.model}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Latência:</Text>
              <Text size="sm" fw={500}>{testResult.latencyMs}ms</Text>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>Resposta:</Text>
            <Paper p="sm" radius="sm" withBorder bg={cappyPalette.bgSurface}>
              <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {testResult.reply}
              </Text>
            </Paper>
          </Stack>
        ) : testResult?.status === "error" ? (
          <Stack gap="sm">
            <Group gap="xs">
              <Text size="sm" c="dimmed">Modelo:</Text>
              <Text size="sm" fw={500}>{testResult.model}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">API Key:</Text>
              <Text size="sm" fw={500} ff="monospace">{testResult.apiKey}</Text>
            </Group>
            <Text size="sm" c="red.4" fw={500}>{testResult.errorMessage}</Text>
            {testResult.detail.length > 0 ? (
              <>
                <Text size="xs" c="dimmed">Detalhe:</Text>
                <ScrollArea h={160}>
                  <Code block style={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {testResult.detail}
                  </Code>
                </ScrollArea>
              </>
            ) : null}
          </Stack>
        ) : null}
      </Modal>
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

          <Button
            type="button"
            size="xs"
            variant="light"
            color="ideAccent"
            loading={isTesting}
            disabled={isLoading || isSaving || config.openrouter.apiKey.trim().length === 0}
            onClick={() => { void handleTest(); }}
          >
            {isTesting ? "Testando..." : "Testar conexão"}
          </Button>

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
