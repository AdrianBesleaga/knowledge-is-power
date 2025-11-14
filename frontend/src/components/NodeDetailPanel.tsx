import { GraphNode } from '../types/graph';
import './NodeDetailPanel.css';

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
}

export const NodeDetailPanel = ({ node, onClose }: NodeDetailPanelProps) => {
  if (!node) return null;

  const getImpactColor = () => {
    if (node.category === 'central') return '#667eea';
    if (node.impactScore > 0) return '#10b981';
    if (node.impactScore < 0) return '#ef4444';
    return '#9ca3af';
  };

  const getImpactDescription = () => {
    if (node.category === 'central') return 'Main Topic';
    const absScore = Math.abs(node.impactScore);
    const strength = absScore > 0.7 ? 'Strong' : absScore > 0.4 ? 'Moderate' : 'Weak';
    const direction = node.impactScore > 0 ? 'positive' : 'negative';
    return `${strength} ${direction} impact`;
  };

  return (
    <div className="node-detail-overlay" onClick={onClose}>
      <div className="node-detail-panel" onClick={(e) => e.stopPropagation()}>
        <button className="panel-close" onClick={onClose}>
          ×
        </button>

        <div className="panel-header">
          <h2>{node.label}</h2>
          <span className="category-badge">{node.category}</span>
        </div>

        <div className="impact-section">
          <div className="impact-bar-container">
            <div className="impact-bar-bg">
              <div
                className="impact-bar-fill"
                style={{
                  width: `${Math.abs(node.impactScore) * 100}%`,
                  backgroundColor: getImpactColor(),
                }}
              />
            </div>
            <div className="impact-label">
              <span style={{ color: getImpactColor() }}>
                {getImpactDescription()}
              </span>
              <span className="impact-score">
                {node.impactScore >= 0 ? '+' : ''}{(node.impactScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="panel-section">
          <h3>Summary</h3>
          <p>{node.summary}</p>
        </div>

        {node.sources && node.sources.length > 0 && (
          <div className="panel-section">
            <h3>Information Sources</h3>
            <ul className="sources-list">
              {node.sources.map((source, idx) => (
                <li key={idx}>{source}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

