import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateGraph, saveGraph, setAuthToken, getPopularGraphs, getPopularTimelines } from '../services/api';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { SaveGraphButton } from '../components/SaveGraphButton';
import { ShareButton } from '../components/ShareButton';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import { GraphNode, GraphEdge, KnowledgeGraph as KnowledgeGraphType } from '../types/graph';
import { TimelineAnalysis } from '../types/timeline';
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
  const [popularTimelines, setPopularTimelines] = useState<TimelineAnalysis[]>([]);
  const [loadingPopularTimelines, setLoadingPopularTimelines] = useState(true);

  // Load popular timelines on mount
  useEffect(() => {
    const loadPopularTimelines = async () => {
      try {
        setLoadingPopularTimelines(true);
        const result = await getPopularTimelines(30, 30); // Top 30 from last 30 days
        setPopularTimelines(result.timelines);
      } catch (err) {
        console.error('Error loading popular timelines:', err);
      } finally {
        setLoadingPopularTimelines(false);
      }
    };
    loadPopularTimelines();
  }, []);

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
          } else if (err.response?.status === 402) {
            setError(err.response?.data?.message || 'Insufficient credits. Please buy more credits to continue.');
            // Show error with link to buy credits
            setTimeout(() => {
              if (window.confirm('You have run out of credits. Would you like to buy more credits?')) {
                navigate('/buy-credits');
              }
            }, 500);
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
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-icon">✨</span>
              <span className="badge-text">Powered by Advanced AI</span>
            </div>

            <h1 className="hero-title">
              Turn Complex Topics Into
              <span className="hero-highlight">
                Crystal-Clear Insights
                <div className="highlight-glow"></div>
                <div className="fire-particles">
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                  <div className="fire-particle"></div>
                </div>
              </span>
            </h1>

            <p className="hero-subtitle">
              AI-powered knowledge graphs and predictions that transform raw information
              into actionable intelligence. Research smarter, decide faster.
            </p>

            <div className="hero-features">
              <div className="feature-pill">
                <div className="feature-icon">🎯</div>
                <span>AI-Powered Analysis</span>
              </div>
              <div className="feature-pill">
                <div className="feature-icon">✨</div>
                <span>Instant Visualization</span>
              </div>
              <div className="feature-pill">
                <div className="feature-icon">🚀</div>
                <span>Smart Predictions</span>
              </div>
            </div>

            {!user && (
              <p className="hero-auth-hint">
                <span className="auth-icon">✨</span>
                Sign in to save your insights and unlock advanced features
              </p>
            )}

            {error && (
              <div className="error-banner">
                {error}
              </div>
            )}
          </div>
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
          <>
            <div className="popular-timelines-section">
              <div className="section-header">
                <h2>Trending AI Predictions</h2>
                <p className="section-subtitle">See what others are forecasting - top predictions from the community</p>
              </div>

              {loadingPopularTimelines ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading popular AI predictions...</p>
                </div>
              ) : popularTimelines.length > 0 ? (
                <div className="graphs-grid">
                  {popularTimelines.map((timeline) => (
                    <div
                      key={timeline.id}
                      className="graph-card"
                      onClick={() => navigate(`/predictions/${timeline.slug}`)}
                    >
                      <h3>{timeline.topic}</h3>
                      <p className="graph-card-summary">Tracking: {timeline.valueLabel}</p>
                      <div className="graph-card-meta">
                        <span className="date">
                          {new Date(timeline.createdAt).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="views">{timeline.viewCount} views</span>
                      </div>
                      <div className="graph-card-footer">
                        <span className={`visibility-badge ${timeline.isPublic ? 'public' : 'private'}`}>
                          {timeline.isPublic ? '🌐 Public' : '🔒 Private'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">📈</div>
                  <h3>No popular AI predictions yet</h3>
                  <p>Be the first to create and share an AI prediction!</p>
                </div>
              )}
            </div>

            <div className="popular-graphs-section">
              <div className="section-header">
                <h2>Trending Knowledge Graphs</h2>
                <p className="section-subtitle">Explore popular insights and discover what the community is analyzing</p>
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

            <div className="features-section">
              <div className="features-header">
                <h2 className="features-title">
                  Intelligence At Your Fingertips
                </h2>
                <p className="features-subtitle">
                  Powerful AI tools that turn information overload into clarity
                </p>
              </div>

              <div className="features-container">
                <div className="feature-card">
                  <div className="feature-icon-large">🧠</div>
                  <h3>AI-Powered Analysis</h3>
                  <p>Advanced algorithms extract key insights from complex topics, connecting the dots between disparate pieces of information automatically.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon-large">🎨</div>
                  <h3>Beautiful Visualizations</h3>
                  <p>Interactive knowledge graphs that make complex relationships crystal clear. See the big picture and dive into details with a click.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon-large">🔮</div>
                  <h3>Smart Predictions</h3>
                  <p>AI-generated forecasts based on data-driven analysis. Anticipate trends and make informed decisions with confidence.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon-large">⚡</div>
                  <h3>Instant Results</h3>
                  <p>What takes hours of research happens in seconds. Get comprehensive analysis delivered faster than you can make coffee.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon-large">🔗</div>
                  <h3>Share Anywhere</h3>
                  <p>Generate shareable links in one click. Collaborate with your team or present insights to stakeholders effortlessly.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon-large">🎯</div>
                  <h3>Always Accurate</h3>
                  <p>Every insight is fact-checked and verified. No hallucinations, no guesswork - just reliable intelligence you can trust.</p>
                </div>
              </div>
            </div>
          </>
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

