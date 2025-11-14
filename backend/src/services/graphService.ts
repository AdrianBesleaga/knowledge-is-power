import neo4j from 'neo4j-driver';
import { getNeo4jDriver } from '../config/neo4j';
import { KnowledgeGraph, GraphNode, GraphEdge } from '../types';
import { generateSlug } from '../utils/slugify';

export class GraphService {
  /**
   * Save a knowledge graph to Neo4j
   */
  async saveGraph(
    topic: string,
    nodes: GraphNode[],
    edges: GraphEdge[],
    userId: string | null,
    isPublic: boolean = true,
    summary: string = ''
  ): Promise<KnowledgeGraph> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const slug = generateSlug(topic);
      const graphId = slug; // Use slug as ID for simplicity
      const createdAt = new Date();

      // Create graph metadata node
      // Store createdAt as ISO string for easier retrieval
      await session.run(
        `
        CREATE (g:Graph {
          id: $id,
          slug: $slug,
          topic: $topic,
          label: $label,
          summary: $summary,
          userId: $userId,
          isPublic: $isPublic,
          viewCount: 0,
          createdAt: $createdAt
        })
        RETURN g
        `,
        {
          id: graphId,
          slug,
          topic,
          label: graphId,
          summary: summary || '',
          userId,
          isPublic,
          viewCount: neo4j.int(0),
          createdAt: createdAt.toISOString(),
        }
      );

      // Create nodes
      for (const node of nodes) {
        await session.run(
          `
          MATCH (g:Graph {id: $graphId})
          CREATE (n:Node {
            id: $id,
            label: $label,
            summary: $summary,
            sources: $sources,
            impactScore: $impactScore,
            category: $category
          })
          CREATE (g)-[:HAS_NODE]->(n)
          RETURN n
          `,
          {
            graphId,
            id: node.id,
            label: node.label,
            summary: node.summary,
            sources: node.sources,
            impactScore: node.impactScore,
            category: node.category,
          }
        );
      }

      // Create edges
      for (const edge of edges) {
        await session.run(
          `
          MATCH (g:Graph {id: $graphId})
          MATCH (g)-[:HAS_NODE]->(source:Node {id: $sourceId})
          MATCH (g)-[:HAS_NODE]->(target:Node {id: $targetId})
          CREATE (source)-[r:RELATES_TO {
            relationship: $relationship,
            strength: $strength
          }]->(target)
          RETURN r
          `,
          {
            graphId,
            sourceId: edge.source,
            targetId: edge.target,
            relationship: edge.relationship,
            strength: edge.strength,
          }
        );
      }

      return {
        id: graphId,
        slug,
        topic,
        label: graphId,
        summary: summary || '',
        nodes,
        edges,
        createdAt,
        userId,
        isPublic,
        viewCount: 0,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Retrieve a knowledge graph by slug
   */
  async getGraphBySlug(slug: string): Promise<KnowledgeGraph | null> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      // Get graph metadata
      const graphResult = await session.run(
        `
        MATCH (g:Graph {slug: $slug})
        RETURN g
        `,
        { slug }
      );

      if (graphResult.records.length === 0) {
        return null;
      }

      const graphNode = graphResult.records[0].get('g');
      const graphProps = graphNode.properties;

      // Increment view count
      await session.run(
        `
        MATCH (g:Graph {slug: $slug})
        SET g.viewCount = g.viewCount + 1
        `,
        { slug }
      );

      // Get nodes
      const nodesResult = await session.run(
        `
        MATCH (g:Graph {slug: $slug})-[:HAS_NODE]->(n:Node)
        RETURN n
        `,
        { slug }
      );

      const nodes: GraphNode[] = nodesResult.records.map((record) => {
        const node = record.get('n').properties;
        // Convert BigInt to Number for impactScore
        const impactScore = typeof node.impactScore === 'bigint' 
          ? Number(node.impactScore) 
          : (node.impactScore !== undefined && node.impactScore !== null ? Number(node.impactScore) : 0);
        
        return {
          id: node.id,
          label: node.label,
          summary: node.summary,
          sources: node.sources || [],
          impactScore,
          category: node.category,
        };
      });

      // Get edges
      const edgesResult = await session.run(
        `
        MATCH (g:Graph {slug: $slug})-[:HAS_NODE]->(source:Node)
        MATCH (source)-[r:RELATES_TO]->(target:Node)
        RETURN source.id as sourceId, target.id as targetId, r
        `,
        { slug }
      );

      const edges: GraphEdge[] = edgesResult.records.map((record) => {
        const rel = record.get('r').properties;
        // Convert BigInt to Number for strength
        const strength = typeof rel.strength === 'bigint' 
          ? Number(rel.strength) 
          : (rel.strength !== undefined && rel.strength !== null ? Number(rel.strength) : 0);
        
        return {
          source: record.get('sourceId'),
          target: record.get('targetId'),
          relationship: rel.relationship,
          strength,
        };
      });

      // Convert BigInt to Number for viewCount - handle all cases
      let viewCount: number;
      if (graphProps.viewCount === undefined || graphProps.viewCount === null) {
        viewCount = 0;
      } else if (typeof graphProps.viewCount === 'bigint') {
        viewCount = Number(graphProps.viewCount);
      } else {
        viewCount = Number(graphProps.viewCount);
      }
      
      // Handle datetime conversion - Neo4j datetime can be a string or object
      let createdAt: Date;
      if (typeof graphProps.createdAt === 'string') {
        createdAt = new Date(graphProps.createdAt);
      } else if (graphProps.createdAt && typeof graphProps.createdAt.toString === 'function') {
        createdAt = new Date(graphProps.createdAt.toString());
      } else {
        createdAt = new Date();
      }

      return {
        id: graphProps.id,
        slug: graphProps.slug,
        topic: graphProps.topic,
        label: graphProps.label || graphProps.id,
        summary: graphProps.summary || '',
        nodes,
        edges,
        createdAt,
        userId: graphProps.userId,
        isPublic: graphProps.isPublic,
        viewCount: viewCount + 1, // Include the increment we just did
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get all graphs for a user
   */
  async getUserGraphs(userId: string): Promise<KnowledgeGraph[]> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (g:Graph {userId: $userId})
        RETURN g
        ORDER BY g.createdAt DESC
        `,
        { userId }
      );

      const graphs: KnowledgeGraph[] = [];

      for (const record of result.records) {
        const graphProps = record.get('g').properties;
        
        // Convert BigInt to Number for viewCount - handle all cases
        let viewCount: number;
        if (graphProps.viewCount === undefined || graphProps.viewCount === null) {
          viewCount = 0;
        } else if (typeof graphProps.viewCount === 'bigint') {
          viewCount = Number(graphProps.viewCount);
        } else {
          viewCount = Number(graphProps.viewCount);
        }
        
        // Handle datetime conversion
        let createdAt: Date;
        if (typeof graphProps.createdAt === 'string') {
          createdAt = new Date(graphProps.createdAt);
        } else if (graphProps.createdAt && typeof graphProps.createdAt.toString === 'function') {
          createdAt = new Date(graphProps.createdAt.toString());
        } else {
          createdAt = new Date();
        }
        
        // For list view, we can return graphs without full node/edge data
        // Or fetch them if needed
        graphs.push({
          id: graphProps.id,
          slug: graphProps.slug,
          topic: graphProps.topic,
          label: graphProps.label || graphProps.id,
          summary: graphProps.summary || '',
          nodes: [], // Empty for list view
          edges: [], // Empty for list view
          createdAt,
          userId: graphProps.userId,
          isPublic: graphProps.isPublic,
          viewCount,
        });
      }

      return graphs;
    } finally {
      await session.close();
    }
  }

  /**
   * Check if a graph exists
   */
  async graphExists(slug: string): Promise<boolean> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const result = await session.run(
        `
        MATCH (g:Graph {slug: $slug})
        RETURN count(g) as count
        `,
        { slug }
      );

      const count = result.records[0].get('count').toNumber();
      return count > 0;
    } finally {
      await session.close();
    }
  }

  /**
   * Search graphs by topic, label, or content using enhanced full-text search
   * Supports multi-word queries, partial matching, and improved relevance scoring
   */
  async searchGraphs(
    query: string,
    userId?: string | null,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ graphs: KnowledgeGraph[]; total: number }> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      // Tokenize query into words (split by spaces, filter empty strings)
      const searchTokens = query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(token => token.length > 0)
        .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape special regex chars

      if (searchTokens.length === 0) {
        return { graphs: [], total: 0 };
      }

      // Build query with optional user filter
      const userFilter = userId ? 'AND g.userId = $userId' : '';
      const params: any = {
        searchTokens,
        limit: neo4j.int(Math.floor(limit)),
        offset: neo4j.int(Math.floor(offset)),
      };
      if (userId) {
        params.userId = userId;
      }

      // Build dynamic WHERE clause for multi-word matching
      // Match if ANY token appears in any searchable field (OR logic)
      // This allows partial matches and multi-word queries
      const tokenConditions = searchTokens.map((token, idx) => {
        const tokenParam = `token${idx}`;
        params[tokenParam] = token;
        return `(
          toLower(g.topic) CONTAINS $${tokenParam}
          OR toLower(g.label) CONTAINS $${tokenParam}
          OR EXISTS {
            MATCH (g)-[:HAS_NODE]->(n:Node)
            WHERE toLower(n.label) CONTAINS $${tokenParam}
               OR toLower(n.summary) CONTAINS $${tokenParam}
               OR toLower(n.category) CONTAINS $${tokenParam}
               OR ANY(source IN n.sources WHERE toLower(source) CONTAINS $${tokenParam})
          }
          OR EXISTS {
            MATCH (g)-[:HAS_NODE]->(source:Node)-[r:RELATES_TO]->(target:Node)
            WHERE toLower(r.relationship) CONTAINS $${tokenParam}
          }
        )`;
      }).join(' OR ');

      // Enhanced relevance scoring:
      // - Exact topic match: 10 points
      // - Topic contains query: 8 points
      // - Label match: 6 points
      // - Node label match: 4 points
      // - Node summary match: 3 points
      // - Category match: 2 points
      // - Source match: 1 point
      // - Relationship match: 1 point
      // Plus bonus for matching multiple tokens
      const relevanceScoring = searchTokens.map((token, idx) => {
        const tokenParam = `token${idx}`;
        return `
          (CASE WHEN toLower(g.topic) = $${tokenParam} THEN 10
                WHEN toLower(g.topic) CONTAINS $${tokenParam} THEN 8
                WHEN toLower(g.label) CONTAINS $${tokenParam} THEN 6
                ELSE 0 END) +
          (CASE WHEN EXISTS {
            MATCH (g)-[:HAS_NODE]->(n:Node)
            WHERE toLower(n.label) CONTAINS $${tokenParam}
          } THEN 4 ELSE 0 END) +
          (CASE WHEN EXISTS {
            MATCH (g)-[:HAS_NODE]->(n:Node)
            WHERE toLower(n.summary) CONTAINS $${tokenParam}
          } THEN 3 ELSE 0 END) +
          (CASE WHEN EXISTS {
            MATCH (g)-[:HAS_NODE]->(n:Node)
            WHERE toLower(n.category) CONTAINS $${tokenParam}
          } THEN 2 ELSE 0 END) +
          (CASE WHEN EXISTS {
            MATCH (g)-[:HAS_NODE]->(n:Node)
            WHERE ANY(source IN n.sources WHERE toLower(source) CONTAINS $${tokenParam})
          } THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS {
            MATCH (g)-[:HAS_NODE]->(source:Node)-[r:RELATES_TO]->(target:Node)
            WHERE toLower(r.relationship) CONTAINS $${tokenParam}
          } THEN 1 ELSE 0 END)`;
      }).join(' + ');

      // Search in topic, label, node labels, summaries, categories, sources, and relationships
      const searchQuery = `
        MATCH (g:Graph)
        WHERE (${tokenConditions})
        ${userFilter}
        WITH g, (${relevanceScoring}) as relevance
        ORDER BY relevance DESC, g.viewCount DESC, g.createdAt DESC
        SKIP $offset
        LIMIT $limit
        RETURN g, relevance
      `;

      const result = await session.run(searchQuery, params);

      // Get total count
      const countQuery = `
        MATCH (g:Graph)
        WHERE (${tokenConditions})
        ${userFilter}
        RETURN count(g) as total
      `;

      const countResult = await session.run(countQuery, params);
      const total = countResult.records[0]?.get('total').toNumber() || 0;

      const graphs: KnowledgeGraph[] = [];

      for (const record of result.records) {
        const graphProps = record.get('g').properties;
        
        // Convert BigInt to Number for viewCount
        let viewCount: number;
        if (graphProps.viewCount === undefined || graphProps.viewCount === null) {
          viewCount = 0;
        } else if (typeof graphProps.viewCount === 'bigint') {
          viewCount = Number(graphProps.viewCount);
        } else {
          viewCount = Number(graphProps.viewCount);
        }
        
        // Handle datetime conversion
        let createdAt: Date;
        if (typeof graphProps.createdAt === 'string') {
          createdAt = new Date(graphProps.createdAt);
        } else if (graphProps.createdAt && typeof graphProps.createdAt.toString === 'function') {
          createdAt = new Date(graphProps.createdAt.toString());
        } else {
          createdAt = new Date();
        }
        
        graphs.push({
          id: graphProps.id,
          slug: graphProps.slug,
          topic: graphProps.topic,
          label: graphProps.label || graphProps.id,
          summary: graphProps.summary || '',
          nodes: [], // Empty for search results
          edges: [], // Empty for search results
          createdAt,
          userId: graphProps.userId,
          isPublic: graphProps.isPublic,
          viewCount,
        });
      }

      return { graphs, total };
    } finally {
      await session.close();
    }
  }

  /**
   * Search nodes across all graphs using enhanced full-text search
   * Supports multi-word queries, partial matching, and improved relevance scoring
   */
  async searchNodes(
    query: string,
    category?: string,
    limit: number = 50
  ): Promise<{ nodes: GraphNode[]; graphs: string[] }> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      // Tokenize query into words (split by spaces, filter empty strings)
      const searchTokens = query
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(token => token.length > 0)
        .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape special regex chars

      if (searchTokens.length === 0) {
        return { nodes: [], graphs: [] };
      }

      const categoryFilter = category ? 'AND n.category = $category' : '';
      const params: any = {
        searchTokens,
        limit: neo4j.int(Math.floor(limit)),
      };
      if (category) {
        params.category = category;
      }

      // Build dynamic WHERE clause for multi-word matching
      const tokenConditions = searchTokens.map((token, idx) => {
        const tokenParam = `token${idx}`;
        params[tokenParam] = token;
        return `(
          toLower(n.label) CONTAINS $${tokenParam}
          OR toLower(n.summary) CONTAINS $${tokenParam}
          OR toLower(n.category) CONTAINS $${tokenParam}
          OR ANY(source IN n.sources WHERE toLower(source) CONTAINS $${tokenParam})
        )`;
      }).join(' OR ');

      // Enhanced relevance scoring for nodes:
      // - Exact label match: 10 points
      // - Label contains query: 8 points
      // - Summary match: 5 points
      // - Category match: 3 points
      // - Source match: 1 point
      const relevanceScoring = searchTokens.map((token, idx) => {
        const tokenParam = `token${idx}`;
        return `
          (CASE WHEN toLower(n.label) = $${tokenParam} THEN 10
                WHEN toLower(n.label) CONTAINS $${tokenParam} THEN 8
                ELSE 0 END) +
          (CASE WHEN toLower(n.summary) CONTAINS $${tokenParam} THEN 5 ELSE 0 END) +
          (CASE WHEN toLower(n.category) CONTAINS $${tokenParam} THEN 3 ELSE 0 END) +
          (CASE WHEN ANY(source IN n.sources WHERE toLower(source) CONTAINS $${tokenParam}) THEN 1 ELSE 0 END)`;
      }).join(' + ');

      const searchQuery = `
        MATCH (g:Graph)-[:HAS_NODE]->(n:Node)
        WHERE (${tokenConditions})
        ${categoryFilter}
        WITH DISTINCT n, g.id as graphId, g.slug as graphSlug, (${relevanceScoring}) as relevance
        ORDER BY relevance DESC, n.impactScore DESC
        LIMIT $limit
        RETURN n, graphId, graphSlug, relevance
      `;

      const result = await session.run(searchQuery, params);

      const nodes: GraphNode[] = [];
      const graphIds = new Set<string>();

      for (const record of result.records) {
        const node = record.get('n').properties;
        const graphId = record.get('graphId');
        const graphSlug = record.get('graphSlug');
        
        graphIds.add(graphSlug);

        const impactScore = typeof node.impactScore === 'bigint' 
          ? Number(node.impactScore) 
          : (node.impactScore !== undefined && node.impactScore !== null ? Number(node.impactScore) : 0);
        
        nodes.push({
          id: node.id,
          label: node.label,
          summary: node.summary,
          sources: node.sources || [],
          impactScore,
          category: node.category,
        });
      }

      return { nodes, graphs: Array.from(graphIds) };
    } finally {
      await session.close();
    }
  }

  /**
   * Find related graphs using graph traversal - graphs that share common nodes
   */
  async findRelatedGraphs(
    graphId: string,
    limit: number = 10
  ): Promise<KnowledgeGraph[]> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const query = `
        MATCH (source:Graph {id: $graphId})-[:HAS_NODE]->(n:Node)<-[:HAS_NODE]-(related:Graph)
        WHERE source.id <> related.id
        WITH related, count(DISTINCT n) as commonNodes
        ORDER BY commonNodes DESC, related.createdAt DESC
        LIMIT $limit
        RETURN related
      `;

      const result = await session.run(query, { graphId, limit: neo4j.int(Math.floor(limit)) });

      const graphs: KnowledgeGraph[] = [];

      for (const record of result.records) {
        const graphProps = record.get('related').properties;
        
        let viewCount: number;
        if (graphProps.viewCount === undefined || graphProps.viewCount === null) {
          viewCount = 0;
        } else if (typeof graphProps.viewCount === 'bigint') {
          viewCount = Number(graphProps.viewCount);
        } else {
          viewCount = Number(graphProps.viewCount);
        }
        
        let createdAt: Date;
        if (typeof graphProps.createdAt === 'string') {
          createdAt = new Date(graphProps.createdAt);
        } else if (graphProps.createdAt && typeof graphProps.createdAt.toString === 'function') {
          createdAt = new Date(graphProps.createdAt.toString());
        } else {
          createdAt = new Date();
        }
        
        graphs.push({
          id: graphProps.id,
          slug: graphProps.slug,
          topic: graphProps.topic,
          label: graphProps.label || graphProps.id,
          summary: graphProps.summary || '',
          nodes: [],
          edges: [],
          createdAt,
          userId: graphProps.userId,
          isPublic: graphProps.isPublic,
          viewCount,
        });
      }

      return graphs;
    } finally {
      await session.close();
    }
  }

  /**
   * Get graphs by category - find graphs containing nodes of specific categories
   */
  async getGraphsByCategory(
    category: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ graphs: KnowledgeGraph[]; total: number }> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const query = `
        MATCH (g:Graph)-[:HAS_NODE]->(n:Node {category: $category})
        WITH DISTINCT g
        ORDER BY g.createdAt DESC
        SKIP $offset
        LIMIT $limit
        RETURN g
      `;

      const countQuery = `
        MATCH (g:Graph)-[:HAS_NODE]->(n:Node {category: $category})
        RETURN count(DISTINCT g) as total
      `;

      const result = await session.run(query, { 
        category, 
        limit: neo4j.int(Math.floor(limit)), 
        offset: neo4j.int(Math.floor(offset)) 
      });
      const countResult = await session.run(countQuery, { category });
      const total = countResult.records[0]?.get('total').toNumber() || 0;

      const graphs: KnowledgeGraph[] = [];

      for (const record of result.records) {
        const graphProps = record.get('g').properties;
        
        let viewCount: number;
        if (graphProps.viewCount === undefined || graphProps.viewCount === null) {
          viewCount = 0;
        } else if (typeof graphProps.viewCount === 'bigint') {
          viewCount = Number(graphProps.viewCount);
        } else {
          viewCount = Number(graphProps.viewCount);
        }
        
        let createdAt: Date;
        if (typeof graphProps.createdAt === 'string') {
          createdAt = new Date(graphProps.createdAt);
        } else if (graphProps.createdAt && typeof graphProps.createdAt.toString === 'function') {
          createdAt = new Date(graphProps.createdAt.toString());
        } else {
          createdAt = new Date();
        }
        
        graphs.push({
          id: graphProps.id,
          slug: graphProps.slug,
          topic: graphProps.topic,
          label: graphProps.label || graphProps.id,
          summary: graphProps.summary || '',
          nodes: [],
          edges: [],
          createdAt,
          userId: graphProps.userId,
          isPublic: graphProps.isPublic,
          viewCount,
        });
      }

      return { graphs, total };
    } finally {
      await session.close();
    }
  }

  /**
   * Get popular graphs based on view count
   */
  async getPopularGraphs(
    limit: number = 20,
    days: number = 30
  ): Promise<KnowledgeGraph[]> {
    const driver = getNeo4jDriver();
    const session = driver.session();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const query = `
        MATCH (g:Graph)
        WHERE g.isPublic = true 
          AND datetime(g.createdAt) >= datetime($cutoffDate)
        RETURN g
        ORDER BY g.viewCount DESC, g.createdAt DESC
        LIMIT $limit
      `;

      const result = await session.run(query, {
        limit: neo4j.int(Math.floor(limit)),
        cutoffDate: cutoffDate.toISOString(),
      });

      const graphs: KnowledgeGraph[] = [];

      for (const record of result.records) {
        const graphProps = record.get('g').properties;
        
        let viewCount: number;
        if (graphProps.viewCount === undefined || graphProps.viewCount === null) {
          viewCount = 0;
        } else if (typeof graphProps.viewCount === 'bigint') {
          viewCount = Number(graphProps.viewCount);
        } else {
          viewCount = Number(graphProps.viewCount);
        }
        
        let createdAt: Date;
        if (typeof graphProps.createdAt === 'string') {
          createdAt = new Date(graphProps.createdAt);
        } else if (graphProps.createdAt && typeof graphProps.createdAt.toString === 'function') {
          createdAt = new Date(graphProps.createdAt.toString());
        } else {
          createdAt = new Date();
        }
        
        graphs.push({
          id: graphProps.id,
          slug: graphProps.slug,
          topic: graphProps.topic,
          label: graphProps.label || graphProps.id,
          summary: graphProps.summary || '',
          nodes: [],
          edges: [],
          createdAt,
          userId: graphProps.userId,
          isPublic: graphProps.isPublic,
          viewCount,
        });
      }

      return graphs;
    } finally {
      await session.close();
    }
  }
}

export const graphService = new GraphService();

