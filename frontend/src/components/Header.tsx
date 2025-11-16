import { useNavigate } from 'react-router-dom';
import { UserProfile } from './UserProfile';
import { Logo } from './Logo';
import './Header.css';

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <Logo
            size={40}
            showText={true}
            onClick={() => navigate('/')}
          />
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate('/predictions')}
          >
            AI Predictions
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate('/knowledge-graph')}
          >
            Knowledge Graphs
          </button>
          <UserProfile />
        </div>
      </div>
    </header>
  );
};

