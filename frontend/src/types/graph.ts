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

export type GraphVisibility = 'private' | 'public' | 'premium';

export interface KnowledgeGraph {
  id: string;
  slug: string;
  topic: string;
  label: string;
  summary?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: string;
  userId: string | null;
  visibility: GraphVisibility;
  viewCount: number;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

