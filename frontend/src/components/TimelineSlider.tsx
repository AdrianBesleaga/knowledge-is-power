import { TimelineEntry, Prediction } from '../types/timeline';
import './TimelineSlider.css';

interface TimelineSliderProps {
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onFuturePeriodClick?: (prediction: Prediction) => void;
}

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

interface Period {
  id: string;
  label: string;
  shortLabel: string;
  date: Date;
  type: 'past' | 'present' | 'future';
  originalLabel?: string;
}

export const TimelineSlider = ({
  pastEntries,
  presentEntry,
  predictions,
  selectedPeriod,
  onPeriodChange,
  onFuturePeriodClick,
}: TimelineSliderProps) => {
  const presentDate = new Date(presentEntry.date);
  const periods: Period[] = [];

  // Add past entries
  pastEntries.forEach((entry, idx) => {
    const date = new Date(entry.date);
    periods.push({
      id: `past-${idx}`,
      label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      shortLabel: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      date,
      type: 'past',
    });
  });

  // Add present
  periods.push({
    id: 'present',
    label: 'Present',
    shortLabel: 'Present',
    date: presentDate,
    type: 'present',
  });

  // Add predictions with actual dates
  predictions.forEach((prediction) => {
    const predictionDate = parseTimelineToDate(prediction.timeline, presentDate);
    periods.push({
      id: prediction.timeline,
      label: `${prediction.timeline} (${predictionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })})`,
      shortLabel: predictionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      date: predictionDate,
      type: 'future',
      originalLabel: prediction.timeline,
    });
  });

  // Sort by date
  periods.sort((a, b) => a.date.getTime() - b.date.getTime());

  const selectedIndex = periods.findIndex((p) => p.id === selectedPeriod);

  const handlePeriodClick = (period: Period) => {
    if (period.type === 'future' && onFuturePeriodClick) {
      // Find the prediction for this period
      const prediction = predictions.find((p) => p.timeline === period.id);
      if (prediction) {
        onFuturePeriodClick(prediction);
        return;
      }
    }
    // For past and present, use normal period change
    onPeriodChange(period.id);
  };

  return (
    <div className="timeline-slider">
      <div className="timeline-track">
        {periods.map((period) => (
          <button
            key={period.id}
            className={`timeline-marker ${period.type} ${selectedPeriod === period.id ? 'active' : ''}`}
            onClick={() => handlePeriodClick(period)}
            title={period.label}
          >
            <div className="marker-dot"></div>
            <span className="marker-label">{period.shortLabel}</span>
            {period.originalLabel && (
              <span className="marker-sublabel">{period.originalLabel}</span>
            )}
          </button>
        ))}
      </div>
      {periods.length > 1 && (
        <div 
          className="timeline-progress" 
          style={{ width: `${(selectedIndex / (periods.length - 1)) * 100}%` }}
        ></div>
      )}
    </div>
  );
};

