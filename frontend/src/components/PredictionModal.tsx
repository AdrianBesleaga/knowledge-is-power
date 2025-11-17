import { Prediction, ValueDirection } from '../types/timeline';
import { Sources } from './Sources';
import './PredictionModal.css';

interface PredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction | null;
  valueLabel: string;
  valueDirection: ValueDirection;
}

export const PredictionModal = ({ isOpen, onClose, prediction, valueLabel, valueDirection }: PredictionModalProps) => {
  const getConfidenceColor = (score: number): string => {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  // Helper function to get border color based on scenario type
  const getScenarioBorderColor = (scenario: { title: string; predictedValue?: number }, allScenarios: Array<{ title: string; predictedValue?: number }>): string => {
    const scenariosWithValues = allScenarios.filter((s) => s.predictedValue !== undefined);

    // If we have 3+ scenarios, categorize by value based on directionality
    if (scenariosWithValues.length >= 3) {
      const isHigherBetter = valueDirection === 'higher_is_better';
      const sorted = [...scenariosWithValues].sort((a, b) => {
        const aVal = a.predictedValue || 0;
        const bVal = b.predictedValue || 0;
        return isHigherBetter ? (bVal - aVal) : (aVal - bVal);
      });

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

    // If we have 3+ scenarios, sort by value based on directionality
    if (scenariosWithValues.length >= 3) {
      const isHigherBetter = valueDirection === 'higher_is_better';
      const sorted = [...scenariosWithValues].sort((a, b) => {
        const aVal = a.predictedValue || 0;
        const bVal = b.predictedValue || 0;
        return isHigherBetter ? (bVal - aVal) : (aVal - bVal);
      });

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

  if (!isOpen || !prediction) return null;

  // Sort scenarios in the correct order
  const sortedScenarios = sortScenarios(prediction.scenarios);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="prediction-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="prediction-modal-header">
          <h2>Predictions for {prediction.timeline}</h2>
          <p className="prediction-modal-subtitle">Three scenarios for {valueLabel}</p>
        </div>

        <div className="prediction-modal-scenarios">
          {sortedScenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="prediction-modal-scenario"
              style={{
                borderColor: getScenarioBorderColor(scenario, prediction.scenarios),
              }}
            >
              <div className="scenario-modal-title">{scenario.title}</div>
              {scenario.predictedValue !== undefined && (
                <div className="scenario-modal-value">
                  {scenario.predictedValue.toLocaleString()}
                </div>
              )}
              {scenario.summary && scenario.summary.trim().length > 0 && (
                <div className="scenario-modal-summary">
                  {scenario.summary}
                </div>
              )}
              {scenario.sources && Array.isArray(scenario.sources) && scenario.sources.length > 0 && (
                <div className="scenario-modal-sources">
                  <Sources sources={scenario.sources} className="modal" maxVisible={3} />
                </div>
              )}
              <div className="scenario-modal-confidence">
                <span
                  className="scenario-modal-confidence-value"
                  style={{ color: getConfidenceColor(scenario.confidenceScore ?? 0) }}
                >
                  Confidence: {scenario.confidenceScore}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

