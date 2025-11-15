import { useNavigate, useLocation } from 'react-router-dom';
import { UserProfile } from './UserProfile';
import { Logo } from './Logo';
import './Header.css';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <Logo 
            size={40} 
            showText={true} 
            onClick={() => navigate('/')} 
          />
          {!isHomePage && (
            <button className="back-button" onClick={() => navigate('/')}>
              ← Back
            </button>
          )}
        </div>
        <div className="header-actions">
          {isHomePage && (
            <>
              <button
                className="btn-secondary"
                onClick={() => navigate('/timeline')}
              >
                Timeline
              </button>
              <button
                className="btn-secondary"
                onClick={() => navigate('/search')}
              >
                Search
              </button>
            </>
          )}
          <UserProfile />
        </div>
      </div>
    </header>
  );
};

