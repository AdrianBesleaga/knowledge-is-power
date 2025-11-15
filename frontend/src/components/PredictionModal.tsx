import { Prediction } from '../types/timeline';
import { PredictionCard } from './PredictionCard';
import './PredictionModal.css';

interface PredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction | null;
  valueLabel: string;
}

export const PredictionModal = ({ isOpen, onClose, prediction, valueLabel }: PredictionModalProps) => {
  if (!isOpen || !prediction) return null;

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
          {prediction.scenarios.map((scenario) => (
            <PredictionCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      </div>
    </div>
  );
};

