import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchGraphs, searchNodes, getPopularGraphs, getGraphsByCategory, setAuthToken } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { KnowledgeGraph, GraphNode } from '../types/graph';
import { SearchBar } from '../components/SearchBar';
import './SearchPage.css';

type SearchType = 'graphs' | 'nodes' | 'popular' | 'category';

const CATEGORIES = ['social', 'news', 'economic', 'technical', 'political', 'environmental', 'central'];

export const SearchPage = () => {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [searchType, setSearchType] = useState<SearchType>('graphs');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [nodeGraphs, setNodeGraphs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    const loadAuth = async () => {
      if (user) {
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
        }
      }
    };
    loadAuth();
  }, [user, getIdToken]);

  useEffect(() => {
    const initialQuery = searchParams.get('q');
    const initialCategory = searchParams.get('category');
    const initialType = searchParams.get('type') as SearchType || 'graphs';

    if (initialQuery) {
      setQuery(initialQuery);
      setSearchType(initialType);
      if (initialCategory) {
        setCategory(initialCategory);
      }
      handleSearch(initialQuery, initialType, initialCategory);
    } else if (initialType === 'popular') {
      setSearchType('popular');
      loadPopularGraphs();
    } else if (initialCategory) {
      setSearchType('category');
      setCategory(initialCategory);
      loadGraphsByCategory(initialCategory);
    }
  }, []);

  const handleSearch = async (searchQuery: string, type: SearchType = searchType, searchCategory?: string) => {
    if (!searchQuery.trim() && type !== 'popular' && type !== 'category') {
      return;
    }

    setLoading(true);
    setError(null);
    setOffset(0);

    try {
      if (type === 'graphs') {
        const result = await searchGraphs(searchQuery, limit, 0, user ? 'me' : undefined);
        setGraphs(result.graphs);
        setTotal(result.total);
        setNodes([]);
        setNodeGraphs([]);
      } else if (type === 'nodes') {
        const result = await searchNodes(searchQuery, searchCategory || category || undefined, 50);
        setNodes(result.nodes);
        setNodeGraphs(result.graphs);
        setGraphs([]);
        setTotal(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search');
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPopularGraphs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPopularGraphs(limit, 30);
      setGraphs(result.graphs);
      setTotal(result.graphs.length);
      setNodes([]);
      setNodeGraphs([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load popular graphs');
      console.error('Error loading popular graphs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGraphsByCategory = async (cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGraphsByCategory(cat, limit, 0);
      setGraphs(result.graphs);
      setTotal(result.total);
      setNodes([]);
      setNodeGraphs([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load graphs by category');
      console.error('Error loading graphs by category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loading || searchType !== 'graphs') return;

    setLoading(true);
    try {
      const newOffset = offset + limit;
      const result = await searchGraphs(query, limit, newOffset, user ? 'me' : undefined);
      setGraphs([...graphs, ...result.graphs]);
      setOffset(newOffset);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load more');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: SearchType) => {
    setSearchType(type);
    setQuery('');
    setCategory('');
    setGraphs([]);
    setNodes([]);
    setNodeGraphs([]);
    setTotal(0);
    setOffset(0);
    setSearchParams({});

    if (type === 'popular') {
      loadPopularGraphs();
    }
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    setSearchType('category');
    setSearchParams({ category: cat, type: 'category' });
    loadGraphsByCategory(cat);
  };

  return (
    <div className="search-page">
      <main className="search-main">
        <div className="search-controls">
          <div className="search-tabs">
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

          {searchType === 'graphs' && (
            <div className="search-input-section">
              <SearchBar
                onSearch={(q) => {
                  setQuery(q);
                  setSearchParams({ q, type: 'graphs' });
                  handleSearch(q, 'graphs');
                }}
                loading={loading}
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
                loading={loading}
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
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {loading && graphs.length === 0 && nodes.length === 0 && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Searching...</p>
          </div>
        )}

        {!loading && searchType === 'graphs' && graphs.length > 0 && (
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
              <button className="load-more-button" onClick={handleLoadMore} disabled={loading}>
                {loading ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>
        )}

        {!loading && searchType === 'nodes' && nodes.length > 0 && (
          <div className="search-results">
            <div className="results-header">
              <h2>Found {nodes.length} node{nodes.length !== 1 ? 's' : ''} in {nodeGraphs.length} graph{nodeGraphs.length !== 1 ? 's' : ''}</h2>
            </div>
            <div className="nodes-list">
              {nodes.map((node, idx) => (
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
        )}

        {!loading && searchType === 'popular' && graphs.length > 0 && (
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

        {!loading && searchType === 'category' && graphs.length > 0 && (
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

        {!loading && 
         ((searchType === 'graphs' && graphs.length === 0 && query) ||
          (searchType === 'nodes' && nodes.length === 0 && query) ||
          (searchType === 'popular' && graphs.length === 0) ||
          (searchType === 'category' && graphs.length === 0 && category)) && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No results found</h3>
            <p>Try a different search query or browse popular graphs</p>
          </div>
        )}
      </main>
    </div>
  );
};

