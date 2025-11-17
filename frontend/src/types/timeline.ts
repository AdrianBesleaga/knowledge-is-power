// Timeline types for frontend
export type GraphVisibility = 'private' | 'public' | 'premium';
export type ValueDirection = 'higher_is_better' | 'lower_is_better' | 'neutral';

export interface TimelineEntry {
  date: string; // ISO date string
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
  valueDirection: ValueDirection; // Whether higher or lower values are better
  pastEntries: TimelineEntry[]; // Up to 10 years back
  presentEntry: TimelineEntry; // Current state
  predictions: Prediction[]; // Fixed intervals: 1m, 1y, 2y-10y
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  userId: string | null;
  visibility: GraphVisibility;
  viewCount: number;
  version?: number; // Version number (defaults to 1)
}

export interface TimelineVersion {
  version: number;
  createdAt: string; // ISO date string
  presentValue: number;
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

