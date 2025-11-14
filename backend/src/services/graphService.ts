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
      await session.run(
        `
        CREATE (g:Graph {
          id: $id,
          slug: $slug,
          topic: $topic,
          userId: $userId,
          isPublic: $isPublic,
          viewCount: 0,
          createdAt: datetime($createdAt)
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
        return {
          id: node.id,
          label: node.label,
          summary: node.summary,
          sources: node.sources || [],
          impactScore: node.impactScore,
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
        return {
          source: record.get('sourceId'),
          target: record.get('targetId'),
          relationship: rel.relationship,
          strength: rel.strength,
        };
      });

      return {
        id: graphProps.id,
        slug: graphProps.slug,
        topic: graphProps.topic,
        nodes,
        edges,
        createdAt: new Date(graphProps.createdAt),
        userId: graphProps.userId,
        isPublic: graphProps.isPublic,
        viewCount: graphProps.viewCount + 1, // Include the increment we just did
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
        
        // For list view, we can return graphs without full node/edge data
        // Or fetch them if needed
        graphs.push({
          id: graphProps.id,
          slug: graphProps.slug,
          topic: graphProps.topic,
          nodes: [], // Empty for list view
          edges: [], // Empty for list view
          createdAt: new Date(graphProps.createdAt),
          userId: graphProps.userId,
          isPublic: graphProps.isPublic,
          viewCount: graphProps.viewCount,
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

