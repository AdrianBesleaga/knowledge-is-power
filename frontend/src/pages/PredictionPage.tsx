import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { generateTimeline, saveTimeline, setAuthToken, getTimelineBySlug, reprocessTimeline, getUserTimelines, saveTimelineVersion, getTimelineVersions } from '../services/api';
import { TimelineAnalysis, TimelineEntry, Prediction, TimelineVersion } from '../types/timeline';
import { TimelineSlider } from '../components/TimelineSlider';
import { TimelineChart } from '../components/TimelineChart';
import { PredictionCard } from '../components/PredictionCard';
import { AuthModal } from '../components/AuthModal';
import { useAuth } from '../hooks/useAuth';
import './PredictionPage.css';

export const PredictionPage = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [timeline, setTimeline] = useState<TimelineAnalysis | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('present');
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
        setTopic('');
        setSelectedPeriod('present');
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
        setTopic(loadedTimeline.topic);
        setSelectedPeriod('present');
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
        setTopic(topic);

        try {
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }

          const result = await generateTimeline(topic);
          setTimeline({
            id: '',
            slug: '',
            topic: result.topic,
            valueLabel: result.valueLabel,
            pastEntries: result.pastEntries,
            presentEntry: result.presentEntry,
            predictions: result.predictions,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: user.uid,
            isPublic: false,
            viewCount: 0,
          });
          setSelectedPeriod('present');
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
    setTopic(searchTopic);

    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      const result = await generateTimeline(searchTopic);
      setTimeline({
        id: '',
        slug: '',
        topic: result.topic,
        valueLabel: result.valueLabel,
        pastEntries: result.pastEntries,
        presentEntry: result.presentEntry,
        predictions: result.predictions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: user.uid,
        isPublic: false,
        viewCount: 0,
      });
      setSelectedPeriod('present');
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
      setSelectedPeriod('present');

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
      setSelectedPeriod('present');
      setReprocessedData(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load version');
      console.error('Error loading version:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPeriodData = (): TimelineEntry | Prediction | null => {
    if (!timeline) return null;

    // Use reprocessed data if available, otherwise use timeline data
    const currentPresentEntry = reprocessedData?.presentEntry || timeline.presentEntry;
    const currentPredictions = reprocessedData?.predictions || timeline.predictions;

    if (selectedPeriod === 'present') {
      return currentPresentEntry;
    }

    // Check if it's a past entry
    const pastIndex = timeline.pastEntries.findIndex(
      (entry, idx) => `past-${idx}` === selectedPeriod
    );
    if (pastIndex !== -1) {
      return timeline.pastEntries[pastIndex];
    }

    // Check if it's a prediction
    const prediction = currentPredictions.find(
      (pred) => pred.timeline === selectedPeriod
    );
    if (prediction) {
      return prediction;
    }

    return null;
  };

  const currentData = getCurrentPeriodData();
  const isPrediction = currentData && 'scenarios' in currentData;

  // Show saved timelines when no slug and no active timeline
  const showSavedTimelines = !slug && !timeline && user;

  return (
    <div className="prediction-page">
      <main className="prediction-main">
        <div className="hero-section">
          <h2 className="hero-title">Past-Present-Prediction Analysis</h2>
          <p className="hero-subtitle">
            AI-powered timeline analysis with historical data, current state, and future predictions
          </p>
          {!user && (
            <p className="hero-auth-hint">Sign in to generate timeline analyses</p>
          )}

          <div className="search-section">
            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              buttonText="Generate Timeline"
              loadingText="Analyzing..."
            />
          </div>

          {error && <div className="error-banner">{error}</div>}
        </div>

        {showSavedTimelines && (
          <div className="saved-timelines-section">
            <div className="section-header">
              <h2>My Saved Timelines</h2>
              <p className="section-subtitle">Your saved timeline analyses</p>
            </div>

            {loadingTimelines ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading saved timelines...</p>
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
                <h3>No saved timelines yet</h3>
                <p>Generate your first timeline analysis to see it here</p>
              </div>
            )}
          </div>
        )}

        {loading && !timeline && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Researching topic and generating timeline analysis...</p>
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
                    Save Timeline
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
              />
            </div>

            <div className="timeline-slider-container">
              <TimelineSlider
                pastEntries={timeline.pastEntries}
                presentEntry={reprocessedData?.presentEntry || timeline.presentEntry}
                predictions={reprocessedData?.predictions || timeline.predictions}
                selectedPeriod={selectedPeriod}
                onPeriodChange={setSelectedPeriod}
              />
            </div>

            <div className="period-details">
              {isPrediction && currentData && 'scenarios' in currentData ? (
                <div className="predictions-container">
                  <h4>Predictions for {currentData.timeline}</h4>
                  <div className="prediction-scenarios">
                    {currentData.scenarios.map((scenario) => (
                      <PredictionCard key={scenario.id} scenario={scenario} />
                    ))}
                  </div>
                </div>
              ) : currentData && 'date' in currentData ? (
                <div className="entry-details">
                  <h4>
                    {selectedPeriod === 'present'
                      ? 'Current State'
                      : new Date(currentData.date).toLocaleDateString()}
                  </h4>
                  <div className="entry-value">
                    <span className="value">{currentData.value}</span>
                    <span className="value-unit">{currentData.valueLabel}</span>
                  </div>
                  <p className="entry-summary">{currentData.summary}</p>
                  {currentData.sources.length > 0 && (
                    <div className="entry-sources">
                      <h5>Sources:</h5>
                      <ul>
                        {currentData.sources.map((source, idx) => (
                          <li key={idx}>
                            <a href={source} target="_blank" rel="noopener noreferrer">
                              {source}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
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
    </div>
  );
};

