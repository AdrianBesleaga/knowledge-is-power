import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGraphBySlug, getRelatedGraphs, setAuthToken } from '../services/api';
import { KnowledgeGraph as KnowledgeGraphType, GraphNode } from '../types/graph';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { ShareButton } from '../components/ShareButton';
import { PremiumContentOverlay } from '../components/PremiumContentOverlay';
import { useAuth } from '../hooks/useAuth';
import './GraphViewPage.css';

export const GraphViewPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [graph, setGraph] = useState<KnowledgeGraphType | null>(null);
  const [relatedGraphs, setRelatedGraphs] = useState<KnowledgeGraphType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isPremiumLocked, setIsPremiumLocked] = useState(false);
  const [premiumGraphData, setPremiumGraphData] = useState<any>(null);

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

        try {
          const loadedGraph = await getGraphBySlug(slug);
          setGraph(loadedGraph);

          // Update page title for SEO
          document.title = `${loadedGraph.topic} - Knowledge is Power`;

          // Load related graphs
          try {
            const related = await getRelatedGraphs(slug, 6);
            setRelatedGraphs(related.graphs);
          } catch (err) {
            console.error('Error loading related graphs:', err);
          }
        } catch (err: any) {
          // Handle premium content that requires payment
          if (err.response?.status === 402 && err.response?.data?.code === 'PREMIUM_CONTENT') {
            setIsPremiumLocked(true);
            setPremiumGraphData(err.response.data.graph);
            setError(null);

            // Update page title for premium content
            document.title = `${err.response.data.graph.topic} - Premium Content - Knowledge is Power`;
          } else {
            throw err;
          }
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

  const handlePremiumUnlock = (unlockedGraph: KnowledgeGraphType) => {
    setGraph(unlockedGraph);
    setIsPremiumLocked(false);
    setPremiumGraphData(null);

    // Update page title
    document.title = `${unlockedGraph.topic} - Knowledge is Power`;

    // Load related graphs
    getRelatedGraphs(slug!, 6).then(related => {
      setRelatedGraphs(related.graphs);
    }).catch(err => {
      console.error('Error loading related graphs:', err);
    });
  };

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
            <h2>{isPremiumLocked && premiumGraphData ? premiumGraphData.topic : graph.topic}</h2>
            <div className="graph-meta">
              <span>{new Date(isPremiumLocked && premiumGraphData ? premiumGraphData.createdAt : graph.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{isPremiumLocked && premiumGraphData ? premiumGraphData.viewCount : graph.viewCount} views</span>
              {(isPremiumLocked || graph.visibility === 'premium') && <span className="premium-badge">💎 Premium</span>}
            </div>
          </div>
          <ShareButton
            url={`/graph/${graph.slug}`}
            slug={graph.slug}
            graph={isPremiumLocked && premiumGraphData ? premiumGraphData : graph}
            onVisibilityChange={(visibility) => {
              setGraph({ ...graph, visibility });
            }}
          />
        </div>

        {graph.summary && (
          <div className="graph-summary-section">
            <h3>Summary</h3>
            <p className="graph-summary">{graph.summary}</p>
          </div>
        )}

        <div className="graph-display">
          {isPremiumLocked && premiumGraphData ? (
            <PremiumContentOverlay
              contentType="graph"
              slug={premiumGraphData.slug}
              topic={premiumGraphData.topic}
              onUnlock={handlePremiumUnlock}
            >
              <KnowledgeGraph
                nodes={premiumGraphData.nodes || []}
                edges={premiumGraphData.edges || []}
                onNodeClick={() => {}}
              />
            </PremiumContentOverlay>
          ) : (
            <KnowledgeGraph
              nodes={graph.nodes}
              edges={graph.edges}
              onNodeClick={setSelectedNode}
            />
          )}
        </div>

        <div className="info-text">
          💡 By default, level 1 (parents) and level 2 (first children) are shown. Click on any node to see detailed information and expand its children. Use "Show All Nodes" to display the entire graph.
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

