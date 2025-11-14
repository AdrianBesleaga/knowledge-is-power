import axios from 'axios';
import { KnowledgeGraph, GraphNode, GraphEdge } from '../types/graph';

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
  isPublic: boolean = true
): Promise<{
  success: boolean;
  graph: KnowledgeGraph;
  url: string;
}> => {
  const response = await api.post('/api/graph/save', {
    topic,
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

