import { useNavigate } from 'react-router-dom';
import { Moon, Sun, Brain, TrendingUp } from 'lucide-react';
import { UserProfile } from './UserProfile';
import { Logo } from './Logo';
import { useTheme } from '../contexts/ThemeContext';

export const Header = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
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
                       text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
                       transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              <span>Predictions</span>
            </button>

            <button
              onClick={() => navigate('/knowledge-graph')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                       text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
                       transition-colors"
            >
              <Brain className="w-4 h-4" />
              <span>Graphs</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>

            {/* User Profile */}
            <UserProfile />
          </div>
        </div>
      </div>
    </header>
  );
};
