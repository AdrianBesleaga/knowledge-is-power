import { useState } from 'react';
import { updateGraphVisibility, setAuthToken } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import './ShareButton.css';

interface ShareButtonProps {
  url: string;
  slug?: string;
  onVisibilityChange?: (isPublic: boolean) => void;
}

export const ShareButton = ({ url, slug, onVisibilityChange }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { user, getIdToken } = useAuth();

  const handleShare = async () => {
    const fullUrl = `${window.location.origin}${url}`;
    
    try {
      // If slug is provided, make the graph public when sharing
      if (slug && user) {
        setUpdating(true);
        try {
          const token = await getIdToken();
          if (token) {
            setAuthToken(token);
          }
          await updateGraphVisibility(slug, true);
          onVisibilityChange?.(true);
        } catch (error) {
          console.error('Failed to update graph visibility:', error);
          // Continue with copying even if visibility update fails
        } finally {
          setUpdating(false);
        }
      }

      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <button 
      className="share-button" 
      onClick={handleShare}
      disabled={updating}
    >
      {updating ? 'Updating...' : copied ? '✓ Copied!' : '🔗 Share'}
    </button>
  );
};

