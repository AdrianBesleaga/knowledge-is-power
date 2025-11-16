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

export type GraphVisibility = 'private' | 'public' | 'premium';

export interface KnowledgeGraph {
  id: string;
  slug: string;
  topic: string;
  label: string;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: Date;
  userId: string | null;
  visibility: GraphVisibility;
  viewCount: number;
}

export interface GenerateGraphRequest {
  topic: string;
}

export interface SaveGraphRequest {
  topic: string;
  summary?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  visibility: GraphVisibility;
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

// Timeline types
export interface TimelineEntry {
  date: Date;
  value: number;
  valueLabel: string; // e.g., "Price (USD)", "Population"
  summary: string;
  sources: string[];
}

export interface PredictionScenario {
  id: string;
  title: string; // e.g., "Bullish", "Bearish", "Neutral"
  summary: string;
  sources: string[];
  confidenceScore: number; // 0-100
  predictedValue?: number; // Optional predicted value for this scenario
}

export interface Prediction {
  timeline: string; // e.g., "1 month", "1 year", "2 years", etc.
  scenarios: PredictionScenario[]; // Minimum 3 scenarios
}

export interface TimelineAnalysis {
  id: string;
  slug: string;
  topic: string;
  valueLabel: string; // Auto-detected value label
  pastEntries: TimelineEntry[]; // Up to 10 years back
  presentEntry: TimelineEntry; // Current state
  predictions: Prediction[]; // Fixed intervals: 1m, 1y, 2y-10y
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  visibility: GraphVisibility;
  viewCount: number;
  version?: number; // Version number (defaults to 1)
}

export interface GenerateTimelineRequest {
  topic: string;
}

export interface SaveTimelineRequest {
  topic: string;
  valueLabel: string;
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
  visibility?: GraphVisibility;
}

