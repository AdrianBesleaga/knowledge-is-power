import { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TimelineEntry, Prediction } from '../types/timeline';
import { Sources } from './Sources';
import './TimelineChart.css';

interface TimelineChartProps {
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
  valueLabel: string;
  onPredictionClick?: (prediction: Prediction) => void;
}

// Helper function to parse timeline string (e.g., "1 month", "1 year", "2 years") and convert to Date
const parseTimelineToDate = (timeline: string, baseDate: Date): Date => {
  const normalized = timeline.toLowerCase().trim();
  const match = normalized.match(/^(\d+)\s*(month|months|year|years|y|m)$/);
  
  if (!match) {
    // If we can't parse it, return a date far in the future
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

// Custom tooltip component for historical/present points
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    // Don't show tooltip for prediction points (they have their own hover tooltip)
    if (data.type === 'prediction') {
      return null;
    }
    
    // Only show tooltip if there's at least one value available
    const hasHistoricalValue = data.historicalValue !== null && data.historicalValue !== undefined;
    
    if (!hasHistoricalValue) {
      return null;
    }
    
    // For present entry and past entries, show historicalValue
    const valueToShow = data.historicalValue;
    const hasSummary = data.summary && data.summary.trim().length > 0;
    const hasSources = data.sources && Array.isArray(data.sources) && data.sources.length > 0;
    
    // Show only what's available, similar to prediction tooltip logic
    return (
      <div className="custom-tooltip">
        <div className="tooltip-header">
          <span className="tooltip-label">{label}</span>
        </div>
        {valueToShow !== null && valueToShow !== undefined && (
          <div className="tooltip-value-container">
            <div className="tooltip-value" style={{ color: data.type === 'present' ? '#10b981' : '#667eea' }}>
              {valueToShow.toLocaleString()}
            </div>
          </div>
        )}
        {hasSummary && (
          <div className="tooltip-summary-section">
            <div className="tooltip-summary-text">{data.summary}</div>
          </div>
        )}
        {hasSources && (
          <Sources sources={data.sources} className="tooltip" />
        )}
      </div>
    );
  }
  return null;
};

// Inline prediction display component that shows all 3 scenarios horizontally
interface PredictionInlineDisplayProps {
  prediction: Prediction;
  onPredictionClick?: (prediction: Prediction) => void;
}

const PredictionInlineDisplay = ({ prediction, onPredictionClick: _onPredictionClick }: PredictionInlineDisplayProps) => {
  const getConfidenceColor = (score: number): string => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  // Helper function to get border color based on scenario type
  const getScenarioBorderColor = (scenario: { title: string; predictedValue?: number }, allScenarios: Array<{ title: string; predictedValue?: number }>): string => {
    const scenariosWithValues = allScenarios.filter((s) => s.predictedValue !== undefined);
    
    // If we have 3+ scenarios, categorize by value
    if (scenariosWithValues.length >= 3) {
      const sorted = [...scenariosWithValues].sort((a, b) => 
        (b.predictedValue || 0) - (a.predictedValue || 0)
      );
      
      if (scenario.predictedValue === sorted[0]?.predictedValue) {
        return '#10b981'; // Optimistic (green)
      } else if (scenario.predictedValue === sorted[sorted.length - 1]?.predictedValue) {
        return '#ef4444'; // Pessimistic (red)
      } else {
        return '#f59e0b'; // Neutral (orange)
      }
    }
    
    // Otherwise, try to identify by title
    const title = scenario.title.toLowerCase();
    if (/optimistic|bullish|strong|positive|growth/i.test(title)) {
      return '#10b981'; // Optimistic (green)
    } else if (/pessimistic|bearish|weak|negative|decline/i.test(title)) {
      return '#ef4444'; // Pessimistic (red)
    } else {
      return '#f59e0b'; // Neutral (orange)
    }
  };

  // Helper function to sort scenarios in order: optimistic, neutral, pessimistic
  const sortScenarios = (scenarios: Array<{ title: string; predictedValue?: number; id: string; summary?: string; sources?: string[]; confidenceScore?: number }>) => {
    const scenariosWithValues = scenarios.filter((s) => s.predictedValue !== undefined);
    
    // If we have 3+ scenarios, sort by value
    if (scenariosWithValues.length >= 3) {
      const sorted = [...scenariosWithValues].sort((a, b) => 
        (b.predictedValue || 0) - (a.predictedValue || 0)
      );
      
      const optimistic = sorted[0];
      const pessimistic = sorted[sorted.length - 1];
      const neutral = sorted.length >= 3 ? sorted[1] : sorted[0];
      
      // Return in order: optimistic, neutral, pessimistic
      const result: Array<typeof scenarios[0]> = [];
      if (optimistic) result.push(optimistic);
      if (neutral && neutral !== optimistic) result.push(neutral);
      if (pessimistic && pessimistic !== optimistic && pessimistic !== neutral) result.push(pessimistic);
      
      // Add any scenarios without values at the end
      const scenariosWithoutValues = scenarios.filter((s) => s.predictedValue === undefined);
      result.push(...scenariosWithoutValues);
      
      return result;
    }
    
    // Otherwise, try to identify by title
    const optimistic = scenarios.find((s) => 
      /optimistic|bullish|strong|positive|growth/i.test(s.title)
    );
    const pessimistic = scenarios.find((s) => 
      /pessimistic|bearish|weak|negative|decline/i.test(s.title)
    );
    const neutral = scenarios.find((s) => 
      /neutral|moderate|stable|baseline/i.test(s.title)
    );
    
    // Return in order: optimistic, neutral, pessimistic
    const result: Array<typeof scenarios[0]> = [];
    if (optimistic) result.push(optimistic);
    if (neutral) result.push(neutral);
    if (pessimistic) result.push(pessimistic);
    
    // Add any remaining scenarios
    const remaining = scenarios.filter((s) => 
      s !== optimistic && s !== neutral && s !== pessimistic
    );
    result.push(...remaining);
    
    return result;
  };

  if (!prediction || !prediction.scenarios || !Array.isArray(prediction.scenarios)) {
    return null;
  }

  // Sort scenarios in the correct order
  const sortedScenarios = sortScenarios(prediction.scenarios);

  return (
    <div className="prediction-inline-display">
      <div className="prediction-inline-header">
        <span className="prediction-inline-label">{prediction.timeline}</span>
      </div>
      <div className="prediction-inline-scenarios">
        {sortedScenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="prediction-inline-scenario"
            style={{
              borderColor: getScenarioBorderColor(scenario, prediction.scenarios),
            }}
          >
            <div className="scenario-inline-title">{scenario.title}</div>
            {scenario.predictedValue !== undefined && (
              <div className="scenario-inline-value">
                {scenario.predictedValue.toLocaleString()}
              </div>
            )}
            {scenario.summary && scenario.summary.trim().length > 0 && (
              <div className="scenario-inline-summary">
                {scenario.summary}
              </div>
            )}
            {scenario.sources && Array.isArray(scenario.sources) && scenario.sources.length > 0 && (
              <Sources sources={scenario.sources} className="inline" />
            )}
            <div className="scenario-inline-confidence">
              <span 
                className="scenario-inline-confidence-value"
                style={{ color: getConfidenceColor(scenario.confidenceScore ?? 0) }}
              >
                Confidence: {scenario.confidenceScore}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TimelineChart = ({
  pastEntries,
  presentEntry,
  predictions,
  valueLabel,
  onPredictionClick,
}: TimelineChartProps) => {
  const [hoveredPrediction, setHoveredPrediction] = useState<Prediction | null>(null);
  const [hoveredDateLabel, setHoveredDateLabel] = useState<string | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track window size for responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Helper function to categorize scenarios into Optimistic, Neutral, Pessimistic
  const categorizeScenarios = (scenarios: Array<{ title: string; predictedValue?: number }>) => {
    const scenariosWithValues = scenarios.filter((s) => s.predictedValue !== undefined);
    if (scenariosWithValues.length < 3) {
      // If we don't have 3 scenarios, try to identify by title
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
        optimistic: optimistic?.predictedValue ?? null,
        neutral: neutral?.predictedValue ?? null,
        pessimistic: pessimistic?.predictedValue ?? null,
      };
    }
    
    // Sort by value: highest = optimistic, middle = neutral, lowest = pessimistic
    const sorted = [...scenariosWithValues].sort((a, b) => 
      (b.predictedValue || 0) - (a.predictedValue || 0)
    );
    
    return {
      optimistic: sorted[0]?.predictedValue ?? null,
      neutral: sorted.length >= 3 ? sorted[1]?.predictedValue ?? null : sorted[0]?.predictedValue ?? null,
      pessimistic: sorted[sorted.length - 1]?.predictedValue ?? null,
    };
  };

  // Prepare data for chart with proper date handling
  const chartData: Array<{
    date: Date;
    dateLabel: string;
    historicalValue: number | null;
    optimisticValue: number | null;
    neutralValue: number | null;
    pessimisticValue: number | null;
    type: 'historical' | 'present' | 'prediction';
    originalLabel?: string;
    prediction?: Prediction; // Store full prediction object
    summary?: string; // Summary for historical/present entries
      sources?: string[]; // Sources for historical/present entries
  }> = [];

  const presentDate = new Date(presentEntry.date);

  // Add past entries
  pastEntries.forEach((entry) => {
    const date = new Date(entry.date);
    chartData.push({
      date,
      dateLabel: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      historicalValue: entry.value,
      optimisticValue: null,
      neutralValue: null,
      pessimisticValue: null,
      type: 'historical',
      summary: entry.summary,
      sources: entry.sources,
    });
  });

  // Add present (will be used as bridge between historical and predictions)
  chartData.push({
    date: presentDate,
    dateLabel: 'Present',
    historicalValue: presentEntry.value,
    optimisticValue: presentEntry.value, // Connect to predictions
    neutralValue: presentEntry.value, // Connect to predictions
    pessimisticValue: presentEntry.value, // Connect to predictions
    type: 'present',
    summary: presentEntry.summary,
    sources: presentEntry.sources,
  });

  // Add predictions with actual dates - separate lines for each scenario type
  predictions.forEach((prediction) => {
    const scenarios = categorizeScenarios(prediction.scenarios);
    
    if (scenarios.optimistic !== null || scenarios.neutral !== null || scenarios.pessimistic !== null) {
      const predictionDate = parseTimelineToDate(prediction.timeline, presentDate);
      
      chartData.push({
        date: predictionDate,
        dateLabel: predictionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        historicalValue: null,
        optimisticValue: scenarios.optimistic,
        neutralValue: scenarios.neutral,
        pessimisticValue: scenarios.pessimistic,
        type: 'prediction',
        originalLabel: prediction.timeline,
        prediction, // Store full prediction object
      });
    }
  });

  // Sort by date
  chartData.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Format Y-axis values
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toLocaleString();
  };

  // Calculate Y-axis domain with some padding
  const allValues = chartData
    .map((d) => [d.historicalValue, d.optimisticValue, d.neutralValue, d.pessimisticValue])
    .flat()
    .filter((v): v is number => v !== null && v !== undefined);
  
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue) * 0.1;
  const yDomain = [Math.max(0, minValue - padding), maxValue + padding];

  const handlePredictionMouseLeave = () => {
    // Delay hiding to allow moving to inline display
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredPrediction(null);
      setHoveredDateLabel(null);
      setTooltipStyle(null);
    }, 200);
  };

  const handleInlineDisplayMouseEnter = () => {
    // Cancel hide timeout when hovering over inline display
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleInlineDisplayMouseLeave = () => {
    // Hide inline display when leaving area
    setHoveredPrediction(null);
    setHoveredDateLabel(null);
    setTooltipStyle(null);
  };

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handle clicking outside tooltip on mobile to close it
  useEffect(() => {
    if (!isMobile || !hoveredPrediction) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.prediction-inline-display-wrapper') && 
          !target.closest('circle[fill="#10b981"], circle[fill="#f59e0b"], circle[fill="#ef4444"]')) {
        setHoveredPrediction(null);
        setHoveredDateLabel(null);
        setTooltipStyle(null);
      }
    };

    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMobile, hoveredPrediction]);

  // Helper function to create a dot component that shows as hovered when any dot at the same date is hovered
  const createPredictionDot = (color: string) => {
    return (props: any) => {
      const { cx, cy, payload } = props;
      // Only render for prediction points that have a prediction object
      if (payload?.type === 'prediction' && payload.prediction && payload.prediction.scenarios) {
        const isHovered = hoveredDateLabel === payload.dateLabel;
        const handleInteraction = (e: React.MouseEvent<SVGCircleElement> | React.TouchEvent<SVGCircleElement>) => {
          // Cancel any pending hide timeout
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
          }
          const chartWrapper = chartContainerRef.current;
          if (chartWrapper) {
            const wrapperRect = chartWrapper.getBoundingClientRect();
            const svgElement = e.currentTarget.closest('svg');
            if (svgElement) {
              const svgRect = svgElement.getBoundingClientRect();
              // Calculate position relative to viewport for tooltip positioning
              const x = cx + svgRect.left;
              const y = cy + svgRect.top;
              
              // Calculate tooltip position to keep it within viewport bounds
              const tooltipWidth = isMobile ? Math.min(window.innerWidth - 40, 320) : 600; // Responsive width - smaller on mobile
              const tooltipHeight = isMobile ? 250 : 200; // Estimated height - account for scrollable content
              const padding = 10;
              
              // Calculate left position - center on dot, but adjust if it would go outside viewport
              let left = x;
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;
              
              if (isMobile) {
                // On mobile, ensure tooltip stays fully within viewport
                // Calculate horizontal position
                const minLeft = tooltipWidth / 2 + padding;
                const maxLeft = viewportWidth - tooltipWidth / 2 - padding;
                left = Math.min(Math.max(minLeft, x), maxLeft);
                
                // Calculate vertical position - try above first, then below if needed
                let top = y - tooltipHeight - 10;
                let transform = 'translate(-50%, 0)';
                
                // If tooltip would go above viewport, show it below the dot
                if (top < padding) {
                  top = y + 20; // Show below dot
                  transform = 'translate(-50%, 0)';
                }
                
                // If tooltip would go below viewport, adjust to fit
                if (top + tooltipHeight > viewportHeight - padding) {
                  top = Math.max(padding, viewportHeight - tooltipHeight - padding);
                }
                
                setTooltipStyle({
                  left: `${left}px`,
                  top: `${top}px`,
                  transform: transform,
                  position: 'fixed',
                  maxHeight: `${viewportHeight - top - padding}px`,
                  overflowY: 'auto',
                });
              } else {
                // Calculate relative to wrapper for desktop
                const relativeX = cx + (svgRect.left - wrapperRect.left);
                const minLeft = tooltipWidth / 2 + padding;
                const maxLeft = wrapperRect.width - tooltipWidth / 2 - padding;
                
                // Adjust if tooltip would go outside left edge
                if (relativeX < minLeft) {
                  left = wrapperRect.left + minLeft;
                }
                // Adjust if tooltip would go outside right edge
                else if (relativeX > maxLeft) {
                  left = wrapperRect.left + maxLeft;
                }
                
                // Calculate top position - above the dot, but adjust if it would go outside top
                let top = y;
                const minTop = wrapperRect.top + padding;
                
                // If tooltip would go above chart, show it below the dot instead
                if (top - tooltipHeight - 10 < minTop) {
                  top = y + 20; // Show below dot
                  setTooltipStyle({
                    left: `${left}px`,
                    top: `${top}px`,
                    transform: 'translate(-50%, 0)',
                    position: 'fixed',
                  });
                } else {
                  setTooltipStyle({
                    left: `${left}px`,
                    top: `${top}px`,
                    transform: 'translate(-50%, calc(-100% - 10px))',
                    position: 'fixed',
                  });
                }
              }
              
              setHoveredPrediction(payload.prediction);
              setHoveredDateLabel(payload.dateLabel);
            }
          }
        };

        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={isHovered ? 8 : 6}
              fill={color}
              stroke="white"
              strokeWidth={isHovered ? 3 : 2}
              onMouseEnter={handleInteraction}
              onMouseLeave={handlePredictionMouseLeave}
              onTouchStart={handleInteraction}
              style={{ cursor: 'pointer', transition: 'all 0.2s', touchAction: 'manipulation' }}
            />
          </g>
        );
      }
      return null;
    };
  };

  // Custom dot components for each line
  const OptimisticDot = createPredictionDot('#10b981');
  const NeutralDot = createPredictionDot('#f59e0b');
  const PessimisticDot = createPredictionDot('#ef4444');

  // Helper function to create an active dot component that shows as hovered when any dot at the same date is hovered
  const createPredictionActiveDot = (color: string) => {
    return (props: any) => {
      const { cx, cy, payload } = props;
      // Only render for prediction points that have a prediction object
      if (payload?.type === 'prediction' && payload.prediction && payload.prediction.scenarios) {
        const isHovered = hoveredDateLabel === payload.dateLabel;
        const handleInteraction = (e: React.MouseEvent<SVGCircleElement> | React.TouchEvent<SVGCircleElement>) => {
          // Cancel any pending hide timeout
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
          }
          const chartWrapper = chartContainerRef.current;
          if (chartWrapper) {
            const wrapperRect = chartWrapper.getBoundingClientRect();
            const svgElement = e.currentTarget.closest('svg');
            if (svgElement) {
              const svgRect = svgElement.getBoundingClientRect();
              // Calculate position relative to viewport for tooltip positioning
              const x = cx + svgRect.left;
              const y = cy + svgRect.top;
              
              // Calculate tooltip position to keep it within viewport bounds
              const tooltipWidth = isMobile ? Math.min(window.innerWidth - 40, 320) : 600; // Responsive width - smaller on mobile
              const tooltipHeight = isMobile ? 250 : 200; // Estimated height - account for scrollable content
              const padding = 10;
              
              // Calculate left position - center on dot, but adjust if it would go outside viewport
              let left = x;
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;
              
              if (isMobile) {
                // On mobile, ensure tooltip stays fully within viewport
                // Calculate horizontal position
                const minLeft = tooltipWidth / 2 + padding;
                const maxLeft = viewportWidth - tooltipWidth / 2 - padding;
                left = Math.min(Math.max(minLeft, x), maxLeft);
                
                // Calculate vertical position - try above first, then below if needed
                let top = y - tooltipHeight - 10;
                let transform = 'translate(-50%, 0)';
                
                // If tooltip would go above viewport, show it below the dot
                if (top < padding) {
                  top = y + 20; // Show below dot
                  transform = 'translate(-50%, 0)';
                }
                
                // If tooltip would go below viewport, adjust to fit
                if (top + tooltipHeight > viewportHeight - padding) {
                  top = Math.max(padding, viewportHeight - tooltipHeight - padding);
                }
                
                setTooltipStyle({
                  left: `${left}px`,
                  top: `${top}px`,
                  transform: transform,
                  position: 'fixed',
                  maxHeight: `${viewportHeight - top - padding}px`,
                  overflowY: 'auto',
                });
              } else {
                // Calculate relative to wrapper for desktop
                const relativeX = cx + (svgRect.left - wrapperRect.left);
                const minLeft = tooltipWidth / 2 + padding;
                const maxLeft = wrapperRect.width - tooltipWidth / 2 - padding;
                
                // Adjust if tooltip would go outside left edge
                if (relativeX < minLeft) {
                  left = wrapperRect.left + minLeft;
                }
                // Adjust if tooltip would go outside right edge
                else if (relativeX > maxLeft) {
                  left = wrapperRect.left + maxLeft;
                }
                
                // Calculate top position - above the dot, but adjust if it would go outside top
                let top = y;
                const minTop = wrapperRect.top + padding;
                
                // If tooltip would go above chart, show it below the dot instead
                if (top - tooltipHeight - 10 < minTop) {
                  top = y + 20; // Show below dot
                  setTooltipStyle({
                    left: `${left}px`,
                    top: `${top}px`,
                    transform: 'translate(-50%, 0)',
                    position: 'fixed',
                  });
                } else {
                  setTooltipStyle({
                    left: `${left}px`,
                    top: `${top}px`,
                    transform: 'translate(-50%, calc(-100% - 10px))',
                    position: 'fixed',
                  });
                }
              }
              
              setHoveredPrediction(payload.prediction);
              setHoveredDateLabel(payload.dateLabel);
            }
          }
        };

        return (
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={isHovered ? 10 : 8}
              fill={color}
              stroke="white"
              strokeWidth={isHovered ? 3 : 2}
              onMouseEnter={handleInteraction}
              onMouseLeave={handlePredictionMouseLeave}
              onTouchStart={handleInteraction}
              style={{ cursor: 'pointer', transition: 'all 0.2s', touchAction: 'manipulation' }}
            />
          </g>
        );
      }
      return null;
    };
  };

  // Custom active dot components for each line
  const OptimisticActiveDot = createPredictionActiveDot('#10b981');
  const NeutralActiveDot = createPredictionActiveDot('#f59e0b');
  const PessimisticActiveDot = createPredictionActiveDot('#ef4444');

  return (
    <div className="timeline-chart">
      <div className="chart-header">
        <h4>Value Over Time</h4>
        <p className="chart-subtitle">{valueLabel}</p>
      </div>
      <div className="chart-container-wrapper" ref={chartContainerRef} style={{ position: 'relative' }}>
        <div className="chart-scrollable-content">
          <ResponsiveContainer width="100%" height={isMobile ? 350 : 450}>
          <LineChart 
            data={chartData} 
            margin={isMobile ? { top: 10, right: 10, left: 10, bottom: 60 } : { top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="dateLabel" 
              angle={isMobile ? -60 : -45} 
              textAnchor="end" 
              height={isMobile ? 60 : 80}
              interval={isMobile ? 'preserveStartEnd' : 0}
              tick={{ fontSize: isMobile ? 10 : 12, fill: '#666' }}
              tickMargin={isMobile ? 5 : 10}
            />
            <YAxis 
              label={isMobile ? undefined : { value: valueLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              domain={yDomain}
              tickFormatter={formatYAxis}
              tick={{ fontSize: isMobile ? 10 : 12, fill: '#666' }}
              width={isMobile ? 50 : 80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <ReferenceLine 
              x={chartData.find(d => d.type === 'present')?.dateLabel} 
              stroke="#10b981" 
              strokeDasharray="3 3"
              strokeWidth={2}
              label={{ value: 'Present', position: 'top', fill: '#10b981', fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="historicalValue"
              stroke="#667eea"
              strokeWidth={3}
              dot={{ r: 5, fill: '#667eea' }}
              activeDot={{ r: 7 }}
              name="Past"
              connectNulls={false}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="optimisticValue"
              stroke="#10b981"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={<OptimisticDot />}
              activeDot={<OptimisticActiveDot />}
              name="Optimistic"
              connectNulls={false}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="neutralValue"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={<NeutralDot />}
              activeDot={<NeutralActiveDot />}
              name="Neutral"
              connectNulls={false}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="pessimisticValue"
              stroke="#ef4444"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={<PessimisticDot />}
              activeDot={<PessimisticActiveDot />}
              name="Pessimistic"
              connectNulls={false}
              strokeLinecap="round"
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
        {hoveredPrediction && tooltipStyle && (
          <div
            className="prediction-inline-display-wrapper"
            style={tooltipStyle}
            onMouseEnter={handleInlineDisplayMouseEnter}
            onMouseLeave={handleInlineDisplayMouseLeave}
          >
            <PredictionInlineDisplay
              prediction={hoveredPrediction}
              onPredictionClick={onPredictionClick}
            />
          </div>
        )}
      </div>
    </div>
  );
};

