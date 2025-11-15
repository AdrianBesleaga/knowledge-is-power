import { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (topic: string) => void;
  loading?: boolean;
  initialValue?: string;
  buttonText?: string;
  loadingText?: string;
  disabled?: boolean;
  disabledMessage?: string;
  onDisabledClick?: () => void;
}

export const SearchBar = ({ 
  onSearch, 
  loading = false, 
  initialValue = '',
  buttonText = 'Generate Graph',
  loadingText = 'Generating...',
  disabled = false,
  disabledMessage = 'Please sign in to continue',
  onDisabledClick
}: SearchBarProps) => {
  const [topic, setTopic] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled && onDisabledClick) {
      onDisabledClick();
      return;
    }
    if (topic.trim() && !loading && !disabled) {
      onSearch(topic.trim());
    }
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled && onDisabledClick) {
      e.preventDefault();
      onDisabledClick();
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={disabled ? disabledMessage : "Enter a topic (e.g., Bitcoin price today, Climate change impact...)"}
        disabled={loading || disabled}
        maxLength={200}
        className="search-input"
        title={disabled ? disabledMessage : undefined}
      />
      <button 
        type="submit" 
        disabled={loading || (!disabled && !topic.trim())}
        className={`search-button ${disabled ? 'search-button-auth-required' : ''}`}
        title={disabled ? disabledMessage : (!topic.trim() ? 'Enter a topic' : undefined)}
        onClick={handleButtonClick}
      >
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

