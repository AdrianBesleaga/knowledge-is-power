import axios from 'axios';
import { KnowledgeGraph, GraphNode, GraphEdge } from '../types/graph';
import { TimelineAnalysis, TimelineEntry, Prediction } from '../types/timeline';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const generateGraph = async (topic: string): Promise<{
  topic: string;
  summary: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}> => {
  const response = await api.post('/api/graph/generate', { topic });
  return response.data;
};

export const saveGraph = async (
  topic: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  isPublic: boolean = true,
  summary: string = ''
): Promise<{
  success: boolean;
  graph: KnowledgeGraph;
  url: string;
}> => {
  const response = await api.post('/api/graph/save', {
    topic,
    summary,
    nodes,
    edges,
    isPublic,
  });
  return response.data;
};

export const getGraphBySlug = async (slug: string): Promise<KnowledgeGraph> => {
  const response = await api.get(`/api/graph/${slug}`);
  return response.data.graph;
};

export const getUserGraphs = async (): Promise<KnowledgeGraph[]> => {
  const response = await api.get('/api/user/graphs');
  return response.data.graphs;
};

export const getUserProfile = async (): Promise<{
  uid: string;
  email: string;
}> => {
  const response = await api.get('/api/user/profile');
  return response.data.user;
};

export interface SearchGraphsResponse {
  success: boolean;
  graphs: KnowledgeGraph[];
  total: number;
  limit: number;
  offset: number;
}

export interface SearchNodesResponse {
  success: boolean;
  nodes: GraphNode[];
  graphs: string[];
}

export const searchGraphs = async (
  query: string,
  limit: number = 20,
  offset: number = 0,
  userId?: string
): Promise<SearchGraphsResponse> => {
  const params: any = { q: query, limit, offset };
  if (userId) {
    params.userId = userId;
  }
  const response = await api.get('/api/graph/search', { params });
  return response.data;
};

export const searchNodes = async (
  query: string,
  category?: string,
  limit: number = 50
): Promise<SearchNodesResponse> => {
  const params: any = { q: query, limit };
  if (category) {
    params.category = category;
  }
  const response = await api.get('/api/graph/search/nodes', { params });
  return response.data;
};

export const getRelatedGraphs = async (
  slug: string,
  limit: number = 10
): Promise<{ success: boolean; graphs: KnowledgeGraph[] }> => {
  const response = await api.get(`/api/graph/${slug}/related`, {
    params: { limit },
  });
  return response.data;
};

export const getGraphsByCategory = async (
  category: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchGraphsResponse> => {
  const response = await api.get(`/api/graph/category/${category}`, {
    params: { limit, offset },
  });
  return response.data;
};

export const getPopularGraphs = async (
  limit: number = 20,
  days: number = 30
): Promise<{ success: boolean; graphs: KnowledgeGraph[] }> => {
  const response = await api.get('/api/graph/popular', {
    params: { limit, days },
  });
  return response.data;
};

export const updateGraphVisibility = async (
  slug: string,
  isPublic: boolean
): Promise<{ success: boolean; graph: KnowledgeGraph }> => {
  const response = await api.patch(`/api/graph/${slug}/visibility`, {
    isPublic,
  });
  return response.data;
};

// Timeline API methods
export const generateTimeline = async (topic: string): Promise<{
  success: boolean;
  topic: string;
  valueLabel: string;
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
}> => {
  const response = await api.post('/api/timeline/generate', { topic });
  return response.data;
};

export const saveTimeline = async (
  topic: string,
  valueLabel: string,
  pastEntries: TimelineEntry[],
  presentEntry: TimelineEntry,
  predictions: Prediction[],
  isPublic: boolean = false
): Promise<{
  success: boolean;
  timeline: TimelineAnalysis;
  url: string;
}> => {
  const response = await api.post('/api/timeline/save', {
    topic,
    valueLabel,
    pastEntries,
    presentEntry,
    predictions,
    isPublic,
  });
  return response.data;
};

export const getTimelineBySlug = async (slug: string): Promise<TimelineAnalysis> => {
  const response = await api.get(`/api/timeline/${slug}`);
  return response.data.timeline;
};

export const getTimelineByTopic = async (
  topic: string,
  limit: number = 20,
  offset: number = 0
): Promise<{
  success: boolean;
  timelines: TimelineAnalysis[];
  total: number;
  limit: number;
  offset: number;
}> => {
  const response = await api.get(`/api/timeline/topic/${encodeURIComponent(topic)}`, {
    params: { limit, offset },
  });
  return response.data;
};

export const updateTimelineVisibility = async (
  slug: string,
  isPublic: boolean
): Promise<{ success: boolean; timeline: TimelineAnalysis }> => {
  const response = await api.patch(`/api/timeline/${slug}/visibility`, {
    isPublic,
  });
  return response.data;
};

export const reprocessTimeline = async (
  slug: string
): Promise<{
  success: boolean;
  timeline: TimelineAnalysis;
  previousValue: number;
  newValue: number;
  valueChange: number;
}> => {
  const response = await api.post(`/api/timeline/${slug}/reprocess`);
  return response.data;
};

