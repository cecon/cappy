import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Plan, PlanStatus } from "../lib/types";
import { cappyPalette } from "../theme";

interface PlannerPanelProps {
  plan: Plan | null;
  isGenerating: boolean;
  onApprove: () => void;
  onReview: (reason: string) => void;
  onRegen: (reason: string) => void;
}

const STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "RASCUNHO",
  waiting_approval: "AGUARDANDO APROVAÇÃO",
  approved: "APROVADO",
  in_execution: "EM EXECUÇÃO",
  failed: "REVISÃO SOLICITADA",
};

const STATUS_COLORS: Record<PlanStatus, string> = {
  draft: "gray",
  waiting_approval: "blue",
  approved: "green",
  in_execution: "violet",
  failed: "red",
};

/**
 * Displays the active plan spec with approve / review actions.
 * Shown above the InputBar when a plan is active or being generated.
 */
export function PlannerPanel({ plan, isGenerating, onApprove, onReview, onRegen }: PlannerPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [isRegen, setIsRegen] = useState(false);

  if (isGenerating) {
    return (
      <Paper p="sm" radius="md" withBorder style={{ borderColor: "var(--mantine-color-blue-6, #4dabf7)" }}>
        <Group gap="sm" align="center">
          <Loader size="xs" type="dots" color="blue" aria-hidden />
          <Text size="sm" c="dimmed">Gerando spec.md…</Text>
        </Group>
      </Paper>
    );
  }

  if (!plan) return <></>;

  const isAwaitingApproval = plan.status === "waiting_approval";
  const isFailed = plan.status === "failed";
  const isApproved = plan.status === "approved";

  function handleReviewSubmit(): void {
    if (!reviewReason.trim()) return;
    if (isRegen) {
      onRegen(reviewReason.trim());
    } else {
      onReview(reviewReason.trim());
    }
    setReviewModalOpen(false);
    setReviewReason("");
    setIsRegen(false);
  }

  function openReviewModal(regen: boolean): void {
    setIsRegen(regen);
    setReviewReason("");
    setReviewModalOpen(true);
  }

  const borderColor = isApproved
    ? "var(--mantine-color-green-6, #40c057)"
    : isFailed
      ? "var(--mantine-color-red-6, #fa5252)"
      : "var(--mantine-color-blue-6, #4dabf7)";

  return (
    <>
      <Paper p="sm" radius="md" withBorder style={{ borderColor }}>
        {/* Header */}
        <Group justify="space-between" align="center" wrap="nowrap" mb={expanded ? "xs" : 0}>
          <Group gap="xs" align="center" wrap="nowrap">
            <Badge
              size="sm"
              variant="light"
              color={STATUS_COLORS[plan.status]}
              style={{ letterSpacing: 0.5, flexShrink: 0 }}
            >
              {STATUS_LABELS[plan.status]}
            </Badge>

            <Text
              size="xs"
              c="dimmed"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Recolher spec" : "Ver spec.md"}
            </Text>
          </Group>

          <Group gap={4} wrap="nowrap">
            {(isAwaitingApproval || isFailed) && (
              <>
                <Tooltip label="Solicitar revisão do plano" position="top" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="orange"
                    onClick={() => openReviewModal(false)}
                    aria-label="Revisar plano"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354z" />
                    </svg>
                  </ActionIcon>
                </Tooltip>

                {isFailed && (
                  <Tooltip label="Regenerar spec com o feedback" position="top" withArrow>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="blue"
                      onClick={() => openReviewModal(true)}
                      aria-label="Regenerar spec"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />
                      </svg>
                    </ActionIcon>
                  </Tooltip>
                )}

                <Tooltip label="Aprovar spec e liberar implementação" position="top" withArrow>
                  <ActionIcon
                    size="sm"
                    variant="filled"
                    color="green"
                    onClick={onApprove}
                    aria-label="Aprovar spec"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
                    </svg>
                  </ActionIcon>
                </Tooltip>
              </>
            )}

            {isApproved && (
              <Badge size="xs" variant="dot" color="green">
                Pronto para execução
              </Badge>
            )}
          </Group>
        </Group>

        {/* Spec content */}
        <Collapse in={expanded}>
          <Box
            style={{
              maxHeight: 400,
              overflowY: "auto",
              borderRadius: 4,
              padding: "8px 10px",
              backgroundColor: "var(--vscode-textCodeBlock-background, rgba(128,128,128,0.1))",
              marginTop: 6,
            }}
          >
            <Box
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: cappyPalette.textPrimary,
                wordBreak: "break-word",
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{plan.specMd}</ReactMarkdown>
            </Box>
          </Box>
        </Collapse>
      </Paper>

      {/* Review modal */}
      <Modal
        opened={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={isRegen ? "Regenerar spec com feedback" : "Solicitar revisão do plano"}
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {isRegen
              ? "Descreva o que deve ser alterado. O Planner irá gerar uma nova versão do spec incorporando o feedback."
              : "Descreva o motivo da revisão. O plano será marcado como 'Revisão Solicitada'."}
          </Text>
          <Textarea
            value={reviewReason}
            onChange={(e) => setReviewReason(e.currentTarget.value)}
            placeholder="Ex: As tasks estão muito granulares. Consolidar tasks 3 e 4 em uma única."
            minRows={4}
            autosize
            maxRows={10}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setReviewModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              color={isRegen ? "blue" : "orange"}
              disabled={!reviewReason.trim()}
              onClick={handleReviewSubmit}
            >
              {isRegen ? "Regenerar spec" : "Enviar revisão"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
