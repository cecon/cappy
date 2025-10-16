import React, { useMemo } from 'react';
import { GraphCanvas, darkTheme } from 'reagraph';

type GraphVisualizerProps = {
  nodes: Array<{ id: string; label: string; type?: 'file' | 'chunk' | 'workspace' }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ nodes, edges }) => {
  const reagraphNodes = useMemo(() => {
    return nodes.map(n => ({
      id: n.id,
      label: n.label,
      fill: n.type === 'file' ? '#10b981' : n.type === 'chunk' ? '#3b82f6' : '#8b5cf6',
      size: n.type === 'file' ? 15 : 10
    }));
  }, [nodes]);

  const reagraphEdges = useMemo(() => {
    return edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label
    }));
  }, [edges]);

  return (
    <div style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden' }}>
      <GraphCanvas
        nodes={reagraphNodes}
        edges={reagraphEdges}
        theme={darkTheme}
        layoutType="concentric2d"
        draggable
        animated
        labelType="none"
      />
    </div>
  );
};

export default GraphVisualizer;
