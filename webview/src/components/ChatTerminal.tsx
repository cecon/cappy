import { Box, Text } from "@mantine/core";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  memo,
  type KeyboardEvent,
} from "react";

import type { ToolCall } from "../lib/types";
import { HitlToolActions, toolCallCommandPreview } from "./ToolConfirmCard";
import styles from "./ChatTerminal.module.css";

interface ChatTerminalProps {
  /** Incrementado em nova sessão de chat — repõe título e estado visual. */
  chatSessionKey?: number;
  /** Texto acumulado: mesmo comando e saída que o agente obtém via Bash/runTerminal (`child_process.exec`). */
  log: string;
  /**
   * Só tools shell (Bash / runTerminal / …): formato HITL integrado ao terminal.
   * Outras tools destrutivas usam `ToolConfirmCard` fora deste painel.
   */
  pendingConfirms?: ToolCall[];
  showIdleSample?: boolean;
  onApprove?: (toolCallId: string) => void;
  onApproveSession?: (toolCallId: string) => void;
  onApprovePersist?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

const SCROLL_PREVIEW_SAMPLE = `# Exemplo (some quando houver saída real do agente)

$ pnpm run build

> @cappy/webview@0.1.0 build
tsc -p tsconfig.json && vite build

vite v5.4.21 building for production...
transforming...
✓ 1018 modules transformed.

$ echo "fim do exemplo — faça scroll para cima"
fim do exemplo — faça scroll para cima
`;

const IDLE_PLACEHOLDER = "# Aguardando saída do agente…\n";

const ENTER_APPROVE_LABEL = "Enter ↵";

/**
 * Normaliza o nome da tool para o sufixo do header (ex.: `Bash` → `BASH`).
 */
function normalizeToolNameForHeader(name: string): string {
  return name
    .trim()
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toUpperCase();
}

/**
 * Monta o título único estilo `TERMINAL-BASH`; com vários pedidos, `TERMINAL-BASH+1`.
 */
function buildTerminalHeaderTitle(pending: ToolCall[], stickySuffix: string | null): string {
  const firstPending = pending[0];
  if (firstPending) {
    const base = normalizeToolNameForHeader(firstPending.name);
    return pending.length > 1 ? `TERMINAL-${base}+${pending.length - 1}` : `TERMINAL-${base}`;
  }
  if (stickySuffix) {
    return `TERMINAL-${stickySuffix}`;
  }
  return "TERMINAL";
}

/**
 * Divide `TERMINAL-BASH` para estilos distintos (evita “piscar” ao mudar só o sufixo).
 */
function splitTerminalHeaderVisual(full: string): { head: string; tail: string | null } {
  const i = full.indexOf("-");
  if (i === -1) {
    return { head: full, tail: null };
  }
  return { head: full.slice(0, i), tail: full.slice(i) };
}

interface TerminalHitlUnifiedProps {
  toolCall: ToolCall;
  showToolPrefix: boolean;
  onApprove: (id: string) => void;
  onApproveSession: (id: string) => void;
  onApprovePersist: (id: string) => void;
  onReject: (id: string) => void;
}

const TerminalHitlUnified = memo(function TerminalHitlUnified({
  toolCall,
  showToolPrefix,
  onApprove,
  onApproveSession,
  onApprovePersist,
  onReject,
}: TerminalHitlUnifiedProps): JSX.Element {
  const preview = toolCallCommandPreview(toolCall);

  return (
    <div className={styles.hitlBlock ?? ""}>
      <div className={styles.unifiedCommand ?? ""}>
        {showToolPrefix ? (
          <span className={styles.toolPrefix ?? ""}>{toolCall.name}</span>
        ) : null}
        <span className={styles.promptSig ?? ""}>$</span>
        <span className={styles.unifiedCmdText ?? ""}>{preview}</span>
      </div>
      <div className={styles.unifiedActions ?? ""}>
        <HitlToolActions
          toolCallId={toolCall.id}
          onApprove={onApprove}
          onApproveSession={onApproveSession}
          onApprovePersist={onApprovePersist}
          onReject={onReject}
          approveButtonLabel={ENTER_APPROVE_LABEL}
          layout="terminal"
        />
      </div>
    </div>
  );
});

/**
 * Painel terminal no fluxo da conversa: histórico + HITL; colapsa ao concluir pedido.
 */
export function ChatTerminal({
  chatSessionKey = 0,
  log,
  pendingConfirms = [],
  showIdleSample = false,
  onApprove,
  onApproveSession,
  onApprovePersist,
  onReject,
}: ChatTerminalProps): JSX.Element {
  const preRef = useRef<HTMLPreElement>(null);
  const [bodyCollapsed, setBodyCollapsed] = useState(false);
  const [stickySuffix, setStickySuffix] = useState<string | null>(null);
  const prevPendingLen = useRef(0);

  const hasHitl =
    pendingConfirms.length > 0 && Boolean(onApprove && onApproveSession && onApprovePersist && onReject);
  const hasLog = log.trim().length > 0;
  const showSample = Boolean(showIdleSample && !hasLog && !hasHitl);

  const displayText = hasLog ? log : showSample ? SCROLL_PREVIEW_SAMPLE : IDLE_PLACEHOLDER;
  const isIdlePlaceholder = !hasLog && !showSample && !hasHitl;

  const hitlStackClassName = [styles.hitlStack, hasLog ? styles.hitlStackAfterLog : styles.hitlStackFill]
    .filter(Boolean)
    .join(" ");

  const headerTitle = buildTerminalHeaderTitle(pendingConfirms, stickySuffix);
  const headerParts = splitTerminalHeaderVisual(headerTitle);

  /** Nova sessão de chat: repõe rótulo e corpo visível (placeholder). */
  useEffect(() => {
    setStickySuffix(null);
    setBodyCollapsed(false);
    prevPendingLen.current = 0;
  }, [chatSessionKey]);

  /** Mantém sufixo `…-BASH` após aprovar (título estável — sem piscar). Novo HITL expande; fim colapsa. */
  useEffect(() => {
    const n = pendingConfirms.length;
    const first = pendingConfirms[0];
    if (first && n > 0) {
      setStickySuffix(normalizeToolNameForHeader(first.name));
    }
    if (n > prevPendingLen.current) {
      setBodyCollapsed(false);
    } else if (prevPendingLen.current > 0 && n === 0) {
      setBodyCollapsed(true);
    }
    prevPendingLen.current = n;
  }, [pendingConfirms]);

  const handleRootKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!hasHitl || event.key !== "Enter" || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("textarea")) {
        return;
      }
      event.preventDefault();
      const first = pendingConfirms[0];
      if (first) {
        onApprove?.(first.id);
      }
    },
    [hasHitl, onApprove, pendingConfirms],
  );

  useLayoutEffect(() => {
    const el = preRef.current;
    if (el && (hasLog || showSample)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [displayText, hasLog, showSample]);

  const toggleBodyCollapsed = useCallback(() => {
    setBodyCollapsed((previous) => !previous);
  }, []);

  const collapseBody = useCallback(() => {
    setBodyCollapsed(true);
  }, []);

  const rootClassNames = [
    styles.root,
    styles.rootInMessageFlow ?? "",
    hasHitl ? styles.rootHitl : "",
    bodyCollapsed ? styles.rootCollapsed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Box
      className={rootClassNames}
      component="section"
      aria-label={`Painel terminal: ${headerTitle}`}
      tabIndex={hasHitl ? 0 : undefined}
      onKeyDown={hasHitl ? handleRootKeyDown : undefined}
      style={hasHitl ? { outline: "none" } : undefined}
    >
      <div className={styles.header ?? ""}>
        <div className={styles.headerLeft ?? ""}>
          <button
            type="button"
            className={styles.headerIconBtn ?? ""}
            onClick={toggleBodyCollapsed}
            aria-expanded={!bodyCollapsed}
            aria-controls="cappy-terminal-body"
            title={bodyCollapsed ? "Expandir terminal" : "Colapsar terminal"}
          >
            <span className={bodyCollapsed ? styles.chevronRight ?? "" : styles.chevronDown ?? ""} aria-hidden>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          <span className={styles.headerTitleMono ?? ""}>
            <Text component="span" size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.6}>
              {headerParts.head}
            </Text>
            {headerParts.tail ? (
              <Text component="span" size="xs" fw={700} c="yellow.4" tt="uppercase" lts={0.5}>
                {headerParts.tail}
              </Text>
            ) : null}
          </span>
        </div>
        <Text component="span" size="xs" c="dimmed" className={styles.headerHint ?? ""}>
          {hasHitl ? "Enter para executar" : "agente"}
        </Text>
        <button
          type="button"
          className={styles.headerIconBtn ?? ""}
          onClick={collapseBody}
          title="Fechar painel"
          aria-label="Fechar painel do terminal"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div id="cappy-terminal-body" className={styles.bodyWrap ?? ""} hidden={bodyCollapsed}>
        {hasLog ? (
          <pre ref={preRef} className={styles.body ?? ""} tabIndex={0}>
            {log}
          </pre>
        ) : null}

        {hasHitl ? (
          <div className={hitlStackClassName} aria-live="polite">
            {pendingConfirms.map((toolCall) => (
              <TerminalHitlUnified
                key={toolCall.id}
                toolCall={toolCall}
                showToolPrefix={pendingConfirms.length > 1}
                onApprove={onApprove!}
                onApproveSession={onApproveSession!}
                onApprovePersist={onApprovePersist!}
                onReject={onReject!}
              />
            ))}
          </div>
        ) : null}

        {!hasLog && !hasHitl ? (
          <pre
            ref={preRef}
            className={[styles.body ?? "", isIdlePlaceholder ? styles.bodyIdle ?? "" : ""].filter(Boolean).join(" ")}
            tabIndex={0}
          >
            {displayText}
          </pre>
        ) : null}
      </div>
    </Box>
  );
}
