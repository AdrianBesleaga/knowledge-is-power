import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { generateGraph, saveGraph, setAuthToken } from '../services/api';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { SaveGraphButton } from '../components/SaveGraphButton';
import { ShareButton } from '../components/ShareButton';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import { GraphNode, GraphEdge } from '../types/graph';
import './HomePage.css';

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const handleSearch = async (searchTopic: string) => {
    setLoading(true);
    setError(null);
    setTopic(searchTopic);
    setSavedUrl(null);

    try {
      const result = await generateGraph(searchTopic);
      setNodes(result.nodes);
      setEdges(result.edges);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate knowledge graph');
      console.error('Error generating graph:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGraph = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await saveGraph(topic, nodes, edges, true);
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
      <header className="home-header">
        <div className="header-content">
          <h1 className="logo">Knowledge is Power</h1>
          <div className="header-actions">
            {user ? (
              <button
                className="btn-secondary"
                onClick={() => navigate('/profile')}
              >
                My Graphs
              </button>
            ) : (
              <button
                className="btn-secondary"
                onClick={() => setShowAuthModal(true)}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="home-main">
        <div className="hero-section">
          <h2 className="hero-title">
            Understand Complex Topics Through Visual Knowledge Graphs
          </h2>
          <p className="hero-subtitle">
            AI-powered analysis showing relationships and impacts between information sources
          </p>
          
          <div className="search-section">
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}
        </div>

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Analyzing topic and generating knowledge graph...</p>
            <p className="loading-hint">This may take 10-30 seconds</p>
          </div>
        )}

        {!loading && nodes.length > 0 && (
          <div className="graph-section">
            <div className="graph-actions">
              <h3>Knowledge Graph: {topic}</h3>
              <div className="action-buttons">
                {savedUrl && <ShareButton url={savedUrl} />}
                <SaveGraphButton
                  topic={topic}
                  nodes={nodes}
                  edges={edges}
                  onSave={handleSaveGraph}
                  onAuthRequired={() => setShowAuthModal(true)}
                />
              </div>
            </div>
            
            <div className="graph-container">
              <KnowledgeGraph
                nodes={nodes}
                edges={edges}
                onNodeClick={setSelectedNode}
              />
            </div>

            <div className="info-text">
              💡 Click on any node to see detailed information and sources
            </div>
          </div>
        )}
      </main>

      <NodeDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          if (nodes.length > 0) {
            handleSaveGraph();
          }
        }}
      />
    </div>
  );
};

