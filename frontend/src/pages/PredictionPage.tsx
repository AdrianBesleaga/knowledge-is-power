import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { generateTimeline, saveTimeline, setAuthToken, getTimelineBySlug, reprocessTimeline, getUserTimelines, saveTimelineVersion, getTimelineVersions } from '../services/api';
import { TimelineAnalysis, TimelineEntry, Prediction, TimelineVersion } from '../types/timeline';
import { TimelineChart } from '../components/TimelineChart';
import { PredictionModal } from '../components/PredictionModal';
import { ShareButton } from '../components/ShareButton';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import './PredictionPage.css';

export const PredictionPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineAnalysis | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [savedTimelines, setSavedTimelines] = useState<TimelineAnalysis[]>([]);
  const [loadingTimelines, setLoadingTimelines] = useState(false);
  const [reprocessedData, setReprocessedData] = useState<{ presentEntry: TimelineEntry; predictions: Prediction[] } | null>(null);
  const [versions, setVersions] = useState<TimelineVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);

  // Load saved timelines when no slug and user is logged in
  useEffect(() => {
    const loadSavedTimelines = async () => {
      if (slug || !user) return;

      try {
        setLoadingTimelines(true);
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
        }

        const timelines = await getUserTimelines();
        setSavedTimelines(timelines);
      } catch (err: any) {
        console.error('Error loading saved timelines:', err);
        // Don't show error for this, just log it
      } finally {
        setLoadingTimelines(false);
      }
    };

    loadSavedTimelines();
  }, [slug, user, getIdToken]);

  // Load versions when timeline is loaded and user owns it
  useEffect(() => {
    const loadVersions = async () => {
      if (!slug || !user || !timeline || timeline.userId !== user.uid) {
        if (!slug || !user) {
          setVersions([]);
          setSelectedVersion(null);
        }
        return;
      }

      try {
        setLoadingVersions(true);
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
        }
        const result = await getTimelineVersions(slug);
        setVersions(result.versions);
        // Set selected version to latest if not already set
        if (result.versions.length > 0 && selectedVersion === null) {
          setSelectedVersion(result.versions[0].version);
        }
      } catch (err: any) {
        // Silently fail - user might not own this timeline
        console.error('Error loading versions:', err);
        setVersions([]);
      } finally {
        setLoadingVersions(false);
      }
    };

    loadVersions();
  }, [slug, user, timeline, getIdToken]);

  // Load timeline by slug if provided
  useEffect(() => {
    const loadTimeline = async () => {
      if (!slug) {
        // Clear timeline state when navigating back to /timeline without slug
        setTimeline(null);
        setReprocessedData(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (user) {
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }
        }

        // Load timeline with selected version (or latest if none selected)
        const versionToLoad = selectedVersion || undefined;
        const loadedTimeline = await getTimelineBySlug(slug, versionToLoad);
        setTimeline(loadedTimeline);
        setReprocessedData(null); // Clear any reprocessed data when loading a timeline
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load timeline');
        console.error('Error loading timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [slug, user, getIdToken, selectedVersion]);

  // Auto-generate timeline after successful authentication if there's a pending topic
  useEffect(() => {
    if (user && pendingTopic && !showAuthModal) {
      const generatePendingTimeline = async () => {
        const topic = pendingTopic;
        setPendingTopic(null);

        setLoading(true);
        setError(null);

        try {
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }

          const result = await generateTimeline(topic);
          // Timeline is now automatically saved, use the saved timeline from the response
          setTimeline(result.timeline);
        } catch (err: any) {
          if (err.response?.status === 401) {
            setError('Please sign in to generate timelines');
            setShowAuthModal(true);
          } else {
            setError(err.response?.data?.error || 'Failed to generate timeline');
          }
          console.error('Error generating timeline:', err);
        } finally {
          setLoading(false);
        }
      };
      generatePendingTimeline();
    }
  }, [user, pendingTopic, showAuthModal, getIdToken]);

  const handleSearch = async (searchTopic: string) => {
    if (!user) {
      setPendingTopic(searchTopic);
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await generateTimeline(searchTopic);
      // Timeline is now automatically saved, use the saved timeline from the response
      setTimeline(result.timeline);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Please sign in to generate timelines');
        setShowAuthModal(true);
      } else {
        setError(err.response?.data?.error || 'Failed to generate timeline');
      }
      console.error('Error generating timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTimeline = async () => {
    if (!user || !timeline) {
      return;
    }

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await saveTimeline(
        timeline.topic,
        timeline.valueLabel,
        timeline.pastEntries,
        timeline.presentEntry,
        timeline.predictions,
        false
      );

      navigate(`/timeline/${result.timeline.slug}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save timeline');
      console.error('Error saving timeline:', err);
    }
  };

  const handleReprocess = async () => {
    if (!user || !timeline || !slug) {
      return;
    }

    setReprocessing(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await reprocessTimeline(slug);
      
      // Store reprocessed data (don't update timeline yet - user needs to save as version)
      setReprocessedData({
        presentEntry: result.presentEntry,
        predictions: result.predictions,
      });

      // Show success message
      const changePercent = timeline.presentEntry.value !== 0
        ? ((result.valueChange / timeline.presentEntry.value) * 100).toFixed(2)
        : '0';
      console.log(`Reprocessed: Value changed from ${result.previousValue} to ${result.newValue} (${changePercent}%)`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reprocess timeline');
      console.error('Error reprocessing timeline:', err);
    } finally {
      setReprocessing(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!user || !timeline || !slug || !reprocessedData) {
      return;
    }

    setSavingVersion(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await saveTimelineVersion(
        slug,
        reprocessedData.presentEntry,
        reprocessedData.predictions
      );
      
      // Update timeline with new version
      setTimeline(result.timeline);
      setReprocessedData(null);
      setSelectedVersion(result.version);

      // Reload versions
      const versionsResult = await getTimelineVersions(slug);
      setVersions(versionsResult.versions);

      console.log(`Saved as version ${result.version}`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save version');
      console.error('Error saving version:', err);
    } finally {
      setSavingVersion(false);
    }
  };

  const handleVersionChange = async (version: number) => {
    if (!slug) return;
    
    setSelectedVersion(version);
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const loadedTimeline = await getTimelineBySlug(slug, version);
      setTimeline(loadedTimeline);
      setReprocessedData(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load version');
      console.error('Error loading version:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle prediction click to show modal
  const handlePredictionClick = (prediction: Prediction) => {
    setSelectedPrediction(prediction);
    setShowPredictionModal(true);
  };

  // Handle timeline visibility change
  const handleTimelineVisibilityChange = (isPublic: boolean) => {
    if (timeline) {
      setTimeline({ ...timeline, isPublic });
    }
  };

  // Show saved timelines when no slug and no active timeline
  const showSavedTimelines = !slug && !timeline && user;

  return (
    <div className="prediction-page">
      <main className="prediction-main">
        <div className="hero-section">
          <h2 className="hero-title">Past-Present-Prediction Analysis</h2>
          <p className="hero-subtitle">
            AI-powered predictions with historical data, current state, and future scenarios
          </p>
          {!user && (
            <p className="hero-auth-hint">Sign in to generate AI predictions</p>
          )}

          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              buttonText="Generate AI Prediction"
              loadingText="Analyzing..."
              disabled={!user}
              disabledMessage="Sign in to generate AI predictions"
              onDisabledClick={() => setShowAuthModal(true)}
            />
          </div>

          {error && <div className="error-banner">{error}</div>}
        </div>

        {showSavedTimelines && (
          <div className="saved-timelines-section">
            <div className="section-header">
              <h2>My AI Predictions</h2>
              <p className="section-subtitle">Your saved AI predictions</p>
            </div>

            {loadingTimelines ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading saved AI predictions...</p>
              </div>
            ) : savedTimelines.length > 0 ? (
              <div className="timelines-grid">
                {savedTimelines.map((savedTimeline) => (
                  <div
                    key={savedTimeline.id}
                    className="timeline-card"
                    onClick={() => navigate(`/timeline/${savedTimeline.slug}`)}
                  >
                    <h3>{savedTimeline.topic}</h3>
                    <p className="timeline-card-value-label">Tracking: {savedTimeline.valueLabel}</p>
                    <div className="timeline-card-meta">
                      <span className="date">
                        {new Date(savedTimeline.createdAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span className="views">{savedTimeline.viewCount} views</span>
                    </div>
                    <div className="timeline-card-footer">
                      <span className={`visibility-badge ${savedTimeline.isPublic ? 'public' : 'private'}`}>
                        {savedTimeline.isPublic ? '🌐 Public' : '🔒 Private'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📈</div>
                <h3>No saved AI predictions yet</h3>
                <p>Generate your first AI prediction to see it here</p>
              </div>
            )}
          </div>
        )}

        {loading && !timeline && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Researching topic and generating AI prediction...</p>
            <p className="loading-hint">This may take 30-60 seconds</p>
          </div>
        )}

        {timeline && (
          <div className="timeline-section">
            <div className="timeline-header">
              <div>
                <h3>{timeline.topic}</h3>
                <p className="value-label">Tracking: {timeline.valueLabel}</p>
                {timeline.version && (
                  <p className="version-label">Version {timeline.version}</p>
                )}
              </div>
              <div className="timeline-actions">
                {slug && (
                  <ShareButton
                    url={`/timeline/${slug}`}
                    slug={slug}
                    timeline={timeline}
                    onVisibilityChange={handleTimelineVisibilityChange}
                  />
                )}
                {slug && user && timeline.userId === user.uid && (
                  <>
                    {reprocessedData ? (
                      <button 
                        className="btn-primary" 
                        onClick={handleSaveVersion}
                        disabled={savingVersion}
                      >
                        {savingVersion ? (
                          <>
                            <div className="button-spinner-small"></div>
                            Saving...
                          </>
                        ) : (
                          'Save as Version'
                        )}
                      </button>
                    ) : (
                      <button 
                        className="btn-secondary" 
                        onClick={handleReprocess}
                        disabled={reprocessing}
                      >
                        {reprocessing ? (
                          <>
                            <div className="button-spinner-small"></div>
                            Reprocessing...
                          </>
                        ) : (
                          'Reprocess'
                        )}
                      </button>
                    )}
                    {versions.length > 0 && (
                      <select
                        className="version-selector"
                        value={selectedVersion || timeline.version || 1}
                        onChange={(e) => handleVersionChange(parseInt(e.target.value, 10))}
                        disabled={loadingVersions || loading}
                      >
                        {versions.map((v) => (
                          <option key={v.version} value={v.version}>
                            Version {v.version} - {new Date(v.createdAt).toLocaleDateString()} ({v.presentValue.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    )}
                  </>
                )}
                {!slug && (
                  <button className="btn-primary" onClick={handleSaveTimeline}>
                    Save AI Prediction
                  </button>
                )}
              </div>
            </div>

            <div className="timeline-chart-container">
              <TimelineChart
                pastEntries={timeline.pastEntries}
                presentEntry={reprocessedData?.presentEntry || timeline.presentEntry}
                predictions={reprocessedData?.predictions || timeline.predictions}
                valueLabel={timeline.valueLabel}
                onPredictionClick={handlePredictionClick}
              />
            </div>
          </div>
        )}
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingTopic(null);
        }}
        onSuccess={() => {
          setShowAuthModal(false);
        }}
      />

      {timeline && (
        <PredictionModal
          isOpen={showPredictionModal}
          onClose={() => {
            setShowPredictionModal(false);
            setSelectedPrediction(null);
          }}
          prediction={selectedPrediction}
          valueLabel={timeline.valueLabel}
        />
      )}
    </div>
  );
};

