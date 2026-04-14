import { GenericToolRenderer } from "../lib/toolRenderers";
import { toolRegistry } from "../lib/toolRegistry";
import type { ToolRowItem } from "../domain/entities/ChatState";

interface ToolPartDisplayProps {
  row: ToolRowItem;
}

/**
 * ToolPartDisplay — routes a ToolRowItem to its registered renderer.
 * Falls back to GenericToolRenderer if no specific renderer is registered.
 * Mirrors Kilo Code's ToolPartDisplay / Dynamic + ToolRegistry pattern.
 */
export function ToolPartDisplay({ row }: ToolPartDisplayProps): JSX.Element {
  const Renderer = toolRegistry.render(row.name) ?? GenericToolRenderer;
  return (
    <Renderer
      name={row.name}
      input={row.input}
      status={row.status}
      {...(row.output !== undefined ? { output: row.output } : {})}
      {...(row.fileDiff !== undefined ? { fileDiff: row.fileDiff } : {})}
    />
  );
}
