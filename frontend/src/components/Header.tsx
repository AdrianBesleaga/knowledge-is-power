import { useNavigate } from 'react-router-dom';
import { Brain, TrendingUp } from 'lucide-react';
import { UserProfile } from './UserProfile';
import { Logo } from './Logo';
import './Header.css';

export const Header = () => {
  const navigate = useNavigate();

  return (
    <header className="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Logo
            size={32}
            showText={true}
            onClick={() => navigate('/')}
          />

          {/* Navigation & Actions */}
          <div className="flex items-center gap-3">
            {/* Navigation Buttons */}
            <button
              onClick={() => navigate('/predictions')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                       text-gray-700 dark:!text-gray-100 cursor-pointer"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Predictions</span>
            </button>

            <button
              onClick={() => navigate('/knowledge-graph')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                       text-gray-700 dark:!text-gray-100 cursor-pointer"
            >
              <Brain className="w-4 h-4" />
              <span>Graphs</span>
            </button>

            {/* User Profile */}
            <UserProfile />
          </div>
        </div>
      </div>
    </header>
  );
};
