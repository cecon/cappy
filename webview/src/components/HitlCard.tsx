import { Anchor, Badge, Box, Button, Code, Group, Paper, Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import React from "react";

import type { ToolCall } from "../lib/types";
import {
  classifyHitl,
  RISK_COLOR,
  type HITLRisk,
  type HITLStatus,
} from "../lib/hitlClassify";
import { toolCallCommandPreview } from "./ToolConfirmCard";

// ─────────────────────────────────────────────
// Base: HitlRiskBadge
// ─────────────────────────────────────────────

interface HitlRiskBadgeProps {
  risk: HITLRisk;
}

export function HitlRiskBadge({ risk }: HitlRiskBadgeProps) {
  return (
    <Badge size="xs" variant="light" color={RISK_COLOR[risk]} radius="sm">
      {risk}
    </Badge>
  );
}

// ─────────────────────────────────────────────
// Base: HitlHeader
// ─────────────────────────────────────────────

interface HitlHeaderProps {
  title: string;
  risk: HITLRisk;
  denyLabel?: string;
  onDeny?: (() => void) | undefined;
  status: HITLStatus;
}

export function HitlHeader({
  title,
  risk,
  denyLabel = "negar",
  onDeny,
  status,
}: HitlHeaderProps) {
  return (
    <Group
      justify="space-between"
      px="sm"
      py={5}
      style={{
        background: "var(--mantine-color-dark-7)",
        borderBottom: "1px solid var(--mantine-color-dark-5)",
      }}
    >
      <Group gap="xs">
        <Text size="xs" c="dark.3" ff="monospace">{title}</Text>
        <HitlRiskBadge risk={risk} />
      </Group>
      {status === "pending" && (
        <Anchor size="xs" c="dark.3" underline="never" onClick={onDeny} style={{ cursor: "pointer" }}>
          {denyLabel}
        </Anchor>
      )}
    </Group>
  );
}

// ─────────────────────────────────────────────
// Base: HitlActions
// ─────────────────────────────────────────────

interface HitlActionsProps {
  status: HITLStatus;
  allowLabel?: string;
  onAllow?: (() => void) | undefined;
}

export function HitlActions({ status, allowLabel = "Permitir", onAllow }: HitlActionsProps) {
  return (
    <Group
      px="xs"
      py={5}
      justify="flex-end"
      style={{ borderTop: "1px solid var(--mantine-color-dark-5)" }}
    >
      {status === "pending" ? (
        <Button
          size="compact-xs"
          variant="light"
          color="green"
          leftSection={<IconCheck size={10} />}
          onClick={onAllow}
        >
          {allowLabel}
        </Button>
      ) : (
        <Badge
          size="xs"
          variant="light"
          color={status === "allowed" ? "green" : "red"}
        >
          {status === "allowed" ? "Permitido" : "Negado"}
        </Badge>
      )}
    </Group>
  );
}

// ─────────────────────────────────────────────
// Base: HitlCardShell
// ─────────────────────────────────────────────

interface HitlCardShellProps {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function HitlCardShell({ header, footer, children }: HitlCardShellProps) {
  return (
    <Paper
      withBorder
      radius="sm"
      style={{
        background: "var(--mantine-color-dark-8)",
        borderColor: "var(--mantine-color-dark-5)",
        overflow: "hidden",
        maxWidth: 560,
      }}
    >
      {header}
      <Box px="sm" pt="xs" pb={6}>
        {children}
      </Box>
      {footer}
    </Paper>
  );
}

// ─────────────────────────────────────────────
// Shared helper: KVRow
// ─────────────────────────────────────────────

function KVRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: ("warn" | "danger") | undefined }) {
  const color = tone === "danger" ? "red.4" : tone === "warn" ? "yellow.4" : "dark.1";
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dark.3" style={{ whiteSpace: "nowrap" }}>{label}</Text>
      <Text size="xs" c={color} ff="monospace" style={{ textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </Text>
    </Group>
  );
}

// ─────────────────────────────────────────────
// Shared helper: MetaBadges
// ─────────────────────────────────────────────

function MetaBadges({ items }: { items: { label: string; color: string }[] }) {
  return (
    <Group gap={8} mt={4}>
      {items.map((item) => (
        <Badge key={item.label} size="xs" variant="dot" color={item.color} radius="sm">
          {item.label}
        </Badge>
      ))}
    </Group>
  );
}

// ─────────────────────────────────────────────
// 1. HitlShellCommandApproval
// ─────────────────────────────────────────────

interface HitlShellCommandApprovalProps {
  command: string;
  shell?: string;
  branch?: string;
  accessLevel?: "read" | "write" | "admin";
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlShellCommandApproval({
  command,
  shell = "bash",
  branch,
  accessLevel = "write",
  risk = "medium",
  status = "pending",
  onAllow,
  onDeny,
}: HitlShellCommandApprovalProps) {
  const ACCESS_COLOR = { read: "teal", write: "yellow", admin: "red" };

  return (
    <HitlCardShell
      header={<HitlHeader title="_ Terminal" risk={risk} onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Permitir" onAllow={onAllow} />}
    >
      <Code
        block
        style={{
          background: "transparent",
          color: "var(--mantine-color-blue-3)",
          fontSize: "var(--mantine-font-size-xs)",
          padding: 0,
        }}
      >
        $ {command}
      </Code>
      <MetaBadges items={[
        { label: shell, color: "green" },
        ...(branch ? [{ label: branch, color: "violet" }] : []),
        { label: accessLevel, color: ACCESS_COLOR[accessLevel] ?? "gray" },
      ]} />
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// 2. HitlCodeDiffReview
// ─────────────────────────────────────────────

interface DiffLine {
  type: "add" | "del" | "ctx";
  content: string;
}

const DIFF_COLOR = { add: "green.4", del: "red.4", ctx: "dark.2" };

interface HitlCodeDiffReviewProps {
  filePath: string;
  linesAdded: number;
  linesRemoved: number;
  preview?: DiffLine[];
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlCodeDiffReview({
  filePath,
  linesAdded,
  linesRemoved,
  preview = [],
  risk = "low",
  status = "pending",
  onAllow,
  onDeny,
}: HitlCodeDiffReviewProps) {
  return (
    <HitlCardShell
      header={<HitlHeader title="_ Code diff" risk={risk} denyLabel="rejeitar" onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Aplicar" onAllow={onAllow} />}
    >
      <Group gap="xs" justify="space-between" mb={6}>
        <Text size="xs" c="dark.2" ff="monospace" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {filePath}
        </Text>
        <Group gap={6}>
          <Text size="xs" c="green.5" ff="monospace">+{linesAdded}</Text>
          <Text size="xs" c="red.4" ff="monospace">-{linesRemoved}</Text>
        </Group>
      </Group>
      {preview.length > 0 && (
        <Paper radius="xs" p="xs" style={{ background: "var(--mantine-color-dark-9)" }}>
          {preview.map((line, i) => (
            <Text key={i} size="xs" c={DIFF_COLOR[line.type]} ff="monospace" style={{ lineHeight: 1.7 }}>
              {line.type === "add" ? "+ " : line.type === "del" ? "- " : "  "}
              {line.content}
            </Text>
          ))}
        </Paper>
      )}
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// 3. HitlFileWriteApproval
// ─────────────────────────────────────────────

type FileWriteOp = "create" | "overwrite" | "append";

const FILE_OP_TONE: Record<FileWriteOp, "warn" | "danger" | undefined> = {
  create:    undefined as undefined,
  overwrite: "warn" as const,
  append:    undefined as undefined,
};

interface HitlFileWriteApprovalProps {
  filePath: string;
  operation: FileWriteOp;
  sizeLabel?: string | undefined;
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlFileWriteApproval({
  filePath,
  operation,
  sizeLabel,
  risk = "medium",
  status = "pending",
  onAllow,
  onDeny,
}: HitlFileWriteApprovalProps) {
  return (
    <HitlCardShell
      header={<HitlHeader title="_ Escrita em arquivo" risk={risk} denyLabel="cancelar" onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Confirmar escrita" onAllow={onAllow} />}
    >
      <Box style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <KVRow label="caminho"   value={filePath} />
        <KVRow label="operação"  value={operation} tone={FILE_OP_TONE[operation]} />
        {sizeLabel && <KVRow label="tamanho" value={sizeLabel} />}
      </Box>
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// 4. HitlSecretAccessApproval
// ─────────────────────────────────────────────

interface HitlSecretAccessApprovalProps {
  secretName: string;
  scope?: string;
  requestedBy?: string;
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlSecretAccessApproval({
  secretName,
  scope,
  requestedBy,
  risk = "high",
  status = "pending",
  onAllow,
  onDeny,
}: HitlSecretAccessApprovalProps) {
  return (
    <HitlCardShell
      header={<HitlHeader title="_ Acesso a credencial" risk={risk} denyLabel="bloquear" onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Permitir leitura" onAllow={onAllow} />}
    >
      <Box style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <KVRow label="segredo" value={secretName} />
        <KVRow label="valor"   value={<Text ff="monospace" size="xs" c="dark.3" style={{ letterSpacing: "0.15em" }}>••••••••••••</Text>} />
        {scope      && <KVRow label="escopo"      value={scope} />}
        {requestedBy && <KVRow label="solicitante" value={requestedBy} />}
      </Box>
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// 5. HitlDatabaseMutationApproval
// ─────────────────────────────────────────────

interface HitlDatabaseMutationApprovalProps {
  query: string;
  table: string;
  estimatedRows?: number;
  database?: string;
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlDatabaseMutationApproval({
  query,
  table,
  estimatedRows,
  database,
  risk = "high",
  status = "pending",
  onAllow,
  onDeny,
}: HitlDatabaseMutationApprovalProps) {
  const rowTone = estimatedRows && estimatedRows > 1000 ? "danger" : estimatedRows && estimatedRows > 100 ? "warn" : undefined;

  return (
    <HitlCardShell
      header={<HitlHeader title="_ Mutação no banco" risk={risk} denyLabel="cancelar" onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Executar" onAllow={onAllow} />}
    >
      <Code
        block
        style={{
          background: "var(--mantine-color-dark-9)",
          color: "var(--mantine-color-blue-3)",
          fontSize: "var(--mantine-font-size-xs)",
          borderRadius: 4,
          padding: "6px 8px",
          marginBottom: 6,
        }}
      >
        {query}
      </Code>
      <Box style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <KVRow label="tabela" value={table} />
        {estimatedRows !== undefined && (
          <KVRow label="linhas estimadas" value={`~${estimatedRows.toLocaleString("pt-BR")}`} tone={rowTone} />
        )}
        {database && <KVRow label="banco" value={database} />}
      </Box>
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// 6. HitlDeployApproval
// ─────────────────────────────────────────────

type DeployEnv = "development" | "staging" | "production";

const ENV_TONE: Record<DeployEnv, "warn" | "danger" | undefined> = {
  development: undefined as undefined,
  staging:     "warn" as const,
  production:  "danger" as const,
};

interface HitlDeployApprovalProps {
  service: string;
  fromVersion?: string;
  toVersion: string;
  environment: DeployEnv;
  strategy?: string;
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlDeployApproval({
  service,
  fromVersion,
  toVersion,
  environment,
  strategy,
  risk = "critical",
  status = "pending",
  onAllow,
  onDeny,
}: HitlDeployApprovalProps) {
  const versionLabel = fromVersion ? `${fromVersion} → ${toVersion}` : toVersion;

  return (
    <HitlCardShell
      header={<HitlHeader title="_ Deploy" risk={risk} denyLabel="abortar" onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Iniciar deploy" onAllow={onAllow} />}
    >
      <Box style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <KVRow label="serviço"    value={service} />
        <KVRow label="versão"     value={versionLabel} />
        <KVRow label="ambiente"   value={environment} tone={ENV_TONE[environment]} />
        {strategy && <KVRow label="estratégia" value={strategy} />}
      </Box>
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// 7. HitlExternalActionApproval
// ─────────────────────────────────────────────

interface HitlExternalActionApprovalProps {
  service: string;
  action: string;
  payloadSummary?: string;
  timeout?: string;
  risk?: HITLRisk;
  status?: HITLStatus;
  onAllow?: (() => void) | undefined;
  onDeny?: (() => void) | undefined;
}

export function HitlExternalActionApproval({
  service,
  action,
  payloadSummary,
  timeout,
  risk = "medium",
  status = "pending",
  onAllow,
  onDeny,
}: HitlExternalActionApprovalProps) {
  return (
    <HitlCardShell
      header={<HitlHeader title="_ Ação externa" risk={risk} denyLabel="cancelar" onDeny={onDeny} status={status} />}
      footer={<HitlActions status={status} allowLabel="Enviar" onAllow={onAllow} />}
    >
      <Box style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <KVRow label="serviço" value={service} />
        <KVRow label="ação"    value={action} />
        {payloadSummary && <KVRow label="payload" value={payloadSummary} />}
        {timeout        && <KVRow label="timeout" value={timeout} />}
      </Box>
    </HitlCardShell>
  );
}

// ─────────────────────────────────────────────
// Router: ToolCall → variante especializada
// ─────────────────────────────────────────────

interface HitlCardProps {
  toolCall: ToolCall;
  onApprove: (toolCallId: string) => void;
  onReject: (toolCallId: string) => void;
}

/**
 * Renderiza o cartão HITL especializado correto para o `ToolCall`.
 * Adapta as props genéricas do bridge para as props tipadas de cada variante.
 */
export function HitlCard({ toolCall, onApprove, onReject }: HitlCardProps): JSX.Element {
  const { category, risk, label } = classifyHitl(toolCall);
  const onAllow = () => onApprove(toolCall.id);
  const onDeny = () => onReject(toolCall.id);

  switch (category) {
    case "shell":
      return (
        <HitlShellCommandApproval
          command={toolCallCommandPreview(toolCall)}
          shell={typeof toolCall.arguments.shell === "string" ? toolCall.arguments.shell : "bash"}
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );

    case "file-write":
      return (
        <HitlFileWriteApproval
          filePath={
            (typeof toolCall.arguments.filePath === "string" ? toolCall.arguments.filePath
              : typeof toolCall.arguments.path === "string" ? toolCall.arguments.path
              : "unknown") as string
          }
          operation="create"
          sizeLabel={typeof toolCall.arguments.content === "string" ? `${toolCall.arguments.content.length} chars` : undefined}
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );

    case "file-edit":
    case "code-diff": {
      const fp = typeof toolCall.arguments.filePath === "string" ? toolCall.arguments.filePath
        : typeof toolCall.arguments.path === "string" ? toolCall.arguments.path : "unknown";
      const oldStr = typeof toolCall.arguments.oldString === "string" ? toolCall.arguments.oldString : "";
      const newStr = typeof toolCall.arguments.newString === "string" ? toolCall.arguments.newString : "";
      const oldLines = oldStr ? oldStr.split("\n") : [];
      const newLines = newStr ? newStr.split("\n") : [];

      const preview: DiffLine[] = [
        ...oldLines.slice(0, 5).map((l): DiffLine => ({ type: "del", content: l })),
        ...newLines.slice(0, 5).map((l): DiffLine => ({ type: "add", content: l })),
      ];

      return (
        <HitlCodeDiffReview
          filePath={fp}
          linesAdded={newLines.length}
          linesRemoved={oldLines.length}
          preview={preview}
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );
    }

    case "external":
      return (
        <HitlExternalActionApproval
          service={toolCall.name}
          action={typeof toolCall.arguments.url === "string" ? toolCall.arguments.url
            : typeof toolCall.arguments.query === "string" ? toolCall.arguments.query : "request"}
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );

    case "deploy":
      return (
        <HitlDeployApproval
          service={typeof toolCall.arguments.service === "string" ? toolCall.arguments.service : toolCall.name}
          toVersion={typeof toolCall.arguments.version === "string" ? toolCall.arguments.version : "latest"}
          environment="production"
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );

    case "database":
      return (
        <HitlDatabaseMutationApproval
          query={toolCallCommandPreview(toolCall)}
          table={typeof toolCall.arguments.table === "string" ? toolCall.arguments.table : "unknown"}
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );

    case "secret":
      return (
        <HitlSecretAccessApproval
          secretName={typeof toolCall.arguments.name === "string" ? toolCall.arguments.name : "unknown"}
          risk={risk}
          onAllow={onAllow}
          onDeny={onDeny}
        />
      );

    default:
      // Fallback genérico
      return (
        <HitlCardShell
          header={<HitlHeader title={`_ ${label}`} risk={risk} onDeny={onDeny} status="pending" />}
          footer={<HitlActions status="pending" allowLabel="Permitir" onAllow={onAllow} />}
        >
          <Code
            block
            style={{
              background: "transparent",
              color: "var(--mantine-color-blue-3)",
              fontSize: "var(--mantine-font-size-xs)",
              padding: 0,
            }}
          >
            {toolCallCommandPreview(toolCall)}
          </Code>
        </HitlCardShell>
      );
  }
}
