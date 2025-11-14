import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { GraphNode } from '../types/graph';
import './CustomNode.css';

interface CustomNodeProps {
  data: GraphNode & {
    level?: number;
    hasChildren?: boolean;
    isExpanded?: boolean;
    onClick: () => void;
  };
}

export const CustomNode = memo(({ data }: CustomNodeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getNodeClass = () => {
    if (data.category === 'central') {
      return 'node-central';
    }
    if (data.impactScore > 0) {
      return 'node-positive';
    }
    if (data.impactScore < 0) {
      return 'node-negative';
    }
    return 'node-neutral';
  };

  const getCategoryIcon = () => {
    switch (data.category) {
      case 'social': return '👥';
      case 'news': return '📰';
      case 'economic': return '💰';
      case 'technical': return '⚙️';
      case 'political': return '🏛️';
      case 'environmental': return '🌍';
      case 'central': return '🎯';
      default: return '📊';
    }
  };

  const getImpactText = () => {
    if (data.category === 'central') return '';
    const absScore = Math.abs(data.impactScore);
    if (absScore > 0.7) return data.impactScore > 0 ? 'High +' : 'High -';
    if (absScore > 0.4) return data.impactScore > 0 ? 'Med +' : 'Med -';
    return data.impactScore > 0 ? 'Low +' : 'Low -';
  };

  const getImpactColor = () => {
    if (data.category === 'central') return '#667eea';
    if (data.impactScore > 0) return '#10b981';
    if (data.impactScore < 0) return '#ef4444';
    return '#9ca3af';
  };

  const getImpactDescription = () => {
    if (data.category === 'central') return 'Main Topic';
    const absScore = Math.abs(data.impactScore);
    const strength = absScore > 0.7 ? 'Strong' : absScore > 0.4 ? 'Moderate' : 'Weak';
    const direction = data.impactScore > 0 ? 'positive' : 'negative';
    return `${strength} ${direction} impact`;
  };

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Add delay before hiding to allow moving to tooltip
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300); // 300ms delay to give time to move to tooltip
  };

  useEffect(() => {
    // Cleanup timeout on unmount
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className="custom-node-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover tooltip */}
      {isHovered && (
        <div 
          className="node-hover-tooltip"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="tooltip-header">
            <h3>{data.label}</h3>
            <span className="tooltip-category-badge">{data.category}</span>
          </div>
          
          <div className="tooltip-impact-section">
            <div className="tooltip-impact-bar-container">
              <div className="tooltip-impact-bar-bg">
                <div
                  className="tooltip-impact-bar-fill"
                  style={{
                    width: `${Math.abs(data.impactScore) * 100}%`,
                    backgroundColor: getImpactColor(),
                  }}
                />
              </div>
              <div className="tooltip-impact-label">
                <span style={{ color: getImpactColor() }}>
                  {getImpactDescription()}
                </span>
                <span className="tooltip-impact-score">
                  {data.impactScore >= 0 ? '+' : ''}{(data.impactScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="tooltip-summary">
            <p>{data.summary}</p>
          </div>

          {data.sources && data.sources.length > 0 && (
            <div className="tooltip-sources">
              <strong>Sources:</strong>
              <ul>
                {data.sources.slice(0, 3).map((source, idx) => {
                  const isUrl = source.startsWith('http://') || source.startsWith('https://');
                  return (
                    <li key={idx}>
                      {isUrl ? (
                        <a
                          href={source}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tooltip-source-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {source.length > 40 ? `${source.substring(0, 40)}...` : source}
                        </a>
                      ) : (
                        <span>{source.length > 40 ? `${source.substring(0, 40)}...` : source}</span>
                      )}
                    </li>
                  );
                })}
                {data.sources.length > 3 && (
                  <li className="tooltip-more-sources">+{data.sources.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <div 
        className={`custom-node ${getNodeClass()}`} 
        onClick={data.onClick}
      >
        {/* Handles for hierarchical connections (top/bottom) */}
        <Handle type="target" position={Position.Top} id="top" />
        <Handle type="source" position={Position.Bottom} id="bottom" />
        
        {/* Handles for same-level connections (left/right) */}
        <Handle type="target" position={Position.Left} id="left" />
        <Handle type="source" position={Position.Right} id="right" />
        
        {data.level !== undefined && (
          <div className="node-level-badge">{data.level}</div>
        )}
        
        {data.hasChildren && (
          <div className={`node-expand-indicator ${data.isExpanded ? 'expanded' : ''}`}>
            {data.isExpanded ? '▼' : '▶'}
          </div>
        )}
        
        <div className="node-content">
          <div className="node-icon">{getCategoryIcon()}</div>
          <div className="node-label">{data.label}</div>
          {data.category !== 'central' && (
            <div className="node-impact">{getImpactText()}</div>
          )}
        </div>
      </div>
    </div>
  );
});

CustomNode.displayName = 'CustomNode';

