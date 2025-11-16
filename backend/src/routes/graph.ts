import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { graphService } from '../services/graphService';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';
import { GenerateGraphRequest, SaveGraphRequest } from '../types';
import { getNeo4jDriver } from '../config/neo4j';
import { creditService, InsufficientCreditsError } from '../services/creditService';

const router = Router();

/**
 * POST /api/graph/generate
 * Generate a knowledge graph from a topic (requires authentication)
 * Costs 1 credit per generation
 */
router.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
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

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Ensure user exists in database
    await creditService.getOrCreateUser(req.user.uid, req.user.email || '');

    // Check and deduct credits (1 credit per graph generation)
    try {
      const remainingCredits = await creditService.deductCredits(
        req.user.uid,
        1,
        `Generated graph: "${topic.trim()}"`
      );
      console.log(`[API] Credit deducted for user ${req.user.uid}. Remaining: ${remainingCredits}`);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: error.message,
          code: 'INSUFFICIENT_CREDITS'
        });
        return;
      }
      throw error;
    }

    console.log(`[API] Graph generation request received for topic: "${topic.trim()}" by user: ${req.user.uid}`);

    // Generate knowledge graph using AI (fixed to 3 levels)
    const result = await aiService.generateKnowledgeGraph(topic.trim());

    console.log(`[API] Graph generation completed successfully: ${result.nodes.length} nodes, ${result.edges.length} edges`);

    res.json({
      success: true,
      topic: topic.trim(),
      summary: result.summary,
      nodes: result.nodes,
      edges: result.edges,
    });
  } catch (error) {
    console.error('[API] Error generating graph:', error);
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
    const { topic, summary, nodes, edges, visibility } = req.body as SaveGraphRequest;

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
      visibility || 'private', // Default to private
      summary || ''
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
 * Debug endpoint handler to check database connection and get basic stats
 */
const debugStatsHandler = async (req: Request, res: Response) => {
  try {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      // Check connection and get graph count
      const result = await session.run(
        `
        MATCH (g:Graph)
        RETURN count(g) as totalGraphs
        `
      );

      const totalGraphs = result.records[0]?.get('totalGraphs').toNumber() || 0;

      // Get sample slugs
      const sampleResult = await session.run(
        `
        MATCH (g:Graph)
        RETURN g.slug as slug
        LIMIT 5
        `
      );

      const sampleSlugs = sampleResult.records.map(record => record.get('slug'));

      res.json({
        success: true,
        connected: true,
        totalGraphs,
        sampleSlugs,
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('[API] Debug stats error:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/graph/debug/stats
 * GET /api/graph/debug/status
 * Debug endpoint to check database connection and get basic stats
 */
router.get('/debug/stats', debugStatsHandler);
router.get('/debug/status', debugStatsHandler);

/**
 * GET /api/graph/search
 * Search graphs by query (public, optional auth)
 */
router.get('/search', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit, offset, userId } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      res.status(400).json({ error: 'Search query (q) is required' });
      return;
    }

    const searchLimit = limit ? Math.floor(Number(limit)) || 20 : 20;
    const searchOffset = offset ? Math.floor(Number(offset)) || 0 : 0;
    const searchUserId = userId === 'me' && req.user ? req.user.uid : null;

    const result = await graphService.searchGraphs(
      q.trim(),
      searchUserId,
      searchLimit,
      searchOffset
    );

    res.json({
      success: true,
      graphs: result.graphs,
      total: result.total,
      limit: searchLimit,
      offset: searchOffset,
    });
  } catch (error) {
    console.error('Error searching graphs:', error);
    res.status(500).json({ 
      error: 'Failed to search knowledge graphs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/graph/search/nodes
 * Search nodes across all graphs
 */
router.get('/search/nodes', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { q, category, limit } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      res.status(400).json({ error: 'Search query (q) is required' });
      return;
    }

    const searchLimit = limit ? Math.floor(Number(limit)) || 50 : 50;
    const searchCategory = category && typeof category === 'string' ? category : undefined;

    const result = await graphService.searchNodes(
      q.trim(),
      searchCategory,
      searchLimit
    );

    res.json({
      success: true,
      nodes: result.nodes,
      graphs: result.graphs,
    });
  } catch (error) {
    console.error('Error searching nodes:', error);
    res.status(500).json({ 
      error: 'Failed to search nodes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/graph/:slug/related
 * Find related graphs using graph traversal
 */
router.get('/:slug/related', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { limit } = req.query;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    console.log(`[API] Related graphs request for slug: "${slug}"`);
    // First get the graph to find its ID
    const graph = await graphService.getGraphBySlug(slug);
    if (!graph) {
      console.log(`[API] Graph not found for slug: "${slug}"`);
      res.status(404).json({ error: 'Knowledge graph not found' });
      return;
    }

    const relatedLimit = limit ? Math.floor(Number(limit)) || 10 : 10;
    const relatedGraphs = await graphService.findRelatedGraphs(graph.id, relatedLimit);

    res.json({
      success: true,
      graphs: relatedGraphs,
    });
  } catch (error) {
    console.error('Error finding related graphs:', error);
    res.status(500).json({ 
      error: 'Failed to find related graphs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/graph/category/:category
 * Get graphs by category
 */
router.get('/category/:category', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.params;
    const { limit, offset } = req.query;

    if (!category) {
      res.status(400).json({ error: 'Category is required' });
      return;
    }

    const searchLimit = limit ? Math.floor(Number(limit)) || 20 : 20;
    const searchOffset = offset ? Math.floor(Number(offset)) || 0 : 0;

    const result = await graphService.getGraphsByCategory(
      category,
      searchLimit,
      searchOffset
    );

    res.json({
      success: true,
      graphs: result.graphs,
      total: result.total,
      limit: searchLimit,
      offset: searchOffset,
    });
  } catch (error) {
    console.error('Error getting graphs by category:', error);
    res.status(500).json({ 
      error: 'Failed to get graphs by category',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/graph/popular
 * Get popular graphs based on view count
 */
router.get('/popular', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { limit, days } = req.query;

    const searchLimit = limit ? Math.floor(Number(limit)) || 20 : 20;
    const searchDays = days ? Math.floor(Number(days)) || 30 : 30;

    const graphs = await graphService.getPopularGraphs(searchLimit, searchDays);

    res.json({
      success: true,
      graphs,
    });
  } catch (error) {
    console.error('Error getting popular graphs:', error);
    res.status(500).json({ 
      error: 'Failed to get popular graphs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/graph/:slug/visibility
 * Update graph visibility (requires authentication, owner only)
 */
router.patch('/:slug/visibility', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { visibility } = req.body;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (!visibility || !['private', 'public', 'premium'].includes(visibility)) {
      res.status(400).json({ error: 'visibility must be one of: private, public, premium' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const updatedGraph = await graphService.updateGraphVisibility(
      slug,
      req.user.uid,
      visibility as 'private' | 'public' | 'premium'
    );

    if (!updatedGraph) {
      res.status(404).json({ error: 'Graph not found or access denied' });
      return;
    }

    res.json({
      success: true,
      graph: updatedGraph,
    });
  } catch (error) {
    console.error('Error updating graph visibility:', error);
    res.status(500).json({ 
      error: 'Failed to update graph visibility',
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

    console.log(`[API] Graph retrieval request for slug: "${slug}"`);
    const graph = await graphService.getGraphBySlug(slug);

    if (!graph) {
      console.log(`[API] Graph not found for slug: "${slug}"`);
      res.status(404).json({ error: 'Knowledge graph not found' });
      return;
    }

    // Check visibility permissions
    if (graph.visibility === 'private' && (!req.user || req.user.uid !== graph.userId)) {
      res.status(403).json({ error: 'Access denied to private graph' });
      return;
    }

    // For premium graphs, check if user has paid or owns the graph
    if (graph.visibility === 'premium' && (!req.user || req.user.uid !== graph.userId)) {
      // TODO: Check if user has already paid for this specific graph view
      // For now, return a "payment required" response
      res.status(402).json({
        error: 'Premium content requires payment',
        message: 'This premium graph requires 1 credit to view',
        code: 'PREMIUM_CONTENT',
        graph: {
          id: graph.id,
          slug: graph.slug,
          topic: graph.topic,
          summary: graph.summary,
          visibility: graph.visibility,
          viewCount: graph.viewCount,
          userId: graph.userId,
          createdAt: graph.createdAt,
          nodes: graph.nodes, // Include nodes for blurred preview
          edges: graph.edges, // Include edges for blurred preview
        }
      });
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

/**
 * POST /api/graph/:slug/unlock
 * Pay 1 credit to unlock premium graph content (requires authentication)
 */
router.post('/:slug/unlock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      res.status(400).json({ error: 'Slug is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    console.log(`[API] Premium graph unlock request for slug: "${slug}" by user: ${req.user.uid}`);

    // Get the graph first to verify it exists and is premium
    const graph = await graphService.getGraphBySlug(slug);

    if (!graph) {
      console.log(`[API] Graph not found for slug: "${slug}"`);
      res.status(404).json({ error: 'Knowledge graph not found' });
      return;
    }

    if (graph.visibility !== 'premium') {
      res.status(400).json({ error: 'This graph is not premium content' });
      return;
    }

    if (graph.userId === req.user.uid) {
      // Owner can access without payment
      res.json({
        success: true,
        graph,
      });
      return;
    }

    // Deduct 1 credit for premium content access
    try {
      const remainingCredits = await creditService.deductCredits(
        req.user.uid,
        1,
        `Unlocked premium graph: "${graph.topic}"`
      );
      console.log(`[API] Credit deducted for premium graph unlock. Remaining: ${remainingCredits}`);
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        res.status(402).json({
          error: 'Insufficient credits',
          message: error.message,
          code: 'INSUFFICIENT_CREDITS'
        });
        return;
      }
      throw error;
    }

    // Return the full graph content
    res.json({
      success: true,
      graph,
    });
  } catch (error) {
    console.error('Error unlocking premium graph:', error);
    res.status(500).json({
      error: 'Failed to unlock premium graph',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

