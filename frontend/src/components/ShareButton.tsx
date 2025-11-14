import { useState } from 'react';
import './ShareButton.css';

interface ShareButtonProps {
  url: string;
}

export const ShareButton = ({ url }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const fullUrl = `${window.location.origin}${url}`;
    
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <button className="share-button" onClick={handleShare}>
      {copied ? '✓ Copied!' : '🔗 Share'}
    </button>
  );
};

