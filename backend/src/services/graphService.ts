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
    isPublic: boolean = true
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
          userId,
          isPublic,
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
}

export const graphService = new GraphService();

