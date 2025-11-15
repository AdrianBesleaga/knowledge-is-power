import { useState, useRef, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TimelineEntry, Prediction } from '../types/timeline';
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
    const hasPredictionValue = data.predictionValue !== null && data.predictionValue !== undefined;
    
    if (!hasHistoricalValue && !hasPredictionValue) {
      return null;
    }
    
    // For present entry, prefer historicalValue (they're the same, but historicalValue is more appropriate)
    // For past entries, show historicalValue
    const valueToShow = hasHistoricalValue ? data.historicalValue : data.predictionValue;
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
          <div className="tooltip-sources-section">
            <div className="tooltip-sources-label">Sources</div>
            <div className="tooltip-sources-list">
              {data.sources.slice(0, 2).map((source: string, index: number) => (
                <a 
                  key={index}
                  href={source} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="tooltip-source-link"
                  onClick={(e) => e.stopPropagation()}
                  title={source}
                >
                  {source.length > 40 ? `${source.substring(0, 37)}...` : source}
                </a>
              ))}
              {data.sources.length > 2 && (
                <span className="tooltip-sources-more">+{data.sources.length - 2} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Prediction tooltip component that shows all 3 scenarios
interface PredictionTooltipProps {
  prediction: Prediction;
  dateLabel: string;
  onPredictionClick?: (prediction: Prediction) => void;
  position: { x: number; y: number };
}

const PredictionTooltip = ({ prediction, dateLabel, onPredictionClick, position }: PredictionTooltipProps) => {
  const getConfidenceColor = (score: number): string => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div 
      className="prediction-hover-tooltip"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="prediction-tooltip-header">
        <span className="prediction-tooltip-label">{prediction.timeline}</span>
      </div>
      <div className="prediction-tooltip-scenarios">
        {prediction.scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="prediction-tooltip-scenario"
            onClick={() => onPredictionClick?.(prediction)}
          >
            <div className="scenario-tooltip-header">
              <span className="scenario-tooltip-title">{scenario.title}</span>
              <span 
                className="scenario-tooltip-confidence"
                style={{ color: getConfidenceColor(scenario.confidenceScore) }}
              >
                {scenario.confidenceScore}%
              </span>
            </div>
            {scenario.predictedValue !== undefined && (
              <div className="scenario-tooltip-value">
                {scenario.predictedValue.toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="prediction-tooltip-footer">
        Click to view details
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
  const [hoveredPrediction, setHoveredPrediction] = useState<{ prediction: Prediction; dateLabel: string; position: { x: number; y: number } } | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prepare data for chart with proper date handling
  const chartData: Array<{
    date: Date;
    dateLabel: string;
    historicalValue: number | null;
    predictionValue: number | null;
    predictionRange?: { min: number; max: number };
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
      predictionValue: null,
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
    predictionValue: presentEntry.value, // Connect to predictions
    type: 'present',
    summary: presentEntry.summary,
    sources: presentEntry.sources,
  });

  // Add predictions with actual dates
  predictions.forEach((prediction) => {
    const scenariosWithValues = prediction.scenarios.filter((s) => s.predictedValue !== undefined);
    if (scenariosWithValues.length > 0) {
      const values = scenariosWithValues.map((s) => s.predictedValue || 0);
      const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      
      const predictionDate = parseTimelineToDate(prediction.timeline, presentDate);
      
      chartData.push({
        date: predictionDate,
        dateLabel: predictionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
        historicalValue: null,
        predictionValue: avgValue,
        predictionRange: { min: minValue, max: maxValue },
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
    .map((d) => [d.historicalValue, d.predictionValue, d.predictionRange?.min, d.predictionRange?.max])
    .flat()
    .filter((v): v is number => v !== null && v !== undefined);
  
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = (maxValue - minValue) * 0.1;
  const yDomain = [Math.max(0, minValue - padding), maxValue + padding];

  const handlePredictionMouseLeave = () => {
    // Delay hiding to allow moving to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredPrediction(null);
    }, 200);
  };

  const handleTooltipMouseEnter = () => {
    // Cancel hide timeout when hovering over tooltip
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    // Hide tooltip when leaving tooltip area
    setHoveredPrediction(null);
  };

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Custom dot component for prediction points with hover
  const PredictionDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload?.type === 'prediction' && payload.prediction) {
      const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>) => {
        // Cancel any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        const chartWrapper = document.querySelector('.chart-container-wrapper');
        if (chartWrapper) {
          const wrapperRect = chartWrapper.getBoundingClientRect();
          const svgElement = e.currentTarget.closest('svg');
          if (svgElement) {
            const svgRect = svgElement.getBoundingClientRect();
            // Convert SVG coordinates to container coordinates
            const x = cx + (svgRect.left - wrapperRect.left);
            const y = cy + (svgRect.top - wrapperRect.top);
            setHoveredPrediction({
              prediction: payload.prediction,
              dateLabel: payload.dateLabel,
              position: {
                x: x, // Center tooltip above point
                y: y - 5, // Position directly above the point
              },
            });
          }
        }
      };

      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={6}
            fill="#10b981"
            stroke="white"
            strokeWidth={2}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handlePredictionMouseLeave}
            style={{ cursor: 'pointer' }}
          />
        </g>
      );
    }
    return null;
  };

  // Custom active dot for prediction points
  const PredictionActiveDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (payload?.type === 'prediction' && payload.prediction) {
      const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>) => {
        // Cancel any pending hide timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        const chartWrapper = document.querySelector('.chart-container-wrapper');
        if (chartWrapper) {
          const wrapperRect = chartWrapper.getBoundingClientRect();
          const svgElement = e.currentTarget.closest('svg');
          if (svgElement) {
            const svgRect = svgElement.getBoundingClientRect();
            const x = cx + (svgRect.left - wrapperRect.left);
            const y = cy + (svgRect.top - wrapperRect.top);
            setHoveredPrediction({
              prediction: payload.prediction,
              dateLabel: payload.dateLabel,
              position: {
                x: x,
                y: y - 5,
              },
            });
          }
        }
      };

      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={8}
            fill="#10b981"
            stroke="white"
            strokeWidth={2}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handlePredictionMouseLeave}
            style={{ cursor: 'pointer' }}
          />
        </g>
      );
    }
    return null;
  };

  return (
    <div className="timeline-chart">
      <div className="chart-header">
        <h4>Value Over Time</h4>
        <p className="chart-subtitle">{valueLabel}</p>
      </div>
      <div className="chart-container-wrapper" style={{ position: 'relative' }}>
        <ResponsiveContainer width="100%" height={450}>
          <LineChart 
            data={chartData} 
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="dateLabel" 
              angle={-45} 
              textAnchor="end" 
              height={80}
              interval={0}
              tick={{ fontSize: 12, fill: '#666' }}
              tickMargin={10}
            />
            <YAxis 
              label={{ value: valueLabel, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
              domain={yDomain}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 12, fill: '#666' }}
              width={80}
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
              name="Historical & Present"
              connectNulls={false}
              strokeLinecap="round"
            />
            <Line
              type="monotone"
              dataKey="predictionValue"
              stroke="#10b981"
              strokeWidth={3}
              strokeDasharray="8 4"
              dot={<PredictionDot />}
              activeDot={<PredictionActiveDot />}
              name="Predictions (Average)"
              connectNulls={false}
              strokeLinecap="round"
            />
          </LineChart>
        </ResponsiveContainer>
        {hoveredPrediction && (
          <div
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
          >
            <PredictionTooltip
              prediction={hoveredPrediction.prediction}
              dateLabel={hoveredPrediction.dateLabel}
              onPredictionClick={onPredictionClick}
              position={hoveredPrediction.position}
            />
          </div>
        )}
      </div>
    </div>
  );
};

