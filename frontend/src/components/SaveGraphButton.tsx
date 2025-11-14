import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GraphNode, GraphEdge } from '../types/graph';
import './SaveGraphButton.css';

interface SaveGraphButtonProps {
  topic: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSave: () => void;
  onAuthRequired: () => void;
}

export const SaveGraphButton = ({
  topic,
  nodes,
  edges,
  onSave,
  onAuthRequired,
}: SaveGraphButtonProps) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleClick = async () => {
    if (!user) {
      onAuthRequired();
      return;
    }

    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      className="save-graph-button"
      onClick={handleClick}
      disabled={saving || !nodes.length}
    >
      {saving ? 'Saving...' : user ? 'Save Graph' : 'Sign In to Save'}
    </button>
  );
};

