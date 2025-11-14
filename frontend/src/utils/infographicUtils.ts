import { KnowledgeGraph } from '../types/graph';

export interface GraphInsights {
  totalFindings: number;
  topFindings: Array<{
    label: string;
    summary: string;
    impactScore: number;
    category: string;
  }>;
  keyRelationships: Array<{
    source: string;
    target: string;
    relationship: string;
    strength: number;
  }>;
  positiveFactors: number;
  negativeFactors: number;
  neutralFactors: number;
  averageImpact: number;
  topCategories: Array<{ category: string; count: number }>;
}

/**
 * Extract key business insights from a knowledge graph
 */
export function extractGraphInsights(graph: KnowledgeGraph): GraphInsights {
  const { nodes, edges } = graph;

  // Top findings by absolute impact score (excluding central topic)
  const topFindings = [...nodes]
    .filter(n => n.category !== 'central')
    .sort((a, b) => Math.abs(b.impactScore) - Math.abs(a.impactScore))
    .slice(0, 5)
    .map(node => ({
      label: node.label,
      summary: node.summary,
      impactScore: node.impactScore,
      category: node.category,
    }));

  // Top categories
  const categoryMap = new Map<string, number>();
  nodes.forEach(node => {
    if (node.category !== 'central') {
      categoryMap.set(node.category, (categoryMap.get(node.category) || 0) + 1);
    }
  });
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Key relationships
  const keyRelationships = [...edges]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
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
  const nonCentralNodes = nodes.filter(n => n.category !== 'central');
  const averageImpact = nonCentralNodes.length > 0
    ? nonCentralNodes.reduce((sum, node) => sum + node.impactScore, 0) / nonCentralNodes.length
    : 0;

  const positiveFactors = nonCentralNodes.filter(n => n.impactScore > 0).length;
  const negativeFactors = nonCentralNodes.filter(n => n.impactScore < 0).length;
  const neutralFactors = nonCentralNodes.filter(n => n.impactScore === 0).length;

  return {
    totalFindings: nodes.length - 1, // Exclude central topic
    topFindings,
    keyRelationships,
    positiveFactors,
    negativeFactors,
    neutralFactors,
    averageImpact,
    topCategories,
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

