import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { generateTimeline, saveTimeline, setAuthToken, getTimelineBySlug, reprocessTimeline } from '../services/api';
import { TimelineAnalysis, TimelineEntry, Prediction } from '../types/timeline';
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

  // Load timeline by slug if provided
  useEffect(() => {
    const loadTimeline = async () => {
      if (!slug) return;

      try {
        setLoading(true);
        setError(null);

        if (user) {
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }
        }

        const loadedTimeline = await getTimelineBySlug(slug);
        setTimeline(loadedTimeline);
        setTopic(loadedTimeline.topic);
        setSelectedPeriod('present');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load timeline');
        console.error('Error loading timeline:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTimeline();
  }, [slug, user, getIdToken]);

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
      
      // Update timeline with new data
      setTimeline(result.timeline);
      setSelectedPeriod('present');

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

  const getCurrentPeriodData = (): TimelineEntry | Prediction | null => {
    if (!timeline) return null;

    if (selectedPeriod === 'present') {
      return timeline.presentEntry;
    }

    // Check if it's a past entry
    const pastIndex = timeline.pastEntries.findIndex(
      (entry, idx) => `past-${idx}` === selectedPeriod
    );
    if (pastIndex !== -1) {
      return timeline.pastEntries[pastIndex];
    }

    // Check if it's a prediction
    const prediction = timeline.predictions.find(
      (pred) => pred.timeline === selectedPeriod
    );
    if (prediction) {
      return prediction;
    }

    return null;
  };

  const currentData = getCurrentPeriodData();
  const isPrediction = currentData && 'scenarios' in currentData;

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
              </div>
              <div className="timeline-actions">
                {slug && (
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
                presentEntry={timeline.presentEntry}
                predictions={timeline.predictions}
                valueLabel={timeline.valueLabel}
              />
            </div>

            <div className="timeline-slider-container">
              <TimelineSlider
                pastEntries={timeline.pastEntries}
                presentEntry={timeline.presentEntry}
                predictions={timeline.predictions}
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

