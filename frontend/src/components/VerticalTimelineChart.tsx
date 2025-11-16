import { useState, useRef, useEffect } from 'react';
import { TimelineEntry, Prediction } from '../types/timeline';
import { Sources } from './Sources';
import './VerticalTimelineChart.css';

interface VerticalTimelineChartProps {
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
  valueLabel: string;
}

export const VerticalTimelineChart = ({
  pastEntries,
  presentEntry,
  predictions,
  valueLabel,
}: VerticalTimelineChartProps) => {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Track window size for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Scroll to start of predictions on mount
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Find the first prediction item - it's after past entries and present entry
    const firstPredictionIndex = pastEntries.length + 1;
    
    setTimeout(() => {
      if (itemRefs.current[firstPredictionIndex]) {
        const predictionElement = itemRefs.current[firstPredictionIndex];
        if (predictionElement) {
          container.scrollTop = predictionElement.offsetTop;
        }
      }
    }, 50);
  }, [pastEntries.length]);


  // Helper function to parse timeline string and convert to Date
  const parseTimelineToDate = (timeline: string, baseDate: Date): Date => {
    const normalized = timeline.toLowerCase().trim();
    const match = normalized.match(/^(\d+)\s*(month|months|year|years|y|m)$/);
    
    if (!match) {
      return new Date(baseDate.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
    
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    
    const result = new Date(baseDate);
    if (unit === 'month' || unit === 'months' || unit === 'm') {
      result.setMonth(result.getMonth() + amount);
    } else if (unit === 'year' || unit === 'years' || unit === 'y') {
      result.setFullYear(result.getFullYear() + amount);
    }
    
    return result;
  };

  // Helper function to categorize scenarios
  const categorizeScenarios = (scenarios: Array<{ title: string; predictedValue?: number; summary?: string; confidenceScore?: number; sources?: string[] }>) => {
    const scenariosWithValues = scenarios.filter((s) => s.predictedValue !== undefined);
    
    if (scenariosWithValues.length >= 3) {
      const sorted = [...scenariosWithValues].sort((a, b) => 
        (b.predictedValue || 0) - (a.predictedValue || 0)
      );
      
      return {
        optimistic: {
          value: sorted[0]?.predictedValue ?? null,
          summary: sorted[0]?.summary,
          confidence: sorted[0]?.confidenceScore,
          sources: sorted[0]?.sources,
        },
        neutral: {
          value: sorted.length >= 3 ? sorted[1]?.predictedValue ?? null : sorted[0]?.predictedValue ?? null,
          summary: sorted.length >= 3 ? sorted[1]?.summary : sorted[0]?.summary,
          confidence: sorted.length >= 3 ? sorted[1]?.confidenceScore : sorted[0]?.confidenceScore,
          sources: sorted.length >= 3 ? sorted[1]?.sources : sorted[0]?.sources,
        },
        pessimistic: {
          value: sorted[sorted.length - 1]?.predictedValue ?? null,
          summary: sorted[sorted.length - 1]?.summary,
          confidence: sorted[sorted.length - 1]?.confidenceScore,
          sources: sorted[sorted.length - 1]?.sources,
        },
      };
    }
    
    const optimistic = scenariosWithValues.find((s) => 
      /optimistic|bullish|strong|positive|growth/i.test(s.title)
    );
    const pessimistic = scenariosWithValues.find((s) => 
      /pessimistic|bearish|weak|negative|decline/i.test(s.title)
    );
    const neutral = scenariosWithValues.find((s) => 
      /neutral|moderate|stable|baseline/i.test(s.title)
    );
    
    return {
      optimistic: {
        value: optimistic?.predictedValue ?? null,
        summary: optimistic?.summary,
        confidence: optimistic?.confidenceScore,
        sources: optimistic?.sources,
      },
      neutral: {
        value: neutral?.predictedValue ?? null,
        summary: neutral?.summary,
        confidence: neutral?.confidenceScore,
        sources: neutral?.sources,
      },
      pessimistic: {
        value: pessimistic?.predictedValue ?? null,
        summary: pessimistic?.summary,
        confidence: pessimistic?.confidenceScore,
        sources: pessimistic?.sources,
      },
    };
  };

  // Prepare data for vertical timeline
  const presentDate = new Date(presentEntry.date);
  const timelineData: Array<{
    date: Date;
    dateLabel: string;
    type: 'historical' | 'present' | 'prediction';
    historicalValue: number | null;
    optimisticValue: number | null;
    neutralValue: number | null;
    pessimisticValue: number | null;
    optimisticSummary?: string;
    neutralSummary?: string;
    pessimisticSummary?: string;
    optimisticConfidence?: number;
    neutralConfidence?: number;
    pessimisticConfidence?: number;
    optimisticSources?: string[];
    neutralSources?: string[];
    pessimisticSources?: string[];
    prediction?: Prediction;
    summary?: string;
    sources?: string[];
  }> = [];

  // Add past entries
  pastEntries.forEach((entry) => {
    const date = new Date(entry.date);
    timelineData.push({
      date,
      dateLabel: date.getFullYear().toString(),
      type: 'historical',
      historicalValue: entry.value,
      optimisticValue: null,
      neutralValue: null,
      pessimisticValue: null,
      summary: entry.summary,
      sources: entry.sources,
    });
  });

  // Add present entry
  timelineData.push({
    date: presentDate,
    dateLabel: presentDate.getFullYear().toString(),
    type: 'present',
    historicalValue: presentEntry.value,
    optimisticValue: null,
    neutralValue: null,
    pessimisticValue: null,
    summary: presentEntry.summary,
    sources: presentEntry.sources,
  });

  // Add predictions
  predictions.forEach((prediction) => {
    const futureDate = parseTimelineToDate(prediction.timeline, presentDate);
    const categorized = categorizeScenarios(prediction.scenarios || []);
    
    timelineData.push({
      date: futureDate,
      dateLabel: futureDate.getFullYear().toString(),
      type: 'prediction',
      historicalValue: null,
      optimisticValue: categorized.optimistic.value,
      neutralValue: categorized.neutral.value,
      pessimisticValue: categorized.pessimistic.value,
      optimisticSummary: categorized.optimistic.summary,
      neutralSummary: categorized.neutral.summary,
      pessimisticSummary: categorized.pessimistic.summary,
      optimisticConfidence: categorized.optimistic.confidence,
      neutralConfidence: categorized.neutral.confidence,
      pessimisticConfidence: categorized.pessimistic.confidence,
      optimisticSources: categorized.optimistic.sources,
      neutralSources: categorized.neutral.sources,
      pessimisticSources: categorized.pessimistic.sources,
      prediction,
    });
  });

  // Sort by date
  timelineData.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate value range for scaling
  const allValues = timelineData.flatMap(d => [
    d.historicalValue,
    d.optimisticValue,
    d.neutralValue,
    d.pessimisticValue,
  ]).filter((v): v is number => v !== null);
  
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // Format value for display
  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toLocaleString();
  };

  // Get confidence color
  const getConfidenceColor = (score: number): string => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };




  // Calculate positions for vertical line chart
  const getXPosition = (value: number | null): number => {
    if (value === null) return 0;
    return ((value - minValue) / valueRange) * 100;
  };

  return (
    <div className="vertical-timeline-chart">
      <div className="chart-header">
        <h4>Value Over Time (Vertical)</h4>
        <p className="chart-subtitle">{valueLabel}</p>
      </div>
      <div className="vertical-timeline-container" ref={chartContainerRef}>
        <div className="vertical-timeline-content">
          {/* Continuous vertical line behind all content */}
          <div className="timeline-vertical-line"></div>
          
          {timelineData.map((data, index) => {
            const nextData = timelineData[index + 1];
            const isLast = index === timelineData.length - 1;
            
            return (
              <div 
                key={index} 
                ref={(el) => { itemRefs.current[index] = el; }}
                className={`vertical-timeline-item ${data.type}`}
              >
                {/* Year in center */}
                <div className="timeline-year-section">
                  <div className="year-label-wrapper">
                    <div className="year-label">
                      <span className="year-text">{data.dateLabel}</span>
                      <span className="year-badge">
                        {data.type === 'historical' && 'Past'}
                        {data.type === 'present' && 'Present'}
                        {data.type === 'prediction' && 'Prediction'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Value and summary for historical/present - centered blue component */}
                {data.type !== 'prediction' && data.historicalValue !== null && (
                  <div className="historical-content-wrapper">
                    <div className="historical-content">
                      <div className="historical-value">{formatValue(data.historicalValue)}</div>
                      {data.summary && (
                        <div className="historical-summary">{data.summary}</div>
                      )}
                      {data.sources && data.sources.length > 0 && (
                        <Sources sources={data.sources} className="vertical" />
                      )}
                    </div>
                  </div>
                )}

                {/* Three columns for predictions */}
                {data.type === 'prediction' && data.prediction && (
                  <div className="prediction-columns-wrapper">
                    <div className="prediction-columns">
                      {data.optimisticValue !== null && (
                        <div className="prediction-column optimistic-column">
                          <div className="prediction-value">{formatValue(data.optimisticValue)}</div>
                          <div className="prediction-label">Optimistic</div>
                          {data.optimisticSummary && (
                            <div className="prediction-summary">{data.optimisticSummary}</div>
                          )}
                          {data.optimisticConfidence !== undefined && (
                            <div className="prediction-confidence">
                              <span className="confidence-label">Confidence:</span>
                              <span className="confidence-value" style={{ color: getConfidenceColor(data.optimisticConfidence) }}>{data.optimisticConfidence}%</span>
                            </div>
                          )}
                          {data.optimisticSources && data.optimisticSources.length > 0 && (
                            <Sources sources={data.optimisticSources} className="vertical" />
                          )}
                        </div>
                      )}
                      {data.neutralValue !== null && (
                        <div className="prediction-column neutral-column">
                          <div className="prediction-value">{formatValue(data.neutralValue)}</div>
                          <div className="prediction-label">Neutral</div>
                          {data.neutralSummary && (
                            <div className="prediction-summary">{data.neutralSummary}</div>
                          )}
                          {data.neutralConfidence !== undefined && (
                            <div className="prediction-confidence">
                              <span className="confidence-label">Confidence:</span>
                              <span className="confidence-value" style={{ color: getConfidenceColor(data.neutralConfidence) }}>{data.neutralConfidence}%</span>
                            </div>
                          )}
                          {data.neutralSources && data.neutralSources.length > 0 && (
                            <Sources sources={data.neutralSources} className="vertical" />
                          )}
                        </div>
                      )}
                      {data.pessimisticValue !== null && (
                        <div className="prediction-column pessimistic-column">
                          <div className="prediction-value">{formatValue(data.pessimisticValue)}</div>
                          <div className="prediction-label">Pessimistic</div>
                          {data.pessimisticSummary && (
                            <div className="prediction-summary">{data.pessimisticSummary}</div>
                          )}
                          {data.pessimisticConfidence !== undefined && (
                            <div className="prediction-confidence">
                              <span className="confidence-label">Confidence:</span>
                              <span className="confidence-value" style={{ color: getConfidenceColor(data.pessimisticConfidence) }}>{data.pessimisticConfidence}%</span>
                            </div>
                          )}
                          {data.pessimisticSources && data.pessimisticSources.length > 0 && (
                            <Sources sources={data.pessimisticSources} className="vertical" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

