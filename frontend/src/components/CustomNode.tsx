import { memo } from 'react';
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

  return (
    <div className={`custom-node ${getNodeClass()}`} onClick={data.onClick}>
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
  );
});

CustomNode.displayName = 'CustomNode';

