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
      // Wait a bit to ensure all content is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate canvas with high quality settings
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: null, // Transparent background to preserve gradient
        scale: 2, // Higher quality for social media
        logging: false,
        useCORS: true,
        allowTaint: true,
        removeContainer: false,
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
              <div className="infographic-logo">📊 Analysis Report</div>
              <h1 className="infographic-title">{graph.topic}</h1>
              {graph.summary && (
                <p className="infographic-subtitle">{graph.summary.substring(0, 180)}{graph.summary.length > 180 ? '...' : ''}</p>
              )}
            </div>

            {/* Main Content - Vertical Layout */}
            <div className="infographic-content">
              {/* Key Metrics Section */}
              <div className="infographic-stats">
                <div className="stat-card">
                  <div className="stat-value">{insights.totalFindings}</div>
                  <div className="stat-label">Key Findings</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: getImpactColor(insights.averageImpact) }}>
                    {formatImpactScore(insights.averageImpact)}
                  </div>
                  <div className="stat-label">Average Impact</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{insights.keyRelationships.length}</div>
                  <div className="stat-label">Key Relationships</div>
                </div>
              </div>

              {/* Top Findings Section */}
              {insights.topFindings.length > 0 && (
                <div className="infographic-top-nodes">
                  <h3 className="infographic-section-title">Top Findings</h3>
                  <div className="top-nodes-list">
                    {insights.topFindings.slice(0, 5).map((finding, idx) => (
                      <div key={idx} className="top-node-item">
                        <div className="top-node-rank">#{idx + 1}</div>
                        <div className="top-node-content">
                          <div className="top-node-label">{finding.label}</div>
                          <div className="top-node-summary">{finding.summary.substring(0, 100)}{finding.summary.length > 100 ? '...' : ''}</div>
                          <div className="top-node-impact">
                            <span
                              className="top-node-score"
                              style={{ color: getImpactColor(finding.impactScore) }}
                            >
                              {formatImpactScore(finding.impactScore)} Impact
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Impact Analysis Section */}
              <div className="infographic-insights">
                <h3 className="infographic-section-title">Impact Analysis</h3>
                <div className="insights-list">
                  <div className="insight-item">
                    <div className="insight-icon positive">✓</div>
                    <div className="insight-content">
                      <div className="insight-value">{insights.positiveFactors}</div>
                      <div className="insight-label">Positive Factors</div>
                    </div>
                  </div>
                  <div className="insight-item">
                    <div className="insight-icon negative">⚠</div>
                    <div className="insight-content">
                      <div className="insight-value">{insights.negativeFactors}</div>
                      <div className="insight-label">Risk Factors</div>
                    </div>
                  </div>
                  <div className="insight-item">
                    <div className="insight-icon neutral">○</div>
                    <div className="insight-content">
                      <div className="insight-value">{insights.neutralFactors}</div>
                      <div className="insight-label">Neutral Factors</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Relationships Section */}
              {insights.keyRelationships.length > 0 && (
                <div className="infographic-relationships">
                  <h3 className="infographic-section-title">Key Relationships</h3>
                  <div className="relationships-list">
                    {insights.keyRelationships.map((rel, idx) => (
                      <div key={idx} className="relationship-item">
                        <div className="relationship-content">
                          <div className="relationship-text">
                            <span className="relationship-source">{rel.source}</span>
                            <span className="relationship-arrow">→</span>
                            <span className="relationship-target">{rel.target}</span>
                          </div>
                          <div className="relationship-type">{rel.relationship}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="infographic-footer">
              <div className="infographic-footer-left">
                <span>Analysis Date: {formattedDate}</span>
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

