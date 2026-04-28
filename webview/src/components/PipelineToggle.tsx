import { ActionIcon, Select } from "@mantine/core";
import { useState } from "react";
import type { PipelineTemplate } from "../lib/types";

export interface PipelineState {
  enabled: boolean;
  templateId: string | null;
}

interface PipelineToggleProps {
  templates: PipelineTemplate[];
  isStreaming: boolean;
  onChange: (state: PipelineState) => void;
}

export function PipelineToggle({ templates, isStreaming, onChange }: PipelineToggleProps): JSX.Element | null {
  const [enabled, setEnabled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (templates.length === 0) return null;

  function toggle(): void {
    const next = !enabled;
    const id = next ? (templates[0]?.id ?? null) : null;
    setEnabled(next);
    setSelectedId(id);
    onChange({ enabled: next, templateId: id });
  }

  function selectTemplate(id: string): void {
    setSelectedId(id);
    onChange({ enabled, templateId: id });
  }

  return (
    <>
      <ActionIcon
        variant={enabled ? "filled" : "subtle"}
        color={enabled ? "ideAccent" : "gray"}
        size="sm"
        aria-label={enabled ? "Desativar pipeline" : "Ativar pipeline"}
        title={enabled ? "Desativar pipeline" : "Ativar pipeline"}
        disabled={isStreaming}
        onClick={toggle}
        style={{ flexShrink: 0 }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <circle cx="4" cy="12" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="20" cy="12" r="2.2" />
          <path d="M6.2 12h3.6M14.2 12h3.6" />
        </svg>
      </ActionIcon>

      {enabled && templates.length > 1 ? (
        <Select
          size="xs"
          w={110}
          style={{ flexShrink: 0 }}
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={selectedId}
          onChange={(v) => { if (v) selectTemplate(v); }}
          disabled={isStreaming}
          aria-label="Template de pipeline"
          comboboxProps={{ withinPortal: true }}
        />
      ) : null}
    </>
  );
}
