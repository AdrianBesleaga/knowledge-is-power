import { useState, useRef, useEffect } from 'react';
import { updateGraphVisibility, updateTimelineVisibility, setAuthToken } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { KnowledgeGraph } from '../types/graph';
import { TimelineAnalysis } from '../types/timeline';
import { InfographicGenerator } from './InfographicGenerator';
import './ShareButton.css';

interface ShareButtonProps {
  url: string;
  slug?: string;
  graph?: KnowledgeGraph;
  timeline?: TimelineAnalysis;
  onVisibilityChange?: (visibility: 'private' | 'public' | 'premium') => void;
}

export const ShareButton = ({ url, slug, graph, timeline, onVisibilityChange }: ShareButtonProps) => {
  const [copied, setCopied] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showInfographic, setShowInfographic] = useState(false);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const { user, getIdToken } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowVisibilityMenu(false);
      }
    };

    if (showVisibilityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVisibilityMenu]);

  // Check if user owns this content
  const isOwner = user && ((graph?.userId === user.uid) || (timeline?.userId === user.uid));
  const currentVisibility = graph?.visibility || timeline?.visibility || 'private';

  const handleVisibilityChange = async (newVisibility: 'private' | 'public' | 'premium') => {
    if (!slug || !user || !isOwner) return;

    setUpdating(true);
    try {
      const token = await getIdToken();
      if (token) {
        setAuthToken(token);
      }

      if (graph) {
        await updateGraphVisibility(slug, newVisibility);
      } else if (timeline) {
        await updateTimelineVisibility(slug, newVisibility);
      }

      onVisibilityChange?.(newVisibility);
      setShowVisibilityMenu(false);
    } catch (error) {
      console.error('Failed to update visibility:', error);
    } finally {
      setUpdating(false);
    }
  };

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
    <>
      <div className="share-button-group" ref={dropdownRef}>
        <button
          className="share-button"
          onClick={handleShare}
          disabled={updating}
        >
          {updating ? 'Updating...' : copied ? '✓ Copied!' : '🔗 Share'}
        </button>

        {isOwner && (
          <div className="visibility-dropdown">
            <button
              className="share-button visibility-button"
              onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
              disabled={updating}
              title="Change visibility"
            >
              {currentVisibility === 'private' && '🔒 Private'}
              {currentVisibility === 'public' && '🌐 Public'}
              {currentVisibility === 'premium' && '💎 Premium'}
              <span className="dropdown-arrow">{showVisibilityMenu ? '▲' : '▼'}</span>
            </button>

            {showVisibilityMenu && (
              <div className="visibility-menu">
                <button
                  className={`visibility-option ${currentVisibility === 'private' ? 'active' : ''}`}
                  onClick={() => handleVisibilityChange('private')}
                  disabled={updating}
                >
                  🔒 Private - Only you can see
                </button>
                <button
                  className={`visibility-option ${currentVisibility === 'public' ? 'active' : ''}`}
                  onClick={() => handleVisibilityChange('public')}
                  disabled={updating}
                >
                  🌐 Public - Anyone can see
                </button>
                <button
                  className={`visibility-option ${currentVisibility === 'premium' ? 'active' : ''}`}
                  onClick={() => handleVisibilityChange('premium')}
                  disabled={updating}
                >
                  💎 Premium - Public but requires 1 credit to view
                </button>
              </div>
            )}
          </div>
        )}

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

