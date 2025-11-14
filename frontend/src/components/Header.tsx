import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from './UserProfile';
import './Header.css';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <header className="app-header">
      <div className="header-content">
        {!isHomePage && (
          <button className="back-button" onClick={() => navigate('/')}>
            ← Back
          </button>
        )}
        <h1 className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          Knowledge is Power
        </h1>
        <div className="header-actions">
          {isHomePage && (
            <button
              className="btn-secondary"
              onClick={() => navigate('/search')}
            >
              Search
            </button>
          )}
          <UserProfile />
        </div>
      </div>
    </header>
  );
};

