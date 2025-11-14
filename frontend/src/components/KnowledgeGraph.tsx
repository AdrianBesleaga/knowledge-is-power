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
export const calculateNodeLevels = (nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> => {
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

// Custom hierarchical layout - much simpler and more predictable than dagre
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  nodeLevels: Map<string, number>
) => {
  const parentChildrenMap = new Map<string, string[]>();

  // Build parent-children relationships
  // Note: React Flow edges are reversed for hierarchical relationships
  // For hierarchical: source = parent (lower level), target = child (higher level)
  edges.forEach(edge => {
    const sourceLevel = nodeLevels.get(edge.source) || 1;
    const targetLevel = nodeLevels.get(edge.target) || 1;
    const isHierarchical = sourceLevel < targetLevel; // Parent level < child level

    if (isHierarchical) {
      const parentId = edge.source; // In reversed edges, source is parent
      const childId = edge.target;  // In reversed edges, target is child
      if (!parentChildrenMap.has(parentId)) {
        parentChildrenMap.set(parentId, []);
      }
      parentChildrenMap.get(parentId)!.push(childId);
    }
  });

  // Group nodes by level
  const nodesByLevel = new Map<number, Node[]>();
  nodes.forEach(node => {
    const level = nodeLevels.get(node.id) || 1;
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }
    nodesByLevel.get(level)!.push(node);
  });

  const levelSpacing = 250; // Increased spacing between parent and child levels
  const baseY = 50;
  const nodeWidth = 220;
  const childSpacing = 150; // Spacing between children of the same parent

  // First, position level 1 nodes (root/central nodes)
  const level1Nodes = nodesByLevel.get(1) || [];
  if (level1Nodes.length > 0) {
    const y = baseY;
    const spacing = 100;
    const totalWidth = (level1Nodes.length - 1) * spacing + level1Nodes.length * nodeWidth;
    const startX = -totalWidth / 2 + nodeWidth / 2;

    level1Nodes.forEach((node, index) => {
      const centerX = startX + index * (nodeWidth + spacing);
      node.position = {
        x: centerX - 110, // Center the node
        y: y
      };
    });
  }

  // Position children centered below their parents
  // Process levels from top to bottom
  for (let level = 2; level <= Math.max(...Array.from(nodesByLevel.keys())); level++) {
    const levelNodes = nodesByLevel.get(level) || [];
    if (levelNodes.length === 0) continue;

    const y = baseY + (level - 1) * levelSpacing;

    // Group children by their parent using the parentChildrenMap we built
    const childrenByParent = new Map<string, Node[]>();
    levelNodes.forEach(node => {
      // Find which parent this node belongs to by checking parentChildrenMap
      let foundParent = false;
      for (const [parentId, childIds] of parentChildrenMap.entries()) {
        if (childIds.includes(node.id)) {
          if (!childrenByParent.has(parentId)) {
            childrenByParent.set(parentId, []);
          }
          childrenByParent.get(parentId)!.push(node);
          foundParent = true;
          break;
        }
      }
      
      if (!foundParent) {
        // If no parent found, treat as orphan (shouldn't happen, but handle gracefully)
        if (!childrenByParent.has('orphan')) {
          childrenByParent.set('orphan', []);
        }
        childrenByParent.get('orphan')!.push(node);
      }
    });

    // Position children centered below their parent
    childrenByParent.forEach((children, parentId) => {
      if (parentId === 'orphan') {
        // Handle orphan nodes by centering them
        const totalWidth = (children.length - 1) * childSpacing + children.length * nodeWidth;
        const startX = -totalWidth / 2 + nodeWidth / 2;
        children.forEach((child, index) => {
          const centerX = startX + index * (nodeWidth + childSpacing);
          child.position = {
            x: centerX - 110,
            y: y
          };
        });
      } else {
        // Find parent node to get its position
        const parentNode = nodes.find(n => n.id === parentId);
        if (parentNode && parentNode.position) {
          const parentCenterX = parentNode.position.x + nodeWidth / 2;
          
          // Calculate total width needed for children
          const totalWidth = (children.length - 1) * childSpacing + children.length * nodeWidth;
          // Start position so that children are centered below parent
          const startX = parentCenterX - totalWidth / 2;

          // Position children centered below parent
          children.forEach((child, index) => {
            const childCenterX = startX + index * (nodeWidth + childSpacing) + nodeWidth / 2;
            child.position = {
              x: childCenterX - nodeWidth / 2, // Position so center is at childCenterX
              y: y
            };
          });
        }
      }
    });
  }

  return { nodes, edges };
};

export const KnowledgeGraph = ({ nodes: graphNodes, edges: graphEdges }: KnowledgeGraphProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
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
    // Disabled: onNodeClick?.(node); // Pop-up disabled - only hover tooltip shows info

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
  }, [graphEdges]);

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

    // Fit view to show all nodes on initial load
    setTimeout(() => {
      if (reactFlowInstance.current && layoutedNodes.length > 0) {
        // Fit all nodes in view with padding
        reactFlowInstance.current.fitView({
          padding: 0.1, // Less padding to show more content
          maxZoom: 1.2,  // Allow slight zoom in
          duration: 300
        });
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
          // Initial fit will be handled in useEffect after layout
        }}
        minZoom={0.1}
        maxZoom={2}
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

