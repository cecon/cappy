import type { JSX } from "react";
import type { FileDiffPayload } from "./types";
import type { ToolRowStatus } from "../domain/entities/ChatState";

/**
 * Props passed to every registered tool renderer.
 * Mirrors Kilo Code's ToolProps pattern.
 */
export interface ToolRendererProps {
  name: string;
  input: Record<string, unknown>;
  output?: string | undefined;
  fileDiff?: FileDiffPayload | undefined;
  status: ToolRowStatus;
}

export type ToolRenderer = (props: ToolRendererProps) => JSX.Element;

const registry = new Map<string, ToolRenderer>();

/**
 * ToolRegistry — plugin map of tool name → render function.
 * Mirrors the Kilo Code ToolRegistry pattern exactly.
 *
 * Usage:
 *   toolRegistry.register("bash", (props) => <BasicTool ... />)
 *   const Renderer = toolRegistry.render("bash")  // null if not registered
 */
export const toolRegistry = {
  register(name: string, render: ToolRenderer): void {
    registry.set(name.toLowerCase(), render);
  },
  /** Returns the registered renderer, or null if not found. */
  render(name: string): ToolRenderer | null {
    return registry.get(name.toLowerCase()) ?? null;
  },
};
