import { useState } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  onSearch: (topic: string) => void;
  loading?: boolean;
  initialValue?: string;
}

export const SearchBar = ({ onSearch, loading = false, initialValue = '' }: SearchBarProps) => {
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
        {loading ? 'Generating...' : 'Generate Graph'}
      </button>
    </form>
  );
};

