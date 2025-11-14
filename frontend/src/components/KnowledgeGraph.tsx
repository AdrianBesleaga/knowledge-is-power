import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { GraphNode, GraphEdge } from '../types/graph';
import { CustomNode } from './CustomNode';
import './KnowledgeGraph.css';

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Layout graph using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const KnowledgeGraph = ({ nodes: graphNodes, edges: graphEdges, onNodeClick }: KnowledgeGraphProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    // Convert graph nodes to React Flow nodes
    const flowNodes: Node[] = graphNodes.map((node) => ({
      id: node.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: { 
        ...node,
        onClick: () => handleNodeClick(node),
      },
    }));

    // Convert graph edges to React Flow edges
    const flowEdges: Edge[] = graphEdges.map((edge, idx) => ({
      id: `edge-${idx}`,
      source: edge.source,
      target: edge.target,
      label: edge.relationship,
      type: 'smoothstep',
      animated: edge.strength > 0.7,
      style: {
        stroke: edge.strength > 0.7 ? '#667eea' : '#999',
        strokeWidth: Math.max(1, edge.strength * 3),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.strength > 0.7 ? '#667eea' : '#999',
      },
      labelStyle: {
        fontSize: 11,
        fill: '#666',
      },
      labelBgStyle: {
        fill: '#fff',
        fillOpacity: 0.8,
      },
    }));

    // Apply layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [graphNodes, graphEdges]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    onNodeClick?.(node);
  }, [onNodeClick]);

  return (
    <div className="knowledge-graph-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
      </ReactFlow>

      {/* Legend */}
      <div className="graph-legend">
        <h4>Impact Legend</h4>
        <div className="legend-item">
          <div className="legend-color positive"></div>
          <span>Positive Impact</span>
        </div>
        <div className="legend-item">
          <div className="legend-color negative"></div>
          <span>Negative Impact</span>
        </div>
        <div className="legend-item">
          <div className="legend-color neutral"></div>
          <span>Central Topic</span>
        </div>
      </div>
    </div>
  );
};

