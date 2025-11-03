import React, { useEffect, useState } from 'react';
import typescriptIcon from '../../../../../../assets/typescript.svg';
import reactIcon from '../../../../../../assets/react.svg';
import fileIcon from '../../../../../../assets/file.svg';
import chunkIcon from '../../../../../../assets/chunk.svg';
import workspaceIcon from '../../../../../../assets/workspace.svg';
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

type GraphVisualizerProps = {
  nodes: Array<{ id: string; label: string; type?: 'file' | 'chunk' | 'workspace' }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
};

// Helper to get icon by node type/extension
function getNodeIcon(node: { type?: string; label?: string }): string {
  if (node.type === 'workspace') return workspaceIcon;
  if (node.type === 'chunk') return chunkIcon;
  if (node.type === 'file') {
    if (node.label?.endsWith('.ts')) return typescriptIcon;
    if (node.label?.endsWith('.tsx')) return reactIcon;
    if (node.label?.endsWith('.jsx')) return reactIcon;
    return fileIcon;
  }
  return fileIcon;
}

interface NodeMeta {
  id: string;
  label?: string;
  type?: string;
  icon?: string;
}

interface EdgeMeta {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const GraphLoader: React.FC<GraphVisualizerProps & {
  onNodeClick: (node: NodeMeta, edges: EdgeMeta[]) => void;
}> = ({ nodes, edges, onNodeClick }) => {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    const graph = new Graph();

    // Add nodes to graph
    for (const node of nodes) {
      let color = '#8b5cf6';
      if (node.type === 'file') color = '#10b981';
      else if (node.type === 'chunk') color = '#3b82f6';
      const size = node.type === 'file' ? 15 : 10;
      const icon = getNodeIcon(node);
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        color,
        icon,
      });
    }

    // Add edges to graph
    for (const edge of edges) {
      try {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            label: edge.label || '',
            size: 2,
            color: '#666',
          });
        }
      } catch (err) {
        // Ignore duplicated/invalid edges
        console.warn(`Edge ${edge.id} already exists or has invalid nodes`, err);
      }
    }

    // Layout ForceAtlas2 for automatic positioning
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, { iterations: 50, settings });

    // Load the graph into Sigma
    loadGraph(graph);

    // Interaction events
    registerEvents({
      clickNode: (event) => {
        const nodeId = event.node;
        const node = nodes.find(n => n.id === nodeId);
        const connectedEdges = edges.filter(e => e.source === nodeId || e.target === nodeId);
        if (node) onNodeClick(node, connectedEdges);
      },
      enterNode: (event) => {
        sigma.getGraph().setNodeAttribute(event.node, 'highlighted', true);
      },
      leaveNode: (event) => {
        sigma.getGraph().setNodeAttribute(event.node, 'highlighted', false);
      },
    });
  }, [nodes, edges, loadGraph, sigma, registerEvents, onNodeClick]);

  return null;
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ nodes, edges }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NodeMeta | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<EdgeMeta[]>([]);

  const handleNodeClick = (node: NodeMeta, clickedEdges: EdgeMeta[]) => {
    setSelectedNode(node);
    setSelectedEdges(clickedEdges);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedNode(null);
    setSelectedEdges([]);
  };

  return (
    <div style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden', background: '#1a1a1a', position: 'relative' }}>
      <SigmaContainer
        style={{ width: '100%', height: '100%' }}
        settings={{
          renderEdgeLabels: false,
          defaultNodeColor: '#666',
          defaultEdgeColor: '#444',
          labelColor: { color: '#fff' },
          labelSize: 12,
          labelWeight: 'normal',
          enableEdgeEvents: true,
        }}
      >
        <GraphLoader nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />
      </SigmaContainer>
      {modalOpen && selectedNode && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#222',
          color: '#fff',
          borderRadius: '12px',
          boxShadow: '0 2px 16px #0008',
          padding: '32px',
          minWidth: '340px',
          zIndex: 1000,
        }}>
          <h2 style={{ marginTop: 0 }}>Metadados do Nó</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {selectedNode.icon && (
              <img src={selectedNode.icon} alt="icon" width={32} height={32} />
            )}
            <div>
              <strong>ID:</strong> {selectedNode.id}<br />
              <strong>Label:</strong> {selectedNode.label}<br />
              <strong>Tipo:</strong> {selectedNode.type}
            </div>
          </div>
          <hr style={{ margin: '18px 0' }} />
          <h3>Relacionamentos</h3>
          <ul>
            {selectedEdges.length === 0 && <li>Nenhum relacionamento</li>}
            {selectedEdges.map(edge => (
              <li key={edge.id}>
                <strong>{edge.label || 'edge'}:</strong> {edge.source} → {edge.target}
              </li>
            ))}
          </ul>
          <button style={{ marginTop: 18, padding: '8px 18px', borderRadius: 6, background: '#444', color: '#fff', border: 'none', cursor: 'pointer' }} onClick={closeModal}>Fechar</button>
        </div>
      )}
    </div>
  );
};

export default GraphVisualizer;
