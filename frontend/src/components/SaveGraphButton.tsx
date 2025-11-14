import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';
import { GraphNode, GraphEdge } from '../types/graph';
import './SaveGraphButton.css';

interface SaveGraphButtonProps {
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSave: () => void;
  onAuthRequired?: () => void;
}

export const SaveGraphButton = ({
  topic: _topic,
  nodes,
  edges: _edges,
  onSave,
  onAuthRequired,
}: SaveGraphButtonProps) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  // Auto-save after successful authentication
  useEffect(() => {
    if (user && pendingSave && !showAuthModal) {
      setPendingSave(false);
      handleSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingSave, showAuthModal]);

  const handleClick = async () => {
    if (!user) {
      setPendingSave(true);
      setShowAuthModal(true);
      onAuthRequired?.();
      return;
    }

    await handleSave();
  };

  return (
    <>
      <button
        className="save-graph-button"
        onClick={handleClick}
        disabled={saving || !nodes.length}
      >
        {saving ? 'Saving...' : user ? 'Save Graph' : 'Sign In to Save'}
      </button>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingSave(false);
        }}
        onSuccess={() => {
          setShowAuthModal(false);
        }}
      />
    </>
  );
};

