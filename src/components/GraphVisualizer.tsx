import React, { useEffect } from 'react';
import { SigmaContainer, useLoadGraph, useRegisterEvents, useSigma } from '@react-sigma/core';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

type GraphVisualizerProps = {
  nodes: Array<{ id: string; label: string; type?: 'file' | 'chunk' | 'workspace' }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
};

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
      
      graph.addNode(node.id, {
        label: node.label,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: size,
        color: color,
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
