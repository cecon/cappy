import { FormEvent, KeyboardEvent, useCallback, useMemo, useRef, useState } from "react";
import type { ChatUiMode, ContextUsageSnapshot, ImageAttachment } from "../lib/types";
import styles from "./InputBar.module.css";

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
}: InputBarProps): JSX.Element {
  const [value, setValue] = useState("");
  const [chatMode, setChatMode] = useState<ChatUiMode>("agent");
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
    return { previewUsed, limitTokens, effectiveBudget: contextUsage?.effectiveInputBudgetTokens ?? null, didTrim: contextUsage?.didTrimForApi ?? false };
  }, [contextFiles.length, contextUsage, isStreaming, value.length]);
  const contextRatio = contextMetrics.previewUsed / contextMetrics.limitTokens;

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

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {contextFiles.length > 0 ? (
        <div className={styles.contextChips}>
          {contextFiles.map((file) => (
            <div key={file.path} className={styles.contextChip}>
              <span className={styles.contextFileIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M7 3.8h6l4 4V20.2H7z" />
                  <path d="M13 3.8v4h4" />
                </svg>
              </span>
              <span className={styles.contextFileName}>{file.name}</span>
              <button
                type="button"
                className={styles.contextRemove}
                onClick={() => onRemoveContextFile(file.path)}
                aria-label={`Remover ${file.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.inputBox}>
        {images.length > 0 && (
          <div className={styles.imagePreviewRow}>
            {images.map((img, i) => (
              <div key={i} className={styles.imagePreview}>
                <img src={img.dataUrl} alt={`Anexo ${i + 1}`} className={styles.imageThumb} />
                <button
                  type="button"
                  className={styles.imageRemove}
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remover imagem ${i + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          onPaste={handlePaste}
          placeholder={
            chatMode === "plain"
              ? "Mensagem em texto puro (sem tools)"
              : chatMode === "ask"
                ? "Pergunta: leitura e pesquisa no código e na web"
                : "/ para comandos, @ para contexto — agente com ferramentas"
          }
          className={styles.textarea}
          rows={3}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className={styles.hiddenFileInput}
        />

        {showSlashMenu ? (
          <div className={styles.menu} role="listbox" aria-label="Comandos slash">
            {COMMAND_ITEMS.map((command, index) => (
              <button
                key={command.value}
                type="button"
                className={`${styles.menuItem} ${index === activeCommandIndex ? styles.menuItemActive : ""}`}
                onMouseEnter={() => setActiveCommandIndex(index)}
                onClick={() => handleSelectCommand(command.value)}
              >
                <span className={styles.menuCommand}>{command.value}</span>
                <span className={styles.menuDescription}>{command.description}</span>
              </button>
            ))}
          </div>
        ) : null}

        {showAtMenu ? (
          <div className={styles.menu} role="listbox" aria-label="Arquivos do workspace">
            {availableContextFiles.map((file) => (
              <button key={file.path} type="button" className={styles.menuItem} onClick={() => handleSelectContextFile(file)}>
                <span className={styles.menuCommand}>@{file.name}</span>
                <span className={styles.menuDescription}>{file.path}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.modeSwitch} role="tablist" aria-label="Modo do chat">
              {MODE_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={chatMode === item.id}
                  title={item.hint}
                  className={`${styles.modeSegment} ${chatMode === item.id ? styles.modeSegmentActive : ""}`}
                  onClick={() => setChatMode(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.toolbarRight}>
            <div className={styles.contextRingArea}>
              <button
                type="button"
                className={styles.contextRingButton}
                aria-label="Contexto"
                onClick={() => setShowContextTooltip((current) => !current)}
              >
                <ContextRing ratio={contextRatio} />
              </button>
              {showContextTooltip ? (
                <div className={styles.contextTooltip}>
                  <strong className={styles.contextTitle}>Contexto</strong>
                  <span className={styles.contextNumbers}>
                    ~{Math.round(contextMetrics.previewUsed).toLocaleString("pt-BR")} /{" "}
                    {contextMetrics.limitTokens.toLocaleString("pt-BR")} tokens
                  </span>
                  {contextMetrics.effectiveBudget !== null ? (
                    <span className={styles.contextBudgetHint}>
                      Orçamento útil (~entrada): {Math.round(contextMetrics.effectiveBudget).toLocaleString("pt-BR")}
                    </span>
                  ) : null}
                  {contextMetrics.didTrim ? (
                    <span className={styles.contextTrimHint}>Histórico foi compactado para caber no modelo.</span>
                  ) : null}
                  <progress
                    className={styles.contextProgress}
                    value={Math.min(contextMetrics.previewUsed, contextMetrics.limitTokens)}
                    max={contextMetrics.limitTokens}
                  />
                </div>
              ) : null}
            </div>

            <button type="button" className={styles.ghostButton} aria-label="Anexar imagem" onClick={() => fileInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 12.5V8.3a4 4 0 1 1 8 0v7.5a5.5 5.5 0 0 1-11 0V9.8" />
              </svg>
            </button>

            <button
              type="button"
              className={`${styles.actionButton} ${
                isStreaming ? styles.actionButtonStop : isSendState ? styles.actionButtonSend : styles.actionButtonIdle
              }`}
              onClick={handleActionButton}
              aria-label={isStreaming ? "Parar resposta" : "Enviar mensagem"}
            >
              {isStreaming ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 18V6" />
                  <path d="M7 11l5-5l5 5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * Finds the token being typed after the last @.
 */
function getAtToken(inputValue: string): string {
  const lastAtIndex = inputValue.lastIndexOf("@");
  if (lastAtIndex < 0) {
    return "";
  }
  const token = inputValue.slice(lastAtIndex + 1);
  if (token.includes(" ")) {
    return "";
  }
  return token.trim();
}

interface ContextRingProps {
  ratio: number;
}

/**
 * Renders the context usage ring with color thresholds.
 */
function ContextRing({ ratio }: ContextRingProps): JSX.Element {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const normalizedRadius = 7.6;
  const circumference = 2 * Math.PI * normalizedRadius;
  const strokeOffset = circumference - circumference * clampedRatio;
  const ringClassName =
    clampedRatio < 0.6 ? styles.contextRingFillLow : clampedRatio < 0.85 ? styles.contextRingFillMedium : styles.contextRingFillHigh;

  return (
    <svg viewBox="0 0 24 24" className={styles.contextRing} aria-hidden="true">
      <circle className={styles.contextRingTrack} cx="12" cy="12" r={normalizedRadius} />
      <circle
        className={`${styles.contextRingFill} ${ringClassName}`}
        cx="12"
        cy="12"
        r={normalizedRadius}
        strokeDasharray={circumference}
        strokeDashoffset={strokeOffset}
      />
    </svg>
  );
}
