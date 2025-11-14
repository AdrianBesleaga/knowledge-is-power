export interface GraphNode {
  id: string;
  label: string;
  summary: string;
  sources: string[];
  impactScore: number; // -1 to 1 (negative to positive impact)
  category: string; // e.g., "news", "social", "economic", "technical"
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number; // 0 to 1
}

export interface KnowledgeGraph {
  id: string;
  slug: string;
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: Date;
  userId: string | null;
  isPublic: boolean;
  viewCount: number;
}

export interface GenerateGraphRequest {
  topic: string;
}

export interface SaveGraphRequest {
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  isPublic: boolean;
}

export interface AIFactorAnalysis {
  factors: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    sources: string[];
    impactScore: number;
  }>;
  relationships: Array<{
    from: string;
    to: string;
    relationship: string;
    strength: number;
  }>;
}

