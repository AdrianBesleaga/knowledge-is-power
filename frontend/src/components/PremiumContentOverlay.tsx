import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { unlockPremiumGraph, unlockPremiumTimeline, getUserCredits } from '../services/api';
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
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Load user credits when component mounts
  useEffect(() => {
    const loadCredits = async () => {
      if (user) {
        try {
          const token = await getIdToken();
          if (token) {
            const { setAuthToken } = await import('../services/api');
            setAuthToken(token);
            const credits = await getUserCredits();
            setUserCredits(credits);
          }
        } catch (err) {
          console.error('Failed to load user credits:', err);
        }
      }
    };

    loadCredits();
  }, [user, getIdToken]);

  const handleUnlock = async () => {
    if (!user) {
      setError('Please log in to unlock premium content');
      return;
    }

    if (userCredits !== null && userCredits < 1) {
      setError('Insufficient credits. Please purchase more credits to unlock this content.');
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
        // Refresh credits after successful unlock
        const updatedCredits = await getUserCredits();
        setUserCredits(updatedCredits);
      }
    } catch (err: any) {
      console.error('Error unlocking premium content:', err);
      if (err.response?.status === 402) {
        if (err.response?.data?.code === 'INSUFFICIENT_CREDITS') {
          setError('Insufficient credits. Please purchase more credits to unlock this content.');
          // Refresh credits in case they changed
          try {
            const updatedCredits = await getUserCredits();
            setUserCredits(updatedCredits);
          } catch (creditErr) {
            console.error('Failed to refresh credits:', creditErr);
          }
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
            disabled={isUnlocking || (userCredits !== null && userCredits < 1)}
          >
            {isUnlocking ? (
              <>
                <div className="unlock-spinner"></div>
                Unlocking...
              </>
            ) : (
              <>
                <span className="unlock-icon">🔓</span>
                Unlock for 1 Credit ({userCredits !== null ? userCredits : '...'} available)
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
