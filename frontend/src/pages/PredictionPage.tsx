import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { generateTimeline, setAuthToken, getTimelineBySlug, reprocessTimeline, getUserTimelines, saveTimelineVersion, getTimelineVersions, deleteTimeline, getPopularTimelines } from '../services/api';
import { TimelineAnalysis, TimelineEntry, Prediction, TimelineVersion } from '../types/timeline';
import { TimelineChart } from '../components/TimelineChart';
import { VerticalTimelineChart } from '../components/VerticalTimelineChart';
import { ShareButton } from '../components/ShareButton';
import { PremiumContentOverlay } from '../components/PremiumContentOverlay';
import { AuthModal } from '../components/AuthModal';
import { PredictionModal } from '../components/PredictionModal';
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
  const [popularTimelines, setPopularTimelines] = useState<TimelineAnalysis[]>([]);
  const [loadingPopularTimelines, setLoadingPopularTimelines] = useState(false);
  const [reprocessedData, setReprocessedData] = useState<{ presentEntry: TimelineEntry; predictions: Prediction[] } | null>(null);
  const [versions, setVersions] = useState<TimelineVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [isPremiumLocked, setIsPremiumLocked] = useState(false);
  const [premiumTimelineData, setPremiumTimelineData] = useState<any>(null);
  const loadedSlugRef = useRef<string | null>(null);

  // Load popular timelines when no slug
  useEffect(() => {
    const loadPopularTimelines = async () => {
      if (slug) return;

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
  }, [slug]);

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
  }, [slug, user]);

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
  }, [slug, user, timeline]);

  // Load timeline by slug if provided
  useEffect(() => {
    console.log('Timeline useEffect triggered:', { slug, selectedVersion, user: !!user, isPremiumLocked, loadedSlug: loadedSlugRef.current });
    const loadTimeline = async () => {
      if (!slug) {
        // Clear timeline state when navigating back to /predictions without slug
        setTimeline(null);
        setReprocessedData(null);
        setIsPremiumLocked(false);
        setPremiumTimelineData(null);
        loadedSlugRef.current = null;
        return;
      }

      // Don't load if we already loaded this slug
      if (loadedSlugRef.current === slug) {
        console.log('Skipping load - already loaded this slug');
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

        try {
          const loadedTimeline = await getTimelineBySlug(slug, versionToLoad);
          setTimeline(loadedTimeline);
          setIsPremiumLocked(false);
          setPremiumTimelineData(null);
          setReprocessedData(null); // Clear any reprocessed data when loading a timeline
          loadedSlugRef.current = slug; // Mark as loaded
          console.log('Timeline loaded successfully:', loadedTimeline?.topic, 'visibility:', loadedTimeline?.visibility);
        } catch (err: any) {
          // Handle premium content that requires payment
          if (err.response?.status === 402 && err.response?.data?.code === 'PREMIUM_CONTENT') {
            setIsPremiumLocked(true);
            setPremiumTimelineData(err.response.data.timeline);
            setTimeline(null);
            setError(null);
            loadedSlugRef.current = slug; // Mark as loaded (with premium data)
            console.log('Premium timeline detected, data loaded');
          } else {
            throw err;
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load timeline');
        console.error('Error loading timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [slug, user, selectedVersion]);

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
          // Timeline is now automatically saved, navigate to the timeline URL to show share button
          navigate(result.url);
        } catch (err: any) {
          if (err.response?.status === 401) {
            setError('Please sign in to generate timelines');
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
      // Timeline is now automatically saved, navigate to the timeline URL to show share button
      navigate(result.url);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Please sign in to generate timelines');
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
        setError(err.response?.data?.error || 'Failed to generate timeline');
      }
      console.error('Error generating timeline:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleReprocess = async () => {
    if (!user || !timeline || !slug || timeline.userId !== user.uid) {
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
    if (!user || !timeline || !slug || !reprocessedData || timeline.userId !== user.uid) {
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

    console.log('Version change triggered:', version);
    setSelectedVersion(version);
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      console.log('Making API call for version change:', slug, version);
      const loadedTimeline = await getTimelineBySlug(slug, version);
      setTimeline(loadedTimeline);
      setReprocessedData(null);
      // Note: loadedSlugRef stays the same since it's the same slug, just different version
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load version');
      console.error('Error loading version:', err);
    } finally {
      setLoading(false);
    }
  };


  // Handle timeline visibility change
  const handleTimelineVisibilityChange = (visibility: 'private' | 'public' | 'premium') => {
    if (timeline) {
      setTimeline({ ...timeline, visibility });
    }
  };

  // Handle prediction click to show modal
  const handlePredictionClick = (prediction: Prediction) => {
    setSelectedPrediction(prediction);
    setShowPredictionModal(true);
  };

  // Handle timeline deletion
  const handlePremiumUnlock = (unlockedTimeline: TimelineAnalysis) => {
    setTimeline(unlockedTimeline);
    setIsPremiumLocked(false);
    setPremiumTimelineData(null);
  };

  const handleDeleteTimeline = async () => {
    if (!user || !timeline || !slug || timeline.visibility === 'public' || timeline.userId !== user.uid) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      await deleteTimeline(slug);
      
      // Navigate back to timeline list after successful deletion
      navigate('/predictions');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete timeline');
      console.error('Error deleting timeline:', err);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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

        {!slug && (
          <>
            <div className="popular-timelines-section">
              <div className="section-header">
                <h2>Top 30 AI Predictions</h2>
                <p className="section-subtitle">Most viewed AI predictions from the last 30 days</p>
              </div>

              {loadingPopularTimelines ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading popular AI predictions...</p>
                </div>
              ) : popularTimelines.length > 0 ? (
                <div className="timelines-grid">
                  {popularTimelines.map((timeline) => (
                    <div
                      key={timeline.id}
                      className="timeline-card"
                      onClick={() => navigate(`/predictions/${timeline.slug}`)}
                    >
                      <h3>{timeline.topic}</h3>
                      <p className="timeline-card-value-label">Tracking: {timeline.valueLabel}</p>
                      <div className="timeline-card-meta">
                        <span className="date">
                          {new Date(timeline.createdAt).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span className="views">{timeline.viewCount} views</span>
                      </div>
                      <div className="timeline-card-footer">
                        <span className={`visibility-badge ${timeline.visibility === 'public' ? 'public' : timeline.visibility === 'premium' ? 'premium' : 'private'}`}>
                          {timeline.visibility === 'public' ? '🌐 Public' : timeline.visibility === 'premium' ? '💎 Premium' : '🔒 Private'}
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
                    onClick={() => navigate(`/predictions/${savedTimeline.slug}`)}
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
                      <span className={`visibility-badge ${savedTimeline.visibility === 'public' ? 'public' : savedTimeline.visibility === 'premium' ? 'premium' : 'private'}`}>
                        {savedTimeline.visibility === 'public' ? '🌐 Public' : savedTimeline.visibility === 'premium' ? '💎 Premium' : '🔒 Private'}
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
          </>
        )}

        {loading && !timeline && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Researching topic and generating AI prediction...</p>
            <p className="loading-hint">This may take 30-60 seconds</p>
          </div>
        )}

        {(timeline || (isPremiumLocked && premiumTimelineData)) && (
          <div className="timeline-section">
            <div className="timeline-header">
              <div>
                <h3>{isPremiumLocked && premiumTimelineData ? premiumTimelineData.topic : timeline.topic}</h3>
                <p className="value-label">Tracking: {isPremiumLocked && premiumTimelineData ? premiumTimelineData.valueLabel : timeline.valueLabel}</p>
                {(!isPremiumLocked && timeline.version) && (
                  <p className="version-label">Version {timeline.version}</p>
                )}
                {isPremiumLocked && <span className="premium-badge">💎 Premium</span>}
              </div>
              <div className="timeline-actions">
                {slug && (
                  <ShareButton
                    url={`/predictions/${slug}`}
                    slug={slug}
                    timeline={isPremiumLocked && premiumTimelineData ? premiumTimelineData : timeline}
                    onVisibilityChange={handleTimelineVisibilityChange}
                  />
                )}
                {slug && user && !isPremiumLocked && timeline.userId === user.uid && (
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
                    {!isPremiumLocked && timeline.visibility === 'private' && (
                      <button 
                        className="btn-danger" 
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={deleting}
                        title="Delete this private timeline"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="timeline-chart-container">
              {isPremiumLocked && premiumTimelineData ? (
                <PremiumContentOverlay
                  contentType="timeline"
                  slug={premiumTimelineData.slug}
                  topic={premiumTimelineData.topic}
                  onUnlock={handlePremiumUnlock}
                >
                  <TimelineChart
                    pastEntries={premiumTimelineData.pastEntries || []}
                    presentEntry={premiumTimelineData.presentEntry || { date: new Date().toISOString(), value: 0, valueLabel: 'Loading...', summary: 'Loading data...' }}
                    predictions={premiumTimelineData.predictions || []}
                    valueLabel={premiumTimelineData.valueLabel || 'Loading...'}
                    onPredictionClick={() => {}}
                  />
                </PremiumContentOverlay>
              ) : (
                <TimelineChart
                  pastEntries={timeline.pastEntries}
                  presentEntry={reprocessedData?.presentEntry || timeline.presentEntry}
                  predictions={reprocessedData?.predictions || timeline.predictions}
                  valueLabel={timeline.valueLabel}
                  onPredictionClick={handlePredictionClick}
                />
              )}
            </div>
            <div className="timeline-chart-container">
              {isPremiumLocked && premiumTimelineData ? (
                <PremiumContentOverlay
                  contentType="timeline"
                  slug={premiumTimelineData.slug}
                  topic={premiumTimelineData.topic}
                  onUnlock={handlePremiumUnlock}
                >
                  <VerticalTimelineChart
                    pastEntries={premiumTimelineData.pastEntries || []}
                    presentEntry={premiumTimelineData.presentEntry || { date: new Date().toISOString(), value: 0, valueLabel: 'Loading...', summary: 'Loading data...' }}
                    predictions={premiumTimelineData.predictions || []}
                    valueLabel={premiumTimelineData.valueLabel || 'Loading...'}
                  />
                </PremiumContentOverlay>
              ) : (
                <VerticalTimelineChart
                  pastEntries={timeline.pastEntries}
                  presentEntry={reprocessedData?.presentEntry || timeline.presentEntry}
                  predictions={reprocessedData?.predictions || timeline.predictions}
                  valueLabel={timeline.valueLabel}
                />
              )}
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

      <PredictionModal
        isOpen={showPredictionModal}
        onClose={() => {
          setShowPredictionModal(false);
          setSelectedPrediction(null);
        }}
        prediction={selectedPrediction}
        valueLabel={timeline?.valueLabel || ''}
      />


      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Timeline</h3>
            <p>Are you sure you want to delete "{timeline?.topic}"? This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={handleDeleteTimeline}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="button-spinner-small"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

