import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserGraphs, getUserProfile, setAuthToken } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { KnowledgeGraph } from '../types/graph';
import './ProfilePage.css';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([]);
  const [credits, setCredits] = useState<number>(0);
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

        const [userGraphs, profile] = await Promise.all([
          getUserGraphs(),
          getUserProfile()
        ]);
        setGraphs(userGraphs);
        setCredits(profile.credits);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load profile');
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGraphs();
  }, [user, navigate, getIdToken]);


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
      <main className="profile-main">
        <div className="profile-info">
          <div className="profile-header">
            <div>
              <h2>My Profile</h2>
              <p className="user-email">{user?.email}</p>
            </div>
            <div className="credit-display">
              <div className="credit-badge">
                <span className="credit-icon">💎</span>
                <div className="credit-info">
                  <span className="credit-label">Credits</span>
                  <span className="credit-amount">{credits}</span>
                </div>
              </div>
              <button
                className="btn-buy-credits"
                onClick={() => navigate('/buy-credits')}
              >
                Buy Credits
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="profile-section">
          <h3>My Knowledge Graphs</h3>
        </div>

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
              <div className="visibility-badge-overlay">
                <span className={`visibility-badge ${graph.visibility === 'public' ? 'public' : graph.visibility === 'premium' ? 'premium' : 'private'}`}>
                  {graph.visibility === 'public' ? '🌐' : graph.visibility === 'premium' ? '💎' : '🔒'}
                </span>
              </div>
              <h3>{graph.topic}</h3>
                <div className="graph-card-meta">
                  <span className="date">
                    {new Date(graph.createdAt).toLocaleDateString()}
                  </span>
                  <span className="views">{graph.viewCount} views</span>
                </div>
                <div className="graph-card-footer">
                  <span className={`visibility-badge ${graph.visibility === 'public' ? 'public' : graph.visibility === 'premium' ? 'premium' : 'private'}`}>
                    {graph.visibility === 'public' ? '🌐 Public' : graph.visibility === 'premium' ? '💎 Premium' : '🔒 Private'}
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

