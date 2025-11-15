import { PredictionScenario } from '../types/timeline';
import './PredictionCard.css';

interface PredictionCardProps {
  scenario: PredictionScenario;
}

export const PredictionCard = ({ scenario }: PredictionCardProps) => {
  const getConfidenceColor = (score: number): string => {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  };

  return (
    <div className="prediction-card">
      <div className="prediction-card-header">
        <h5 className="scenario-title">{scenario.title}</h5>
        <div className={`confidence-badge ${getConfidenceColor(scenario.confidenceScore)}`}>
          {scenario.confidenceScore}% confidence
        </div>
      </div>
      {scenario.predictedValue !== undefined && (
        <div className="predicted-value">
          Predicted Value: <strong>{scenario.predictedValue}</strong>
        </div>
      )}
      <p className="scenario-summary">{scenario.summary}</p>
      {scenario.sources.length > 0 && (
        <div className="scenario-sources">
          <h6>Sources:</h6>
          <ul>
            {scenario.sources.map((source, idx) => (
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
  );
};

