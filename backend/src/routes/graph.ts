import { Router, Response } from 'express';
import { aiService } from '../services/aiService';
import { graphService } from '../services/graphService';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';
import { GenerateGraphRequest, SaveGraphRequest } from '../types';

const router = Router();

/**
 * POST /api/graph/generate
 * Generate a knowledge graph from a topic (no auth required)
 */
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { topic } = req.body as GenerateGraphRequest;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({ error: 'Topic is required' });
      return;
    }

    if (topic.length > 200) {
      res.status(400).json({ error: 'Topic is too long (max 200 characters)' });
      return;
    }

    // Generate knowledge graph using AI
    const result = await aiService.generateKnowledgeGraph(topic.trim());

    res.json({
      success: true,
      topic: topic.trim(),
      nodes: result.nodes,
      edges: result.edges,
    });
  } catch (error) {
    console.error('Error generating graph:', error);
    res.status(500).json({ 
      error: 'Failed to generate knowledge graph',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/graph/save
 * Save a knowledge graph (requires authentication)
 */
router.post('/save', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, nodes, edges, isPublic } = req.body as SaveGraphRequest;

    if (!topic || !nodes || !edges) {
      res.status(400).json({ error: 'Topic, nodes, and edges are required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Save to Neo4j
    const savedGraph = await graphService.saveGraph(
      topic,
      nodes,
      edges,
      req.user.uid,
      isPublic !== false // Default to true
    );

    res.json({
      success: true,
      graph: savedGraph,
      url: `/graph/${savedGraph.slug}`,
    });
  } catch (error) {
    console.error('Error saving graph:', error);
    res.status(500).json({ 
      error: 'Failed to save knowledge graph',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/graph/:slug
 * Retrieve a knowledge graph by slug (public, optional auth)
 */
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    const graph = await graphService.getGraphBySlug(slug);

    if (!graph) {
      res.status(404).json({ error: 'Knowledge graph not found' });
      return;
    }

    // Check if graph is public or belongs to the requesting user
    if (!graph.isPublic && (!req.user || req.user.uid !== graph.userId)) {
      res.status(403).json({ error: 'Access denied to private graph' });
      return;
    }

    res.json({
      success: true,
      graph,
    });
  } catch (error) {
    console.error('Error retrieving graph:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve knowledge graph',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

