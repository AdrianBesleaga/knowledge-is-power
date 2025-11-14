import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { generateGraph, saveGraph, setAuthToken, getPopularGraphs } from '../services/api';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { SaveGraphButton } from '../components/SaveGraphButton';
import { ShareButton } from '../components/ShareButton';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import { GraphNode, GraphEdge, KnowledgeGraph as KnowledgeGraphType } from '../types/graph';
import './HomePage.css';

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [summary, setSummary] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [popularGraphs, setPopularGraphs] = useState<KnowledgeGraphType[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);

  // Load popular graphs on mount
  useEffect(() => {
    const loadPopularGraphs = async () => {
      try {
        setLoadingPopular(true);
        const result = await getPopularGraphs(30, 30); // Top 30 from last 30 days
        setPopularGraphs(result.graphs);
      } catch (err) {
        console.error('Error loading popular graphs:', err);
      } finally {
        setLoadingPopular(false);
      }
    };
    loadPopularGraphs();
  }, []);

  // Auto-generate graph after successful authentication if there's a pending topic
  useEffect(() => {
    if (user && pendingTopic && !showAuthModal) {
      const generatePendingGraph = async () => {
        const topic = pendingTopic;
        setPendingTopic(null); // Clear pending topic first to avoid re-triggering
        
        setLoading(true);
        setError(null);
        setTopic(topic);
        setSummary('');
        setSavedUrl(null);

        try {
          // Ensure auth token is set
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }

          const result = await generateGraph(topic);
          setSummary(result.summary);
          setNodes(result.nodes);
          setEdges(result.edges);
        } catch (err: any) {
          if (err.response?.status === 401) {
            setError('Please sign in to generate graphs');
            setShowAuthModal(true);
          } else {
            setError(err.response?.data?.error || 'Failed to generate knowledge graph');
          }
          console.error('Error generating graph:', err);
        } finally {
          setLoading(false);
        }
      };
      generatePendingGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingTopic, showAuthModal]);

  const handleSearch = async (searchTopic: string) => {
    // Check if user is authenticated
    if (!user) {
      setPendingTopic(searchTopic);
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    setError(null);
    setTopic(searchTopic);
    setSummary('');
    setSavedUrl(null);

    try {
      // Ensure auth token is set
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await generateGraph(searchTopic);
      setSummary(result.summary);
      setNodes(result.nodes);
      setEdges(result.edges);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Please sign in to generate graphs');
        setShowAuthModal(true);
      } else {
        setError(err.response?.data?.error || 'Failed to generate knowledge graph');
      }
      console.error('Error generating graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGraph = async () => {
    if (!user) {
      // UserProfile component will handle showing auth modal
      return;
    }

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await saveGraph(topic, nodes, edges, false, summary);
      setSavedUrl(result.url);
      
      // Navigate to the saved graph
      navigate(result.url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save graph');
      console.error('Error saving graph:', err);
    }
  };

  return (
    <div className="home-page">
      <main className="home-main">
        <div className="hero-section">
          <h2 className="hero-title">
            Understand Complex Topics Through Visual Knowledge Graphs
          </h2>
          <p className="hero-subtitle">
            AI-powered analysis showing relationships and impacts between information sources
          </p>
          {!user && (
            <p className="hero-auth-hint">
              Sign in to generate knowledge graphs
            </p>
          )}
          
          <div className="search-section">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}
        </div>

        {topic && (
          <div className="graph-section">
            <div className="graph-actions">
              <h3>Knowledge Graph: {topic}</h3>
              {!loading && nodes.length > 0 && (
                <div className="action-buttons">
                  {savedUrl && (
                    <ShareButton 
                      url={savedUrl} 
                      slug={savedUrl.replace('/graph/', '')}
                    />
                  )}
                  <SaveGraphButton
                    topic={topic}
                    nodes={nodes}
                    edges={edges}
                    onSave={handleSaveGraph}
                  />
                </div>
              )}
            </div>
            
            <div className="graph-container">
              {loading ? (
                <div className="graph-loading">
                  <div className="spinner"></div>
                  <p>Analyzing topic and generating knowledge graph...</p>
                  <p className="loading-hint">This may take 10-30 seconds</p>
                </div>
              ) : nodes.length > 0 ? (
                <KnowledgeGraph
                  nodes={nodes}
                  edges={edges}
                  onNodeClick={setSelectedNode}
                />
              ) : null}
            </div>

            {!loading && nodes.length > 0 && (
              <div className="info-text">
                💡 Click on any node to see detailed information and sources
              </div>
            )}
          </div>
        )}

        {!topic && (
          <div className="popular-graphs-section">
            <div className="section-header">
              <h2>Top 30 Popular Graphs</h2>
              <p className="section-subtitle">Most viewed knowledge graphs from the last 30 days</p>
            </div>

            {loadingPopular ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading popular graphs...</p>
              </div>
            ) : popularGraphs.length > 0 ? (
              <div className="graphs-grid">
                {popularGraphs.map((graph) => (
                  <div
                    key={graph.id}
                    className="graph-card"
                    onClick={() => navigate(`/graph/${graph.slug}`)}
                  >
                    <h3>{graph.topic}</h3>
                    {graph.summary && (
                      <p className="graph-card-summary">{graph.summary}</p>
                    )}
                    <div className="graph-card-meta">
                      <span className="date">
                        {new Date(graph.createdAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span className="views">{graph.viewCount} views</span>
                    </div>
                    <div className="graph-card-footer">
                      <span className={`visibility-badge ${graph.isPublic ? 'public' : 'private'}`}>
                        {graph.isPublic ? '🌐 Public' : '🔒 Private'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>No popular graphs yet</h3>
                <p>Be the first to create and share a knowledge graph!</p>
              </div>
            )}
          </div>
        )}
      </main>

      <NodeDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingTopic(null);
        }}
        onSuccess={() => {
          setShowAuthModal(false);
          // The useEffect will handle generating the graph when user state updates
        }}
      />
    </div>
  );
};

