import { KnowledgeGraph, GraphNode, GraphEdge } from '../types/graph';

export interface GraphInsights {
  totalNodes: number;
  totalEdges: number;
  topNodesByImpact: GraphNode[];
  categories: { category: string; count: number }[];
  strongestRelationships: Array<{
    source: string;
    target: string;
    relationship: string;
    strength: number;
  }>;
  averageImpactScore: number;
  positiveNodes: number;
  negativeNodes: number;
  neutralNodes: number;
}

/**
 * Extract key insights from a knowledge graph
 */
export function extractGraphInsights(graph: KnowledgeGraph): GraphInsights {
  const { nodes, edges } = graph;

  // Top nodes by absolute impact score
  const topNodesByImpact = [...nodes]
    .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
    .slice(0, 5);

  // Category distribution
  const categoryMap = new Map<string, number>();
  nodes.forEach(node => {
    categoryMap.set(node.category, (categoryMap.get(node.category) || 0) + 1);
  });
  const categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Strongest relationships
  const strongestRelationships = [...edges]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5)
    .map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      return {
        source: sourceNode?.label || edge.source,
        target: targetNode?.label || edge.target,
        relationship: edge.relationship,
        strength: edge.strength,
      };
    });

  // Impact statistics
  const averageImpactScore = nodes.length > 0
    ? nodes.reduce((sum, node) => sum + node.impactScore, 0) / nodes.length
    : 0;

  const positiveNodes = nodes.filter(n => n.impactScore > 0 && n.category !== 'central').length;
  const negativeNodes = nodes.filter(n => n.impactScore < 0).length;
  const neutralNodes = nodes.filter(n => n.impactScore === 0 && n.category !== 'central').length;

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    topNodesByImpact,
    categories,
    strongestRelationships,
    averageImpactScore,
    positiveNodes,
    negativeNodes,
    neutralNodes,
  };
}

/**
 * Format impact score for display
 */
export function formatImpactScore(score: number): string {
  const percentage = (score * 100).toFixed(0);
  return score >= 0 ? `+${percentage}%` : `${percentage}%`;
}

/**
 * Get color for impact score
 */
export function getImpactColor(score: number, category?: string): string {
  if (category === 'central') return '#667eea';
  if (score > 0) return '#10b981';
  if (score < 0) return '#ef4444';
  return '#9ca3af';
}

