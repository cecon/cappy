import React, { useEffect } from 'react';
import typescriptIcon from '../assets/typescript.svg';
import reactIcon from '../assets/react.svg';
import fileIcon from '../assets/file.svg';
import chunkIcon from '../assets/chunk.svg';
import workspaceIcon from '../assets/workspace.svg';
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

const GraphLoader: React.FC<GraphVisualizerProps> = ({ nodes, edges }) => {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    const graph = new Graph();

    // Adicionar nós ao grafo
    nodes.forEach(node => {
      const color = node.type === 'file' ? '#10b981' : node.type === 'chunk' ? '#3b82f6' : '#8b5cf6';
      const size = node.type === 'file' ? 15 : 10;
      const icon = getNodeIcon(node);
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: size,
        color: color,
        icon: icon,
      });
    });

    // Adicionar arestas ao grafo
    edges.forEach(edge => {
      try {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            label: edge.label || '',
            size: 2,
            color: '#666',
          });
        }
      } catch (err) {
        // Ignorar arestas duplicadas
        console.warn(`Edge ${edge.id} already exists or has invalid nodes`, err);
      }
    });

    // Aplicar layout ForceAtlas2 para posicionamento automático
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, { iterations: 50, settings });

    // Carregar o grafo no Sigma
    loadGraph(graph);

    // Registrar eventos de interação
    registerEvents({
      clickNode: (event) => {
        console.log('Node clicked:', event.node);
      },
      enterNode: (event) => {
        sigma.getGraph().setNodeAttribute(event.node, 'highlighted', true);
      },
      leaveNode: (event) => {
        sigma.getGraph().setNodeAttribute(event.node, 'highlighted', false);
      },
    });
  }, [nodes, edges, loadGraph, sigma, registerEvents]);

  return null;
};

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ nodes, edges }) => {
  // Custom node renderer to show SVG icon
  return (
    <div style={{ width: '100%', height: '600px', borderRadius: '8px', overflow: 'hidden', background: '#1a1a1a' }}>
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
        <GraphLoader nodes={nodes} edges={edges} />
      </SigmaContainer>
    </div>
  );
};

export default GraphVisualizer;
