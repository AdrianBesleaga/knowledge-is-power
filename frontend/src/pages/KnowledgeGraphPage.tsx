import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { KnowledgeGraph } from '../components/KnowledgeGraph';
import { NodeDetailPanel } from '../components/NodeDetailPanel';
import { SaveGraphButton } from '../components/SaveGraphButton';
import { ShareButton } from '../components/ShareButton';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import { GraphNode, GraphEdge, KnowledgeGraph as KnowledgeGraphType } from '../types/graph';
import { generateGraph, saveGraph, setAuthToken, searchGraphs, searchNodes, getPopularGraphs, getGraphsByCategory } from '../services/api';
import './KnowledgeGraphPage.css';

type SearchType = 'graphs' | 'nodes' | 'popular' | 'category' | 'generate';

const CATEGORIES = ['social', 'news', 'economic', 'technical', 'political', 'environmental', 'central'];

export const KnowledgeGraphPage = () => {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Graph generation state
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

  // Search state
  const [searchType, setSearchType] = useState<SearchType>('generate');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [graphs, setGraphs] = useState<KnowledgeGraphType[]>([]);
  const [foundNodes, setFoundNodes] = useState<GraphNode[]>([]);
  const [nodeGraphs, setNodeGraphs] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Popular graphs state
  const [popularGraphs, setPopularGraphs] = useState<KnowledgeGraphType[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(false);

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
        setSearchType('generate');

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

  // Initialize search from URL params
  useEffect(() => {
    const initialQuery = searchParams.get('q');
    const initialCategory = searchParams.get('category');
    const initialType = searchParams.get('type') as SearchType || 'generate';

    if (initialQuery && initialType !== 'generate') {
      setQuery(initialQuery);
      setSearchType(initialType);
      if (initialCategory) {
        setCategory(initialCategory);
      }
      handleSearch(initialQuery, initialType, initialCategory || undefined);
    } else if (initialType === 'popular') {
      setSearchType('popular');
      loadPopularGraphsSearch();
    } else if (initialCategory) {
      setSearchType('category');
      setCategory(initialCategory);
      loadGraphsByCategory(initialCategory);
    }
  }, []);

  const handleGenerateGraph = async (searchTopic: string) => {
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
    setSearchType('generate');

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

  const handleSearch = async (searchQuery: string, type: SearchType = searchType, searchCategory?: string) => {
    if (!searchQuery.trim() && type !== 'popular' && type !== 'category') {
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setOffset(0);

    try {
      if (type === 'graphs') {
        const result = await searchGraphs(searchQuery, limit, 0, user ? 'me' : undefined);
        setGraphs(result.graphs);
        setTotal(result.total);
        setFoundNodes([]);
        setNodeGraphs([]);
      } else if (type === 'nodes') {
        const result = await searchNodes(searchQuery, searchCategory || category || undefined, 50);
        setFoundNodes(result.nodes);
        setNodeGraphs(result.graphs);
        setGraphs([]);
        setTotal(0);
      }
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Failed to search');
      console.error('Error searching:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadPopularGraphsSearch = async () => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const result = await getPopularGraphs(limit, 30);
      setGraphs(result.graphs);
      setTotal(result.graphs.length);
      setFoundNodes([]);
      setNodeGraphs([]);
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Failed to load popular graphs');
      console.error('Error loading popular graphs:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadGraphsByCategory = async (cat: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const result = await getGraphsByCategory(cat, limit, 0);
      setGraphs(result.graphs);
      setTotal(result.total);
      setFoundNodes([]);
      setNodeGraphs([]);
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Failed to load graphs by category');
      console.error('Error loading graphs by category:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (searchLoading || searchType !== 'graphs') return;

    setSearchLoading(true);
    try {
      const newOffset = offset + limit;
      const result = await searchGraphs(query, limit, newOffset, user ? 'me' : undefined);
      setGraphs([...graphs, ...result.graphs]);
      setOffset(newOffset);
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Failed to load more');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleTypeChange = (type: SearchType) => {
    setSearchType(type);
    setQuery('');
    setCategory('');
    setGraphs([]);
    setFoundNodes([]);
    setNodeGraphs([]);
    setTotal(0);
    setOffset(0);
    setSearchParams({});

    if (type === 'popular') {
      loadPopularGraphsSearch();
    } else if (type === 'generate') {
      // Clear any search results and show generation interface
      setGraphs([]);
      setFoundNodes([]);
      setNodeGraphs([]);
    }
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setSearchType('category');
    setSearchParams({ category: cat, type: 'category' });
    loadGraphsByCategory(cat);
  };

  const renderSearchResults = () => {
    if (searchType === 'generate') return null;

    if (searchError) {
      return (
        <div className="error-banner">
          {searchError}
        </div>
      );
    }

    if (searchLoading && graphs.length === 0 && foundNodes.length === 0) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Searching...</p>
        </div>
      );
    }

    if (!searchLoading && searchType === 'graphs' && graphs.length > 0) {
      return (
        <div className="search-results">
          <div className="results-header">
            <h2>Found {total} graph{total !== 1 ? 's' : ''}</h2>
          </div>
          <div className="graphs-grid">
            {graphs.map((graph) => (
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
          {offset + limit < total && (
            <button className="load-more-button" onClick={handleLoadMore} disabled={searchLoading}>
              {searchLoading ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      );
    }

    if (!searchLoading && searchType === 'nodes' && foundNodes.length > 0) {
      return (
        <div className="search-results">
          <div className="results-header">
            <h2>Found {foundNodes.length} node{foundNodes.length !== 1 ? 's' : ''} in {nodeGraphs.length} graph{nodeGraphs.length !== 1 ? 's' : ''}</h2>
          </div>
          <div className="nodes-list">
            {foundNodes.map((node, idx) => (
              <div key={`${node.id}-${idx}`} className="node-card">
                <div className="node-header">
                  <h3>{node.label}</h3>
                  <span className={`category-badge ${node.category}`}>
                    {node.category}
                  </span>
                </div>
                <p className="node-summary">{node.summary}</p>
                <div className="node-footer">
                  <span className={`impact-score ${node.impactScore >= 0 ? 'positive' : 'negative'}`}>
                    Impact: {node.impactScore >= 0 ? '+' : ''}{node.impactScore.toFixed(2)}
                  </span>
                  {node.sources.length > 0 && (
                    <span className="sources-count">
                      {node.sources.length} source{node.sources.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!searchLoading && searchType === 'popular' && graphs.length > 0) {
      return (
        <div className="search-results">
          <div className="results-header">
            <h2>Popular Graphs (Last 30 Days)</h2>
          </div>
          <div className="graphs-grid">
            {graphs.map((graph) => (
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
        </div>
      );
    }

    if (!searchLoading && searchType === 'category' && graphs.length > 0) {
      return (
        <div className="search-results">
          <div className="results-header">
            <h2>{category.charAt(0).toUpperCase() + category.slice(1)} Graphs ({total})</h2>
          </div>
          <div className="graphs-grid">
            {graphs.map((graph) => (
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
        </div>
      );
    }

    if (!searchLoading &&
      ((searchType === 'graphs' && graphs.length === 0 && query) ||
        (searchType === 'nodes' && foundNodes.length === 0 && query) ||
        (searchType === 'popular' && graphs.length === 0) ||
        (searchType === 'category' && graphs.length === 0 && category))) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No results found</h3>
          <p>Try a different search query or browse popular graphs</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="knowledge-graph-page">
      <main className="knowledge-graph-main">
        <div className="page-header">
          <h1>Knowledge Graphs</h1>
          <p>Generate new knowledge graphs or search existing ones</p>
        </div>

        <div className="content-section">
          <div className="tabs-section">
            <div className="tabs">
              <button
                className={`tab ${searchType === 'generate' ? 'active' : ''}`}
                onClick={() => handleTypeChange('generate')}
              >
                Generate Graph
              </button>
              <button
                className={`tab ${searchType === 'graphs' ? 'active' : ''}`}
                onClick={() => handleTypeChange('graphs')}
              >
                Search Graphs
              </button>
              <button
                className={`tab ${searchType === 'nodes' ? 'active' : ''}`}
                onClick={() => handleTypeChange('nodes')}
              >
                Search Nodes
              </button>
              <button
                className={`tab ${searchType === 'popular' ? 'active' : ''}`}
                onClick={() => handleTypeChange('popular')}
              >
                Popular
              </button>
              <button
                className={`tab ${searchType === 'category' ? 'active' : ''}`}
                onClick={() => handleTypeChange('category')}
              >
                By Category
              </button>
            </div>
          </div>

          {searchType === 'generate' && (
            <div className="generate-section">
              {!user && (
                <p className="auth-hint">
                  Sign in to generate knowledge graphs
                </p>
              )}

              <div className="search-section">
                <SearchBar
                  onSearch={handleGenerateGraph}
                  loading={loading}
                  buttonText="Generate Graph"
                  loadingText="Generating..."
                />
              </div>

              {error && (
                <div className="error-banner">
                  {error}
                </div>
              )}
            </div>
          )}

          {searchType === 'graphs' && (
            <div className="search-input-section">
              <SearchBar
                onSearch={(q) => {
                  setQuery(q);
                  setSearchParams({ q, type: 'graphs' });
                  handleSearch(q, 'graphs');
                }}
                loading={searchLoading}
                initialValue={query}
                buttonText="Search Graphs"
                loadingText="Searching..."
              />
            </div>
          )}

          {searchType === 'nodes' && (
            <div className="search-input-section">
              <SearchBar
                onSearch={(q) => {
                  setQuery(q);
                  setSearchParams({ q, type: 'nodes', category: category || '' });
                  handleSearch(q, 'nodes', category || undefined);
                }}
                loading={searchLoading}
                initialValue={query}
                buttonText="Search Nodes"
                loadingText="Searching..."
              />
              <div className="category-filters">
                <label>Filter by category:</label>
                <select
                  value={category}
                  onChange={(e) => {
                    const cat = e.target.value;
                    setCategory(cat);
                    if (query) {
                      handleSearch(query, 'nodes', cat || undefined);
                    }
                  }}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {searchType === 'category' && (
            <div className="category-grid">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`category-button ${category === cat ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Show generated graph */}
          {searchType === 'generate' && topic && (
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

          {/* Show popular graphs when no search is active and no graph is generated */}
          {searchType === 'generate' && !topic && !loadingPopular && popularGraphs.length > 0 && (
            <div className="popular-graphs-section">
              <div className="section-header">
                <h2>Popular Knowledge Graphs</h2>
                <p className="section-subtitle">Most viewed knowledge graphs from the last 30 days</p>
              </div>
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
            </div>
          )}

          {/* Show search results */}
          {renderSearchResults()}
        </div>
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
