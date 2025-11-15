import { TimelineEntry, Prediction } from '../types/timeline';
import './TimelineSlider.css';

interface TimelineSliderProps {
  pastEntries: TimelineEntry[];
  presentEntry: TimelineEntry;
  predictions: Prediction[];
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
}

export const TimelineSlider = ({
  pastEntries,
  presentEntry,
  predictions,
  selectedPeriod,
  onPeriodChange,
}: TimelineSliderProps) => {
  // Create timeline periods array
  const periods: Array<{ id: string; label: string; type: 'past' | 'present' | 'future' }> = [];

  // Add past entries
  pastEntries.forEach((entry, idx) => {
    const date = new Date(entry.date);
    periods.push({
      id: `past-${idx}`,
      label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
      type: 'past',
    });
  });

  // Add present
  periods.push({
    id: 'present',
    label: 'Present',
    type: 'present',
  });

  // Add predictions
  predictions.forEach((prediction) => {
    periods.push({
      id: prediction.timeline,
      label: prediction.timeline,
      type: 'future',
    });
  });

  const selectedIndex = periods.findIndex((p) => p.id === selectedPeriod);

  return (
    <div className="timeline-slider">
      <div className="timeline-track">
        {periods.map((period, idx) => (
          <button
            key={period.id}
            className={`timeline-marker ${period.type} ${selectedPeriod === period.id ? 'active' : ''}`}
            onClick={() => onPeriodChange(period.id)}
            title={period.label}
          >
            <div className="marker-dot"></div>
            <span className="marker-label">{period.label}</span>
          </button>
        ))}
      </div>
      <div className="timeline-progress" style={{ width: `${(selectedIndex / (periods.length - 1)) * 100}%` }}></div>
    </div>
  );
};

