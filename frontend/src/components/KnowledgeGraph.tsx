import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  NodeTypes,
  ReactFlowInstance,
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

// Calculate node levels based on graph structure
// Note: Edges are child -> parent (source is child, target is parent)
// Uses shortest path to root to determine level
const calculateNodeLevels = (nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> => {
  const levels = new Map<string, number>();
  const outgoingEdges = new Map<string, string[]>();
  
  // Build edge map: for each parent, track its children
  edges.forEach(edge => {
    if (!outgoingEdges.has(edge.target)) {
      outgoingEdges.set(edge.target, []);
    }
    outgoingEdges.get(edge.target)!.push(edge.source);
  });

  // Find root node (central/topic node)
  const rootNode = nodes.find(node => node.category === 'central');
  
  if (!rootNode) {
    // Fallback: find nodes with no children (they become level 1)
    const rootNodes = nodes.filter(node => !outgoingEdges.has(node.id));
    rootNodes.forEach(node => levels.set(node.id, 1));
    return levels;
  }

  // BFS from root to assign levels (BFS naturally finds shortest path)
  const queue: Array<{ nodeId: string; level: number }> = [];
  const visited = new Set<string>();
  
  levels.set(rootNode.id, 1);
  visited.add(rootNode.id);
  queue.push({ nodeId: rootNode.id, level: 1 });

  while (queue.length > 0) {
    const { nodeId, level } = queue.shift()!;
    
    // Find children (nodes that point TO this node - where target === nodeId)
    const children = outgoingEdges.get(nodeId) || [];
    children.forEach(childId => {
      // BFS guarantees first visit is shortest path
      if (!visited.has(childId)) {
        levels.set(childId, level + 1);
        visited.add(childId);
        queue.push({ nodeId: childId, level: level + 1 });
      }
    });
  }

  // Assign level 1 to any unassigned nodes (disconnected nodes)
  nodes.forEach(node => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 1);
    }
  });

  return levels;
};

// Get children of a node (nodes that point TO this node)
// Since edges are child -> parent, children are nodes where target === nodeId
const getChildren = (nodeId: string, edges: GraphEdge[]): string[] => {
  return edges
    .filter(edge => edge.target === nodeId)
    .map(edge => edge.source);
};

// Layout graph using dagre
// Note: Our edges are child->parent, but dagre expects parent->child
// We reverse edges for layout so root appears at top
// Only use hierarchical edges for layout to ensure proper alignment
const getLayoutedElements = (
  nodes: Node[], 
  edges: Edge[], 
  nodeLevels: Map<string, number>
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Use TB (top to bottom) - root at top, children below
  // Increased spacing for better visual appearance
  dagreGraph.setGraph({ 
    rankdir: 'TB', 
    ranksep: 150,  // Vertical spacing between levels
    nodesep: 100,  // Horizontal spacing between nodes at same level
    edgesep: 50,   // Minimum edge length
    marginx: 50,   // Horizontal margin
    marginy: 50,   // Vertical margin
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 100 });
  });

  // Only use hierarchical edges for layout (exclude same-level connections)
  // This ensures children align properly under their parent
  edges.forEach((edge) => {
    const sourceLevel = nodeLevels.get(edge.source) || 1;
    const targetLevel = nodeLevels.get(edge.target) || 1;
    const isHierarchical = targetLevel < sourceLevel;
    
    // Only add hierarchical edges to dagre layout
    if (isHierarchical) {
      // Reverse edges for dagre (dagre expects parent->child, we have child->parent)
      // This makes parent appear above children
      dagreGraph.setEdge(edge.target, edge.source);
    }
  });

  dagre.layout(dagreGraph);

  // Post-process to ensure parents are above children and center children under parent
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const level = nodeLevels.get(node.id) || 1;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 50,
      },
      level, // Store level for sorting
    };
  });

  // Group nodes by level and ensure proper Y positioning
  const nodesByLevel = new Map<number, Node[]>();
  layoutedNodes.forEach(node => {
    const level = node.level || 1;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });

  // Ensure Y positions are correct: lower level = higher Y (top of screen)
  const levelSpacing = 150;
  const baseY = 50;
  nodesByLevel.forEach((levelNodes, level) => {
    const y = baseY + (level - 1) * levelSpacing;
    levelNodes.forEach(node => {
      node.position.y = y;
    });
  });

  // Center children under their parent for better alignment
  const nodeMap = new Map(layoutedNodes.map(n => [n.id, n]));
  const parentChildrenMap = new Map<string, string[]>();
  
  edges.forEach(edge => {
    const sourceLevel = nodeLevels.get(edge.source) || 1;
    const targetLevel = nodeLevels.get(edge.target) || 1;
    const isHierarchical = targetLevel < sourceLevel;
    
    if (isHierarchical) {
      const parentId = edge.target;
      const childId = edge.source;
      if (!parentChildrenMap.has(parentId)) {
        parentChildrenMap.set(parentId, []);
      }
      parentChildrenMap.get(parentId)!.push(childId);
    }
  });

  // Center children horizontally under their parent
  parentChildrenMap.forEach((children, parentId) => {
    const parentNode = nodeMap.get(parentId);
    if (!parentNode || children.length === 0) return;

    const childNodes = children
      .map(id => nodeMap.get(id))
      .filter((n): n is Node => n !== undefined);
    
    if (childNodes.length === 0) return;

    // Verify parent is above children
    const parentY = parentNode.position.y;
    childNodes.forEach(child => {
      if (child.position.y <= parentY) {
        // Force child below parent
        const childLevel = nodeLevels.get(child.id) || 1;
        child.position.y = baseY + (childLevel - 1) * levelSpacing;
      }
    });

    // Calculate total width of children
    const childWidth = 220; // node width
    const spacing = 100; // nodesep
    const totalWidth = (childNodes.length - 1) * spacing + childNodes.length * childWidth;
    
    // Center point of parent
    const parentCenterX = parentNode.position.x + 110;
    
    // Starting x position to center children
    const startX = parentCenterX - totalWidth / 2 + childWidth / 2;
    
    // Sort children by current x position to maintain order
    childNodes.sort((a, b) => a.position.x - b.position.x);
    
    // Reposition children to be centered under parent
    childNodes.forEach((child, index) => {
      child.position.x = startX + index * (childWidth + spacing) - 110;
    });
  });

  // Remove level property before returning (it was just for processing)
  const finalNodes = layoutedNodes.map(({ level, ...node }) => node);

  return { nodes: finalNodes, edges };
};

export const KnowledgeGraph = ({ nodes: graphNodes, edges: graphEdges, onNodeClick }: KnowledgeGraphProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Calculate node levels
  const nodeLevels = useMemo(() => calculateNodeLevels(graphNodes, graphEdges), [graphNodes, graphEdges]);

  // Get visible nodes based on level and expansion state
  const visibleNodeIds = useMemo(() => {
    if (showAll) {
      return new Set(graphNodes.map(n => n.id));
    }

    const visible = new Set<string>();
    
    // Always show level 1 and level 2 nodes by default
    graphNodes.forEach(node => {
      const level = nodeLevels.get(node.id) || 1;
      if (level === 1 || level === 2) {
        visible.add(node.id);
      }
    });

    // Add children of expanded nodes (beyond level 2)
    const addChildren = (nodeId: string) => {
      const children = getChildren(nodeId, graphEdges);
      children.forEach(childId => {
        visible.add(childId);
        // Recursively add children if parent is expanded
        if (expandedNodes.has(childId)) {
          addChildren(childId);
        }
      });
    };

    expandedNodes.forEach(nodeId => {
      addChildren(nodeId);
    });

    return visible;
  }, [graphNodes, graphEdges, nodeLevels, expandedNodes, showAll]);

  // Filter visible edges (only show edges between visible nodes)
  // Only show parent-child relationships, hide same-level connections
  const visibleEdges = useMemo(() => {
    return graphEdges.filter(edge => {
      // Only include if both nodes are visible
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
        return false;
      }
      
      // Only show hierarchical (parent-child) edges, not same-level connections
      const sourceLevel = nodeLevels.get(edge.source) || 1;
      const targetLevel = nodeLevels.get(edge.target) || 1;
      const isHierarchical = targetLevel < sourceLevel;
      
      return isHierarchical;
    });
  }, [graphEdges, visibleNodeIds, nodeLevels]);

  // Filter visible nodes
  const visibleNodes = useMemo(() => {
    return graphNodes.filter(node => visibleNodeIds.has(node.id));
  }, [graphNodes, visibleNodeIds]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    onNodeClick?.(node);

    // Toggle expansion of node's children
    const children = getChildren(node.id, graphEdges);
    if (children.length > 0) {
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        if (newSet.has(node.id)) {
          newSet.delete(node.id);
        } else {
          newSet.add(node.id);
        }
        return newSet;
      });
    }
  }, [onNodeClick, graphEdges]);

  useEffect(() => {
    // Convert graph nodes to React Flow nodes
    const flowNodes: Node[] = visibleNodes.map((node) => {
      const children = getChildren(node.id, graphEdges);
      const isExpanded = expandedNodes.has(node.id);
      return {
        id: node.id,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: { 
          ...node,
          level: nodeLevels.get(node.id) || 1,
          hasChildren: children.length > 0,
          isExpanded,
          onClick: () => handleNodeClick(node),
        },
      };
    });

    // Convert graph edges to React Flow edges
    // Determine edge type: parent->child (vertical) vs same-level (horizontal)
    const flowEdges: Edge[] = visibleEdges.map((edge, idx) => {
      const sourceLevel = nodeLevels.get(edge.source) || 1;
      const targetLevel = nodeLevels.get(edge.target) || 1;
      
      // If target level < source level, it's parent->child (hierarchical)
      // Since edges are child->parent, target is parent (higher up)
      const isHierarchical = targetLevel < sourceLevel;
      
      // For hierarchical edges: use straight (vertical) lines, connect top/bottom
      // For same-level edges: use step (horizontal) lines, connect left/right
      const edgeType = isHierarchical ? 'straight' : 'step';
      
      const baseStyle = {
        stroke: edge.strength > 0.7 ? '#667eea' : '#999',
        strokeWidth: Math.max(1, edge.strength * 3),
      };
      
      // For hierarchical edges, reverse source/target so line goes from parent (top) to child (bottom)
      // For same-level edges, keep original direction
      const reactFlowSource = isHierarchical ? edge.target : edge.source;
      const reactFlowTarget = isHierarchical ? edge.source : edge.target;
      
      return {
        id: `edge-${idx}`,
        source: reactFlowSource,
        target: reactFlowTarget,
        // For hierarchical: parent (source) is above, child (target) is below
        // Line starts at bottom of parent, ends at top of child
        // For same-level: use right->left handles
        sourceHandle: isHierarchical ? 'bottom' : 'right',
        targetHandle: isHierarchical ? 'top' : 'left',
        label: edge.relationship,
        type: edgeType,
        animated: edge.strength > 0.7,
        style: baseStyle,
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
        // For step edges (same-level), configure to be horizontal
        ...(edgeType === 'step' && {
          pathOptions: {
            borderRadius: 0,
          },
        }),
      };
    });

    // Apply layout (pass nodeLevels for filtering hierarchical edges)
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes, 
      flowEdges, 
      nodeLevels
    );
    
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // Fit view after layout is applied
    setTimeout(() => {
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ padding: 0.2, maxZoom: 1, duration: 300 });
      }
    }, 100);
  }, [visibleNodes, visibleEdges, handleNodeClick, nodeLevels]);

  const handleShowAll = useCallback(() => {
    setShowAll(prev => !prev);
    if (!showAll) {
      // When showing all, also expand all nodes
      setExpandedNodes(new Set(graphNodes.map(n => n.id)));
    } else {
      // When hiding all, reset to level 1 and 2 only
      setExpandedNodes(new Set());
    }
  }, [showAll, graphNodes]);

  return (
    <div className="knowledge-graph-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          instance.fitView({ padding: 0.2, maxZoom: 1 });
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
      </ReactFlow>

      {/* Show All Button */}
      <button 
        className="show-all-button"
        onClick={handleShowAll}
        title={showAll ? "Show only level 1 and 2 nodes" : "Show all nodes"}
      >
        {showAll ? "Show Level 1-2 Only" : "Show All Nodes"}
      </button>

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

