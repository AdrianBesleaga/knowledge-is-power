import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserGraphs, setAuthToken } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { KnowledgeGraph } from '../types/graph';
import './ProfilePage.css';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, signOut, getIdToken } = useAuth();
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const loadGraphs = async () => {
      try {
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
        }

        const userGraphs = await getUserGraphs();
        setGraphs(userGraphs);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load graphs');
        console.error('Error loading graphs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGraphs();
  }, [user, navigate, getIdToken]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your graphs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="header-content">
          <button className="back-button" onClick={() => navigate('/')}>
            ← Back
          </button>
          <h1 className="logo">Knowledge is Power</h1>
          <button className="btn-secondary" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-info">
          <h2>My Knowledge Graphs</h2>
          <p className="user-email">{user?.email}</p>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {graphs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>No saved graphs yet</h3>
            <p>Create your first knowledge graph to see it here</p>
            <button className="btn-primary" onClick={() => navigate('/')}>
              Create Graph
            </button>
          </div>
        ) : (
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
        )}
      </main>
    </div>
  );
};

