import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { KnowledgeGraph } from '../types/graph';
import { extractGraphInsights, formatImpactScore, getImpactColor } from '../utils/infographicUtils';
import './InfographicGenerator.css';

interface InfographicGeneratorProps {
  graph: KnowledgeGraph;
  onClose: () => void;
}

export const InfographicGenerator = ({ graph, onClose }: InfographicGeneratorProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insights = extractGraphInsights(graph);

  const downloadInfographic = async () => {
    if (!canvasRef.current) return;

    setGenerating(true);
    setError(null);

    try {
      // Generate canvas with high quality settings
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality for social media
        logging: false,
        useCORS: true,
        width: 1200,
        height: 630,
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          setError('Failed to generate image');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${graph.slug}-infographic.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setGenerating(false);
      }, 'image/png');
    } catch (err) {
      console.error('Error generating infographic:', err);
      setError('Failed to generate infographic. Please try again.');
      setGenerating(false);
    }
  };

  // Format date
  const formattedDate = new Date(graph.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="infographic-modal-overlay" onClick={onClose}>
      <div className="infographic-modal" onClick={(e) => e.stopPropagation()}>
        <div className="infographic-modal-header">
          <h2>Generate Infographic</h2>
          <button className="infographic-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="infographic-preview-container">
          <div ref={canvasRef} className="infographic-canvas">
            {/* Header Section */}
            <div className="infographic-header">
              <div className="infographic-logo">🧠 Knowledge is Power</div>
              <h1 className="infographic-title">{graph.topic}</h1>
              {graph.summary && (
                <p className="infographic-subtitle">{graph.summary.substring(0, 150)}{graph.summary.length > 150 ? '...' : ''}</p>
              )}
            </div>

            {/* Main Content Grid */}
            <div className="infographic-content">
              {/* Left Column - Statistics */}
              <div className="infographic-stats">
                <div className="stat-card">
                  <div className="stat-value">{insights.totalNodes}</div>
                  <div className="stat-label">Nodes</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{insights.totalEdges}</div>
                  <div className="stat-label">Connections</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{insights.categories.length}</div>
                  <div className="stat-label">Categories</div>
                </div>
              </div>

              {/* Center Column - Top Nodes */}
              <div className="infographic-top-nodes">
                <h3 className="infographic-section-title">Top Impact Nodes</h3>
                <div className="top-nodes-list">
                  {insights.topNodesByImpact.slice(0, 4).length > 0 ? (
                    insights.topNodesByImpact.slice(0, 4).map((node, idx) => (
                      <div key={node.id} className="top-node-item">
                        <div className="top-node-rank">#{idx + 1}</div>
                        <div className="top-node-content">
                          <div className="top-node-label">{node.label}</div>
                          <div className="top-node-impact">
                            <span
                              className="top-node-score"
                              style={{ color: getImpactColor(node.impactScore, node.category) }}
                            >
                              {formatImpactScore(node.impactScore)}
                            </span>
                            <span className="top-node-category">{node.category}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="top-node-item">
                      <div className="top-node-content">
                        <div className="top-node-label">No nodes available</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Insights */}
              <div className="infographic-insights">
                <h3 className="infographic-section-title">Key Insights</h3>
                <div className="insights-list">
                  <div className="insight-item">
                    <div className="insight-icon positive">+</div>
                    <div className="insight-content">
                      <div className="insight-value">{insights.positiveNodes}</div>
                      <div className="insight-label">Positive Impact</div>
                    </div>
                  </div>
                  <div className="insight-item">
                    <div className="insight-icon negative">-</div>
                    <div className="insight-content">
                      <div className="insight-value">{insights.negativeNodes}</div>
                      <div className="insight-label">Negative Impact</div>
                    </div>
                  </div>
                  {insights.strongestRelationships.length > 0 && (
                    <div className="insight-item">
                      <div className="insight-icon relationship">🔗</div>
                      <div className="insight-content">
                        <div className="insight-value">{insights.strongestRelationships[0].relationship}</div>
                        <div className="insight-label">Strongest Link</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="infographic-footer">
              <div className="infographic-footer-left">
                <span>Created: {formattedDate}</span>
                <span>•</span>
                <span>{graph.viewCount} views</span>
              </div>
              <div className="infographic-footer-right">
                knowledgeispower.app
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="infographic-error">{error}</div>
        )}

        <div className="infographic-actions">
          <button
            className="infographic-download-btn"
            onClick={downloadInfographic}
            disabled={generating}
          >
            {generating ? 'Generating...' : '📥 Download Infographic'}
          </button>
          <button className="infographic-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

