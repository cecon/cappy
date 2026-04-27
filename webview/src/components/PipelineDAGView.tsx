import { useState } from "react";
import { Box, Group, Text } from "@mantine/core";
import type { ToolRowItem } from "../domain/entities/ChatState";
import type { PipelineUiState } from "../lib/types";
import { cappyPalette } from "../theme";

interface Props {
  toolRows: ToolRowItem[];
  pipeline: PipelineUiState | null;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W = 100;
const NODE_H = 32;
const H_GAP = 40;    // horizontal gap between nodes in the same layer
const V_GAP = 48;    // vertical gap between layers
const PAD_X = 16;
const PAD_Y = 16;

// ── Node types ────────────────────────────────────────────────────────────────

interface DAGNode {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "rejected" | "awaiting-approval";
  layer: number;  // 0 = root, 1 = workers, etc.
  col: number;    // column within the layer
}

interface DAGEdge {
  fromId: string;
  toId: string;
}

// ── Status colours ────────────────────────────────────────────────────────────

const NODE_FILL: Record<string, string> = {
  pending: "#2a2b31",
  running: "#1a2a3a",
  done: "#1a2e1a",
  rejected: "#2e1a1a",
  "awaiting-approval": "#2e2a1a",
};

const NODE_STROKE: Record<string, string> = {
  pending: cappyPalette.borderSurface,
  running: cappyPalette.textAccent,
  done: cappyPalette.greenMid,
  rejected: cappyPalette.redSoft,
  "awaiting-approval": cappyPalette.amber,
};

const NODE_TEXT: Record<string, string> = {
  pending: cappyPalette.textMuted,
  running: cappyPalette.textPrimary,
  done: cappyPalette.greenMid,
  rejected: cappyPalette.redSoft,
  "awaiting-approval": cappyPalette.amber,
};

const AGENT_TOOL_NAMES = new Set(["Agent", "agentTool", "ExploreAgent", "TeamCreate"]);

// ── DAG builders ──────────────────────────────────────────────────────────────

function buildPipelineDAG(pipeline: PipelineUiState): { nodes: DAGNode[]; edges: DAGEdge[] } {
  const nodes: DAGNode[] = pipeline.stages.map((s, i) => ({
    id: s.id,
    label: s.name,
    status: s.status,
    layer: 0,
    col: i,
  }));
  const edges: DAGEdge[] = pipeline.stages.slice(1).map((s, i) => {
    const prev = pipeline.stages[i];
    return { fromId: prev?.id ?? "", toId: s.id };
  });
  return { nodes, edges };
}

function buildWorkersDAG(toolRows: ToolRowItem[]): { nodes: DAGNode[]; edges: DAGEdge[] } {
  const ROOT_ID = "__root__";
  const nodes: DAGNode[] = [{ id: ROOT_ID, label: "Coordinator", status: "running", layer: 0, col: 0 }];
  const edges: DAGEdge[] = [];

  const workers = toolRows.filter((r) => AGENT_TOOL_NAMES.has(r.name));
  workers.forEach((w, i) => {
    const raw =
      (w.input["task"] as string | undefined) ??
      (w.input["description"] as string | undefined) ??
      (w.input["prompt"] as string | undefined) ??
      "";
    const first = raw.split("\n")[0]?.trim() ?? "";
    const label = first.length > 14 ? `${first.slice(0, 13)}…` : first || `Worker ${i + 1}`;

    const status: DAGNode["status"] =
      w.status === "done" ? "done" :
      w.status === "rejected" ? "rejected" :
      w.status === "running" ? "running" : "pending";

    nodes.push({ id: w.id, label, status, layer: 1, col: i });
    edges.push({ fromId: ROOT_ID, toId: w.id });
  });

  return { nodes, edges };
}

// ── SVG layout ────────────────────────────────────────────────────────────────

function computeLayout(nodes: DAGNode[]): Map<string, { x: number; y: number }> {
  // Group by layer
  const layers = new Map<number, DAGNode[]>();
  for (const n of nodes) {
    if (!layers.has(n.layer)) layers.set(n.layer, []);
    layers.get(n.layer)!.push(n);
  }

  const pos = new Map<string, { x: number; y: number }>();
  for (const [layer, layerNodes] of layers) {
    const sorted = [...layerNodes].sort((a, b) => a.col - b.col);
    const totalW = sorted.length * NODE_W + (sorted.length - 1) * H_GAP;
    const startX = PAD_X;
    sorted.forEach((n, i) => {
      pos.set(n.id, {
        x: startX + i * (NODE_W + H_GAP),
        y: PAD_Y + layer * (NODE_H + V_GAP),
      });
    });
    // Centre the layer horizontally (relative, SVG viewBox adjusts)
    void totalW;
  }

  return pos;
}

function svgWidth(nodes: DAGNode[]): number {
  const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  // max columns per layer
  const colsPerLayer: number[] = Array.from({ length: maxLayer + 1 }, () => 0);
  for (const n of nodes) {
    const cur = colsPerLayer[n.layer] ?? 0;
    colsPerLayer[n.layer] = Math.max(cur, n.col + 1);
  }
  const maxCols = Math.max(...colsPerLayer, 1);
  return PAD_X * 2 + maxCols * NODE_W + (maxCols - 1) * H_GAP;
}

function svgHeight(nodes: DAGNode[]): number {
  const maxLayer = nodes.reduce((m, n) => Math.max(m, n.layer), 0);
  return PAD_Y * 2 + (maxLayer + 1) * NODE_H + maxLayer * V_GAP;
}

// ── Rendering helpers ─────────────────────────────────────────────────────────

function EdgeLine({
  from,
  to,
  pos,
}: {
  from: string;
  to: string;
  pos: Map<string, { x: number; y: number }>;
}): JSX.Element | null {
  const p1 = pos.get(from);
  const p2 = pos.get(to);
  if (!p1 || !p2) return null;

  const x1 = p1.x + NODE_W / 2;
  const y1 = p1.y + NODE_H;
  const x2 = p2.x + NODE_W / 2;
  const y2 = p2.y;

  // Straight line for same-layer (pipeline) edges, curve for cross-layer (worker)
  const isSameLayer = Math.abs(y1 - y2) < 4;
  if (isSameLayer) {
    return (
      <line
        x1={p1.x + NODE_W}
        y1={p1.y + NODE_H / 2}
        x2={p2.x}
        y2={p2.y + NODE_H / 2}
        stroke={cappyPalette.borderSurface}
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
    );
  }

  const midY = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={cappyPalette.borderSurface}
      strokeWidth={1.5}
      markerEnd="url(#arrow)"
    />
  );
}

function NodeRect({
  node,
  pos,
}: {
  node: DAGNode;
  pos: Map<string, { x: number; y: number }>;
}): JSX.Element | null {
  const p = pos.get(node.id);
  if (!p) return null;

  return (
    <g>
      <rect
        x={p.x}
        y={p.y}
        width={NODE_W}
        height={NODE_H}
        rx={6}
        fill={NODE_FILL[node.status] ?? "#2a2b31"}
        stroke={NODE_STROKE[node.status] ?? cappyPalette.borderSurface}
        strokeWidth={node.status === "running" ? 1.5 : 1}
      />
      <text
        x={p.x + NODE_W / 2}
        y={p.y + NODE_H / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill={NODE_TEXT[node.status] ?? cappyPalette.textMuted}
        fontFamily="var(--font-ui, system-ui)"
      >
        {node.label}
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * SVG-based DAG view.  Shows either a pipeline stage graph (when a pipeline is
 * active) or a coordinator→workers graph (when Agent tool rows exist).
 * Collapsible to save vertical space.
 */
export function PipelineDAGView({ toolRows, pipeline }: Props): JSX.Element | null {
  const [collapsed, setCollapsed] = useState(false);

  const hasWorkers = toolRows.some((r) => AGENT_TOOL_NAMES.has(r.name));
  if (!pipeline && !hasWorkers) return null;

  const { nodes, edges } = pipeline ? buildPipelineDAG(pipeline) : buildWorkersDAG(toolRows);
  const pos = computeLayout(nodes);
  const width = svgWidth(nodes);
  const height = svgHeight(nodes);
  const title = pipeline ? `Pipeline: ${pipeline.name}` : "Agentes Paralelos";

  return (
    <Box
      style={{
        background: cappyPalette.bgSunken,
        borderTop: `1px solid ${cappyPalette.borderSubtle}`,
        flexShrink: 0,
      }}
    >
      {/* Header / toggle */}
      <Group
        px={8}
        py={4}
        gap="xs"
        align="center"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <Text
          size="xs"
          c="dimmed"
          style={{ fontFamily: "monospace", lineHeight: 1 }}
        >
          {collapsed ? "▶" : "▼"}
        </Text>
        <Text size="xs" c="dimmed" tt="uppercase" lts={0.5}>
          {title}
        </Text>
      </Group>

      {/* SVG graph */}
      {!collapsed && (
        <Box style={{ overflowX: "auto", overflowY: "hidden" }}>
          <svg
            width={width}
            height={height}
            style={{ display: "block" }}
            aria-label={title}
          >
            <defs>
              <marker
                id="arrow"
                markerWidth={6}
                markerHeight={6}
                refX={5}
                refY={3}
                orient="auto"
              >
                <path
                  d="M0,0 L0,6 L6,3 z"
                  fill={cappyPalette.borderSurface}
                />
              </marker>
            </defs>

            {/* Edges first (under nodes) */}
            {edges.map((e) => (
              <EdgeLine key={`${e.fromId}-${e.toId}`} from={e.fromId} to={e.toId} pos={pos} />
            ))}

            {/* Nodes */}
            {nodes.map((n) => (
              <NodeRect key={n.id} node={n} pos={pos} />
            ))}
          </svg>
        </Box>
      )}
    </Box>
  );
}
