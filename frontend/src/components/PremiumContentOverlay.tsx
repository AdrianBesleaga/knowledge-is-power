import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { unlockPremiumGraph, unlockPremiumTimeline } from '../services/api';
import './PremiumContentOverlay.css';

interface PremiumContentOverlayProps {
  children: React.ReactNode;
  contentType: 'graph' | 'timeline';
  slug: string;
  topic: string;
  onUnlock?: (content: any) => void;
}

export const PremiumContentOverlay: React.FC<PremiumContentOverlayProps> = ({
  children,
  contentType,
  slug,
  topic,
  onUnlock
}) => {
  const { user, getIdToken } = useAuth();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    if (!user) {
      setError('Please log in to unlock premium content');
      return;
    }

    try {
      setIsUnlocking(true);
      setError(null);

      const token = await getIdToken();
      if (token) {
        // Import the setAuthToken function here to avoid circular imports
        const { setAuthToken } = await import('../services/api');
        setAuthToken(token);
      }

      let unlockedContent;
      if (contentType === 'graph') {
        unlockedContent = await unlockPremiumGraph(slug);
      } else {
        unlockedContent = await unlockPremiumTimeline(slug);
      }

      if (onUnlock) {
        onUnlock(unlockedContent);
      }
    } catch (err: any) {
      console.error('Error unlocking premium content:', err);
      if (err.response?.status === 402) {
        if (err.response?.data?.code === 'INSUFFICIENT_CREDITS') {
          setError('Insufficient credits. Please purchase more credits to unlock this content.');
        } else {
          setError('Premium content requires payment. This costs 1 credit to unlock.');
        }
      } else {
        setError('Failed to unlock premium content. Please try again.');
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="premium-content-container">
      <div className="premium-content-blurred">
        {children}
      </div>
      <div className="premium-overlay">
        <div className="premium-overlay-content">
          <div className="premium-icon">💎</div>
          <h3>Premium Content</h3>
          <p>This {contentType} requires 1 credit to unlock</p>
          <p className="premium-topic">"{topic}"</p>

          {error && (
            <div className="premium-error">
              {error}
            </div>
          )}

          <button
            className="premium-unlock-button"
            onClick={handleUnlock}
            disabled={isUnlocking}
          >
            {isUnlocking ? (
              <>
                <div className="unlock-spinner"></div>
                Unlocking...
              </>
            ) : (
              <>
                <span className="unlock-icon">🔓</span>
                Unlock for 1 Credit
              </>
            )}
          </button>

          <div className="premium-info">
            <p>Once unlocked, you can view this content unlimited times</p>
          </div>
        </div>
      </div>
    </div>
  );
};
