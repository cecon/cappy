import {
  ActionIcon,
  Box,
  Button,
  CloseButton,
  Group,
  Paper,
  Popover,
  Progress,
  Select,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { FormEvent, KeyboardEvent, useCallback, useMemo, useRef, useState } from "react";

import type { ChatUiMode, ContextUsageSnapshot, ImageAttachment, PipelineTemplate } from "../lib/types";
import { cappyPalette } from "../theme";
import { ContextRing } from "./ContextRing";
import { PipelineToggle, type PipelineState } from "./PipelineToggle";

export interface ContextFile {
  path: string;
  name: string;
}

interface InputBarProps {
  onSend: (text: string, mode: ChatUiMode, images?: ImageAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  contextFiles: ContextFile[];
  onAddContextFile: (file: ContextFile) => void;
  onRemoveContextFile: (path: string) => void;
  /** Estimativa do host; quando ausente, usa limite por defeito. */
  contextUsage: ContextUsageSnapshot | null;
  /** Modelo OpenRouter actual (`openrouter.model` em `~/.cappy/config.json`). */
  selectedModel: string;
  /** IDs disponíveis no select (API + fallback + modelo actual se ausente da lista). */
  modelOptions: string[];
  /** Chamado ao escolher outro modelo; o pai grava a config. */
  onModelChange: (modelId: string) => void;
  /** Enquanto a config inicial não chegou do host. */
  configReady?: boolean;
  /** Pipeline templates disponíveis para modo pipeline. */
  pipelineTemplates?: PipelineTemplate[];
  /** Chamado ao enviar em modo pipeline. */
  onPipelineSend?: (pipelineId: string, text: string) => void;
}

const MODE_ITEMS: { id: ChatUiMode; label: string; hint: string }[] = [
  { id: "plain", label: "Plain", hint: "Só texto, sem ferramentas" },
  { id: "agent", label: "Agent", hint: "Ferramentas completas + MCP" },
  { id: "ask", label: "Ask", hint: "Leitura e pesquisa, sem escrita no repo" },
];

interface CommandItem {
  value: string;
  description: string;
}

const DEFAULT_CONTEXT_LIMIT_TOKENS = 128_000;
const MOCK_WORKSPACE_FILES: ContextFile[] = [
  { path: "webview/src/components/Chat.tsx", name: "Chat.tsx" },
  { path: "webview/src/components/InputBar.tsx", name: "InputBar.tsx" },
  { path: "webview/src/lib/vscode-bridge.ts", name: "vscode-bridge.ts" },
  { path: "README.md", name: "README.md" },
];
const COMMAND_ITEMS: CommandItem[] = [
  { value: "/plan", description: "Estruturar passos para executar uma tarefa." },
  { value: "/review", description: "Revisar código com foco em riscos e regressões." },
  { value: "/explain", description: "Explicar código e decisões técnicas." },
  { value: "/fix", description: "Corrigir erro ou comportamento inesperado." },
];

/**
 * Input and submit controls for chat.
 */
export function InputBar({
  onSend,
  onStop,
  isStreaming,
  contextFiles,
  onAddContextFile,
  onRemoveContextFile,
  contextUsage,
  selectedModel,
  modelOptions,
  onModelChange,
  configReady = true,
  pipelineTemplates,
  onPipelineSend,
}: InputBarProps): JSX.Element {
  const [value, setValue] = useState("");
  const [chatMode, setChatMode] = useState<ChatUiMode>("agent");
  const [pipelineState, setPipelineState] = useState<PipelineState>({ enabled: false, templateId: null });
  const [showContextTooltip, setShowContextTooltip] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedValue = value.trim();
  const isSendState = trimmedValue.length > 0 || images.length > 0;
  const showSlashMenu = value.startsWith("/");
  const atToken = getAtToken(value);
  const showAtMenu = value.includes("@");

  const contextMetrics = useMemo(() => {
    const limitTokens = contextUsage?.limitTokens ?? DEFAULT_CONTEXT_LIMIT_TOKENS;
    const baseUsed = contextUsage?.usedTokens ?? 0;
    const draftTokens = isStreaming ? 0 : Math.ceil(value.length / 4);
    const attachmentTokens = contextFiles.length * 4500;
    const previewUsed = Math.min(limitTokens * 1.5, baseUsed + draftTokens + attachmentTokens);
    return {
      previewUsed,
      limitTokens,
      effectiveBudget: contextUsage?.effectiveInputBudgetTokens ?? null,
      didTrim: contextUsage?.didTrimForApi ?? false,
    };
  }, [contextFiles.length, contextUsage, isStreaming, value.length]);
  const contextRatio = contextMetrics.previewUsed / contextMetrics.limitTokens;
  const progressPct = Math.min(100, Math.max(0, contextRatio * 100));

  /**
   * Handles submit from input form.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    submitCurrentValue();
  }

  /**
   * Handles one slash command selection.
   */
  function handleSelectCommand(command: string): void {
    setValue(`${command} `);
  }

  /**
   * Adds one context file selected from the @ menu.
   */
  function handleSelectContextFile(file: ContextFile): void {
    onAddContextFile(file);
    const lastAt = value.lastIndexOf("@");
    if (lastAt < 0) {
      return;
    }
    setValue(`${value.slice(0, lastAt).trimEnd()} `);
  }

  /**
   * Executes the action button according to current state.
   */
  function handleActionButton(): void {
    if (isStreaming) {
      onStop();
      return;
    }
    if (!isSendState) {
      return;
    }
    submitCurrentValue();
  }

  /**
   * Sends the current input value when valid.
   */
  function submitCurrentValue(): void {
    const text = value.trim();
    if ((!text && images.length === 0) || isStreaming) {
      return;
    }
    if (pipelineState.enabled && pipelineState.templateId && onPipelineSend && text) {
      onPipelineSend(pipelineState.templateId, text);
      setValue("");
      setImages([]);
      return;
    }
    onSend(text || "(imagem)", chatMode, images.length > 0 ? images : undefined);
    setValue("");
    setImages([]);
  }

  /**
   * Reads a File as a base64 data URL and adds it as an image attachment.
   */
  function addImageFile(file: File): void {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImages((prev) => [...prev, { dataUrl, mimeType: file.type }]);
    };
    reader.readAsDataURL(file);
  }

  /**
   * Handles file input change for image upload.
   */
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const files = event.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      addImageFile(files[i]!);
    }
    event.target.value = "";
  }

  /**
   * Handles paste events to capture images from clipboard.
   */
  const handlePaste = useCallback((event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) addImageFile(file);
      }
    }
  }, []);

  /**
   * Handles Enter and Shift+Enter behavior in textarea.
   */
  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    submitCurrentValue();
  }

  const availableContextFiles = MOCK_WORKSPACE_FILES.filter((file) => {
    if (atToken.length === 0) {
      return true;
    }
    return file.path.toLowerCase().includes(atToken.toLowerCase());
  });

  const modeSelectData = useMemo(
    () => MODE_ITEMS.map((item) => ({ label: item.label, value: item.id })),
    [],
  );

  const modelSelectData = useMemo(
    () => modelOptions.map((id) => ({ value: id, label: id })),
    [modelOptions],
  );

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%", minWidth: 0, maxWidth: "100%" }}>
      <Stack gap="xs">
        {contextFiles.length > 0 ? (
          <Group gap={6} wrap="wrap">
            {contextFiles.map((file) => (
              <Group
                key={file.path}
                gap={6}
                wrap="nowrap"
                px={8}
                py={4}
                style={{
                  borderRadius: 5,
                  border: `1px solid ${cappyPalette.borderSurface}`,
                  background: cappyPalette.bgSurface,
                }}
              >
                <Text size="xs" c="dimmed" truncate maw={200}>
                  {file.name}
                </Text>
                <CloseButton size="xs" aria-label={`Remover ${file.name}`} onClick={() => onRemoveContextFile(file.path)} />
              </Group>
            ))}
          </Group>
        ) : null}

        <Paper
          withBorder
          radius="md"
          p={0}
          pos="relative"
          style={{
            overflowX: "hidden",
            overflowY: "visible",
            minWidth: 0,
            maxWidth: "100%",
            backgroundColor: cappyPalette.bgSurface,
            borderColor: cappyPalette.borderSurface,
          }}
        >
          {images.length > 0 ? (
            <Group gap={6} p="xs" pb={0} wrap="wrap">
              {images.map((img, i) => (
                <Box
                  key={i}
                  pos="relative"
                  w={56}
                  h={56}
                  style={{ borderRadius: 6, overflow: "hidden", border: `1px solid ${cappyPalette.borderSurface}` }}
                >
                  <img src={img.dataUrl} alt={`Anexo ${String(i + 1)}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <ActionIcon
                    pos="absolute"
                    top={2}
                    right={2}
                    size="xs"
                    radius="xl"
                    variant="filled"
                    color="dark"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remover imagem ${String(i + 1)}`}
                  >
                    ×
                  </ActionIcon>
                </Box>
              ))}
            </Group>
          ) : null}

          <Textarea
            variant="unstyled"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            onPaste={handlePaste}
            placeholder={
              pipelineState.enabled
                ? `Pipeline ${pipelineTemplates?.find((t) => t.id === pipelineState.templateId)?.name ?? ""} — descreva a tarefa…`
                : chatMode === "plain"
                  ? "Mensagem em texto puro (sem tools)"
                  : chatMode === "ask"
                    ? "Pergunta: leitura e pesquisa no código e na web"
                    : "/ para comandos, @ para contexto — agente com ferramentas"
            }
            minRows={3}
            autosize
            maxRows={12}
            disabled={false}
            styles={{
              input: {
                padding: "10px 12px 8px",
                fontSize: 13,
                lineHeight: 1.4,
                color: cappyPalette.textPrimary,
              },
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />

          {showSlashMenu ? (
            <Paper
              pos="absolute"
              left={8}
              right={8}
              bottom="calc(100% + 8px)"
              shadow="md"
              p={4}
              radius="md"
              withBorder
              style={{ zIndex: 5, maxHeight: 220, overflow: "auto" }}
              role="listbox"
              aria-label="Comandos slash"
            >
              <Stack gap={3}>
                {COMMAND_ITEMS.map((command, index) => (
                  <Button
                    key={command.value}
                    type="button"
                    variant={index === activeCommandIndex ? "light" : "subtle"}
                    color="ideAccent"
                    size="compact-xs"
                    justify="flex-start"
                    h="auto"
                    py={6}
                    styles={{ inner: { flexDirection: "column", alignItems: "flex-start", gap: 2 } }}
                    onMouseEnter={() => setActiveCommandIndex(index)}
                    onClick={() => handleSelectCommand(command.value)}
                  >
                    <Text size="xs" fw={500}>
                      {command.value}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {command.description}
                    </Text>
                  </Button>
                ))}
              </Stack>
            </Paper>
          ) : null}

          {showAtMenu ? (
            <Paper
              pos="absolute"
              left={8}
              right={8}
              bottom="calc(100% + 8px)"
              shadow="md"
              p={4}
              radius="md"
              withBorder
              style={{ zIndex: 5, maxHeight: 220, overflow: "auto" }}
              role="listbox"
              aria-label="Arquivos do workspace"
            >
              <Stack gap={3}>
                {availableContextFiles.map((file) => (
                  <Button
                    key={file.path}
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="compact-xs"
                    justify="flex-start"
                    h="auto"
                    py={6}
                    styles={{ inner: { flexDirection: "column", alignItems: "flex-start", gap: 2 } }}
                    onClick={() => handleSelectContextFile(file)}
                  >
                    <Text size="xs" fw={500}>
                      @{file.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {file.path}
                    </Text>
                  </Button>
                ))}
              </Stack>
            </Paper>
          ) : null}

          <Group
            align="center"
            gap={6}
            wrap="nowrap"
            p={6}
            style={{
              borderTop: `1px solid ${cappyPalette.borderSubtle}`,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {!pipelineState.enabled ? (
              <Select
                size="xs"
                w={92}
                style={{ flexShrink: 0 }}
                data={modeSelectData}
                value={chatMode}
                onChange={(value) => {
                  if (value === "plain" || value === "agent" || value === "ask") {
                    setChatMode(value);
                  }
                }}
                disabled={isStreaming}
                aria-label="Modo do chat"
                comboboxProps={{ withinPortal: true }}
              />
            ) : null}

            {pipelineTemplates && pipelineTemplates.length > 0 && onPipelineSend ? (
              <PipelineToggle templates={pipelineTemplates} isStreaming={isStreaming} onChange={setPipelineState} />
            ) : null}

            <Select
              size="xs"
              style={{ flex: "1 1 0", minWidth: 0 }}
              styles={{
                input: {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
              data={modelSelectData}
              value={selectedModel}
              onChange={(value) => {
                if (value !== null && value.length > 0) {
                  onModelChange(value);
                }
              }}
              disabled={!configReady || isStreaming}
              searchable
              nothingFoundMessage="Nenhum modelo"
              aria-label="Modelo OpenRouter"
              comboboxProps={{ withinPortal: true }}
            />

            <Group gap={5} wrap="nowrap" style={{ flexShrink: 0 }}>
              <Popover
                width={260}
                position="top-end"
                shadow="md"
                withArrow
                opened={showContextTooltip}
                onChange={setShowContextTooltip}
              >
                <Popover.Target>
                  <ActionIcon
                    variant="subtle"
                    color="ideAccent"
                    size="sm"
                    aria-label="Contexto"
                    onClick={() => setShowContextTooltip((current) => !current)}
                  >
                    <ContextRing ratio={contextRatio} />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs">
                    <Text size="xs" fw={600}>
                      Contexto
                    </Text>
                    <Text size="xs" c="dimmed">
                      ~{Math.round(contextMetrics.previewUsed).toLocaleString("pt-BR")} /{" "}
                      {contextMetrics.limitTokens.toLocaleString("pt-BR")} tokens
                    </Text>
                    {contextMetrics.effectiveBudget !== null ? (
                      <Text size="xs" c="dimmed">
                        Orçamento útil (~entrada): {Math.round(contextMetrics.effectiveBudget).toLocaleString("pt-BR")}
                      </Text>
                    ) : null}
                    {contextMetrics.didTrim ? (
                      <Text size="xs" c="yellow.4">
                        Histórico foi compactado para caber no modelo.
                      </Text>
                    ) : null}
                    <Progress value={progressPct} color={contextRatio < 0.6 ? "ideAccent" : contextRatio < 0.85 ? "yellow" : "red"} />
                  </Stack>
                </Popover.Dropdown>
              </Popover>

              <ActionIcon
                variant="subtle"
                color="ideAccent"
                size="md"
                aria-label="Anexar imagem"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" width={15} height={15}>
                  <path
                    d="M8 12.5V8.3a4 4 0 1 1 8 0v7.5a5.5 5.5 0 0 1-11 0V9.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />
                </svg>
              </ActionIcon>

              {isStreaming ? (
                <ActionIcon
                  type="button"
                  size="md"
                  variant="filled"
                  color="red"
                  aria-label="Parar resposta"
                  onClick={handleActionButton}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" width={14} height={14}>
                    <rect x="5" y="5" width="14" height="14" rx="2.5" fill="currentColor" />
                  </svg>
                </ActionIcon>
              ) : (
                <ActionIcon
                  type="button"
                  size="md"
                  variant={isSendState ? "filled" : "light"}
                  color="ideAccent"
                  disabled={!isSendState}
                  aria-label="Enviar mensagem"
                  onClick={handleActionButton}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" width={14} height={14}>
                    <path d="M12 18V6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                    <path d="M7 11l5-5l5 5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </ActionIcon>
              )}
            </Group>
          </Group>
        </Paper>
      </Stack>
    </form>
  );
}

function getAtToken(inputValue: string): string {
  const lastAtIndex = inputValue.lastIndexOf("@");
  if (lastAtIndex < 0) return "";
  const token = inputValue.slice(lastAtIndex + 1);
  return token.includes(" ") ? "" : token.trim();
}
