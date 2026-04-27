import { useState } from "react";
import { Box, Group, Text } from "@mantine/core";
import type { ToolRowItem } from "../domain/entities/ChatState";
import type { PipelineUiState } from "../lib/types";
import { AGENT_TOOL_NAMES, extractAgentTask } from "../lib/agentUtils";
import { cappyPalette } from "../theme";

interface Props {
  toolRows: ToolRowItem[];
  pipeline: PipelineUiState | null;
}

// ── Layout ────────────────────────────────────────────────────────────────────

const NODE_W = 100;
const NODE_H = 32;
const H_GAP = 40;
const V_GAP = 48;
const PAD = 16;

interface DAGNode {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "rejected" | "awaiting-approval";
  layer: number;
  col: number;
}
interface DAGEdge { fromId: string; toId: string }

const NODE_FILL: Record<string, string> = {
  pending: "#2a2b31", running: "#1a2a3a", done: "#1a2e1a",
  rejected: "#2e1a1a", "awaiting-approval": "#2e2a1a",
};
const NODE_STROKE: Record<string, string> = {
  pending: cappyPalette.borderSurface, running: cappyPalette.textAccent,
  done: cappyPalette.greenMid, rejected: cappyPalette.redSoft,
  "awaiting-approval": cappyPalette.amber,
};
const NODE_TEXT: Record<string, string> = {
  pending: cappyPalette.textMuted, running: cappyPalette.textPrimary,
  done: cappyPalette.greenMid, rejected: cappyPalette.redSoft,
  "awaiting-approval": cappyPalette.amber,
};

// ── DAG builders ──────────────────────────────────────────────────────────────

function buildPipelineDAG(p: PipelineUiState): { nodes: DAGNode[]; edges: DAGEdge[] } {
  const nodes = p.stages.map((s, i): DAGNode => ({ id: s.id, label: s.name, status: s.status, layer: 0, col: i }));
  const edges = p.stages.slice(1).map((s, i): DAGEdge => ({ fromId: p.stages[i]?.id ?? "", toId: s.id }));
  return { nodes, edges };
}

function buildWorkersDAG(rows: ToolRowItem[]): { nodes: DAGNode[]; edges: DAGEdge[] } {
  const ROOT = "__root__";
  const nodes: DAGNode[] = [{ id: ROOT, label: "Coordinator", status: "running", layer: 0, col: 0 }];
  const edges: DAGEdge[] = [];
  rows.filter((r) => AGENT_TOOL_NAMES.has(r.name)).forEach((w, i) => {
    const label = extractAgentTask(w.input, 14);
    const status = (w.status === "running" || w.status === "done" || w.status === "rejected") ? w.status : "pending";
    nodes.push({ id: w.id, label: label || `Worker ${i + 1}`, status, layer: 1, col: i });
    edges.push({ fromId: ROOT, toId: w.id });
  });
  return { nodes, edges };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function positionNodes(nodes: DAGNode[]): Map<string, { x: number; y: number }> {
  const layers = new Map<number, DAGNode[]>();
  for (const n of nodes) {
    if (!layers.has(n.layer)) layers.set(n.layer, []);
    layers.get(n.layer)!.push(n);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [layer, layerNodes] of layers) {
    [...layerNodes].sort((a, b) => a.col - b.col).forEach((n, i) => {
      pos.set(n.id, { x: PAD + i * (NODE_W + H_GAP), y: PAD + layer * (NODE_H + V_GAP) });
    });
  }
  return pos;
}

function svgDimensions(nodes: DAGNode[]): { w: number; h: number } {
  const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  const colsPerLayer: number[] = Array.from({ length: maxLayer + 1 }, () => 0);
  for (const n of nodes) { const cur = colsPerLayer[n.layer] ?? 0; colsPerLayer[n.layer] = Math.max(cur, n.col + 1); }
  const maxCols = Math.max(...colsPerLayer, 1);
  return { w: PAD * 2 + maxCols * NODE_W + (maxCols - 1) * H_GAP, h: PAD * 2 + (maxLayer + 1) * NODE_H + maxLayer * V_GAP };
}

function EdgeLine({ e, pos }: { e: DAGEdge; pos: Map<string, { x: number; y: number }> }): JSX.Element | null {
  const p1 = pos.get(e.fromId); const p2 = pos.get(e.toId);
  if (!p1 || !p2) return null;
  const sameLayer = Math.abs((p1.y + NODE_H) - p2.y) < 4;
  if (sameLayer) {
    return <line x1={p1.x + NODE_W} y1={p1.y + NODE_H / 2} x2={p2.x} y2={p2.y + NODE_H / 2}
      stroke={cappyPalette.borderSurface} strokeWidth={1.5} markerEnd="url(#arrow)" />;
  }
  const x1 = p1.x + NODE_W / 2; const y1 = p1.y + NODE_H; const x2 = p2.x + NODE_W / 2; const y2 = p2.y;
  const mid = (y1 + y2) / 2;
  return <path d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
    fill="none" stroke={cappyPalette.borderSurface} strokeWidth={1.5} markerEnd="url(#arrow)" />;
}

function NodeRect({ n, pos }: { n: DAGNode; pos: Map<string, { x: number; y: number }> }): JSX.Element | null {
  const p = pos.get(n.id);
  if (!p) return null;
  return (
    <g>
      <rect x={p.x} y={p.y} width={NODE_W} height={NODE_H} rx={6}
        fill={NODE_FILL[n.status] ?? "#2a2b31"}
        stroke={NODE_STROKE[n.status] ?? cappyPalette.borderSurface}
        strokeWidth={n.status === "running" ? 1.5 : 1} />
      <text x={p.x + NODE_W / 2} y={p.y + NODE_H / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={10} fill={NODE_TEXT[n.status] ?? cappyPalette.textMuted} fontFamily="var(--font-ui, system-ui)">
        {n.label}
      </text>
    </g>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PipelineDAGView({ toolRows, pipeline }: Props): JSX.Element | null {
  const [collapsed, setCollapsed] = useState(false);
  const hasWorkers = toolRows.some((r) => AGENT_TOOL_NAMES.has(r.name));
  if (!pipeline && !hasWorkers) return null;

  const { nodes, edges } = pipeline ? buildPipelineDAG(pipeline) : buildWorkersDAG(toolRows);
  const pos = positionNodes(nodes);
  const { w, h } = svgDimensions(nodes);
  const title = pipeline ? `Pipeline: ${pipeline.name}` : "Agentes Paralelos";

  return (
    <Box style={{ background: cappyPalette.bgSunken, borderTop: `1px solid ${cappyPalette.borderSubtle}`, flexShrink: 0 }}>
      <Group px={8} py={4} gap="xs" align="center" style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setCollapsed((c) => !c)}>
        <Text size="xs" c="dimmed" style={{ fontFamily: "monospace", lineHeight: 1 }}>{collapsed ? "▶" : "▼"}</Text>
        <Text size="xs" c="dimmed" tt="uppercase" lts={0.5}>{title}</Text>
      </Group>
      {!collapsed && (
        <Box style={{ overflowX: "auto", overflowY: "hidden" }}>
          <svg width={w} height={h} style={{ display: "block" }} aria-label={title}>
            <defs>
              <marker id="arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill={cappyPalette.borderSurface} />
              </marker>
            </defs>
            {edges.map((e) => <EdgeLine key={`${e.fromId}-${e.toId}`} e={e} pos={pos} />)}
            {nodes.map((n) => <NodeRect key={n.id} n={n} pos={pos} />)}
          </svg>
        </Box>
      )}
    </Box>
  );
}
