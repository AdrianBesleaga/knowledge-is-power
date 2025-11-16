import './Sources.css';

interface SourcesProps {
  sources: string[];
  className?: string;
  maxVisible?: number;
}

export const Sources = ({ sources, className = '', maxVisible = 2 }: SourcesProps) => {
  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className={`sources-section ${className}`}>
      <div className="sources-icon">?</div>
      <div className="sources-tooltip">
        <div className="sources-tooltip-header">Sources</div>
        <div className="sources-list">
          {sources.slice(0, maxVisible).map((source: string, index: number) => (
            <a
              key={index}
              href={source}
              target="_blank"
              rel="noopener noreferrer"
              className="source-link"
              onClick={(e) => e.stopPropagation()}
              title={source}
            >
              {source.length > 40 ? `${source.substring(0, 37)}...` : source}
            </a>
          ))}
          {sources.length > maxVisible && (
            <span className="sources-more">+{sources.length - maxVisible} more</span>
          )}
        </div>
      </div>
    </div>
  );
};

