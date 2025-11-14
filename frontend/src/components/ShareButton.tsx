import { useState } from 'react';
import { updateGraphVisibility, setAuthToken } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { KnowledgeGraph } from '../types/graph';
import { InfographicGenerator } from './InfographicGenerator';
import './ShareButton.css';

interface ShareButtonProps {
  url: string;
  slug?: string;
  graph?: KnowledgeGraph;
  onVisibilityChange?: (isPublic: boolean) => void;
}

export const ShareButton = ({ url, slug, graph, onVisibilityChange }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showInfographic, setShowInfographic] = useState(false);
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
    <>
      <div className="share-button-group">
        <button 
          className="share-button" 
          onClick={handleShare}
          disabled={updating}
        >
          {updating ? 'Updating...' : copied ? '✓ Copied!' : '🔗 Share'}
        </button>
        {graph && (
          <button
            className="share-button infographic-button"
            onClick={() => setShowInfographic(true)}
            title="Generate infographic for social media"
          >
            📊 Infographic
          </button>
        )}
      </div>
      {showInfographic && graph && (
        <InfographicGenerator
          graph={graph}
          onClose={() => setShowInfographic(false)}
        />
      )}
    </>
  );
};

