export interface GraphNode {
  id: string;
  label: string;
  summary: string;
  sources: string[];
  impactScore: number;
  category: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  strength: number;
}

export interface KnowledgeGraph {
  id: string;
  slug: string;
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: string;
  userId: string | null;
  isPublic: boolean;
  viewCount: number;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

