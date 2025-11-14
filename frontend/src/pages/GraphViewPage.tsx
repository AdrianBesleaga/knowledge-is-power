import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGraphBySlug, getRelatedGraphs, setAuthToken } from '../services/api';
import { KnowledgeGraph as KnowledgeGraphType, GraphNode } from '../types/graph';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { ShareButton } from '../components/ShareButton';
import { useAuth } from '../hooks/useAuth';
import './GraphViewPage.css';

export const GraphViewPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [graph, setGraph] = useState<KnowledgeGraphType | null>(null);
  const [relatedGraphs, setRelatedGraphs] = useState<KnowledgeGraphType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    const loadGraph = async () => {
      if (!slug) {
        setError('Invalid graph URL');
        setLoading(false);
        return;
      }

      try {
        // Set auth token if user is logged in
        if (user) {
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }
        }

        const loadedGraph = await getGraphBySlug(slug);
        setGraph(loadedGraph);
        
        // Update page title for SEO
        document.title = `${loadedGraph.topic} - Knowledge is Power`;

        // Load related graphs
        setLoadingRelated(true);
        try {
          const related = await getRelatedGraphs(slug, 6);
          setRelatedGraphs(related.graphs);
        } catch (err) {
          console.error('Error loading related graphs:', err);
        } finally {
          setLoadingRelated(false);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load knowledge graph');
        console.error('Error loading graph:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGraph();
  }, [slug, user, getIdToken]);

  if (loading) {
    return (
      <div className="graph-view-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="graph-view-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error || 'Graph not found'}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-view-page">
      <main className="graph-main">
        <div className="graph-info">
          <div>
            <h2>{graph.topic}</h2>
            <div className="graph-meta">
              <span>{new Date(graph.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{graph.viewCount} views</span>
            </div>
          </div>
          <ShareButton url={`/graph/${graph.slug}`} />
        </div>

        <div className="graph-display">
          <KnowledgeGraph
            nodes={graph.nodes}
            edges={graph.edges}
            onNodeClick={setSelectedNode}
          />
        </div>

        <div className="info-text">
          💡 Click on any node to see detailed information and sources
        </div>

        {relatedGraphs.length > 0 && (
          <div className="related-graphs-section">
            <h3>Related Graphs</h3>
            <p className="related-description">
              Graphs that share common nodes with this one (powered by Neo4j graph traversal)
            </p>
            <div className="related-graphs-grid">
              {relatedGraphs.map((relatedGraph) => (
                <div
                  key={relatedGraph.id}
                  className="related-graph-card"
                  onClick={() => navigate(`/graph/${relatedGraph.slug}`)}
                >
                  <h4>{relatedGraph.topic}</h4>
                  <div className="related-graph-meta">
                    <span>{new Date(relatedGraph.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{relatedGraph.viewCount} views</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
    </div>
  );
};

