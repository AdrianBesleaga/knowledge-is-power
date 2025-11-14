import { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (topic: string) => void;
  loading?: boolean;
  initialValue?: string;
  buttonText?: string;
  loadingText?: string;
}

export const SearchBar = ({ 
  onSearch, 
  loading = false, 
  initialValue = '',
  buttonText = 'Generate Graph',
  loadingText = 'Generating...'
}: SearchBarProps) => {
  const [topic, setTopic] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim() && !loading) {
      onSearch(topic.trim());
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Enter a topic (e.g., Bitcoin price today, Climate change impact...)"
        disabled={loading}
        maxLength={200}
        className="search-input"
      />
      <button type="submit" disabled={loading || !topic.trim()} className="search-button">
        {loading && (
          <svg className="button-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
            <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}
        {loading ? loadingText : buttonText}
      </button>
    </form>
  );
};

