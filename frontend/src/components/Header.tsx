import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Moon, Sun, Brain, TrendingUp } from 'lucide-react';
import { UserProfile } from './UserProfile';
import { Logo } from './Logo';
import { useTheme } from '../contexts/ThemeContext';

export const Header = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      className="sticky top-0 z-50 glass dark:glass border-b border-white/10 dark:border-white/10 backdrop-blur-2xl"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Logo
            size={40}
            showText={true}
            onClick={() => navigate('/')}
          />

          {/* Navigation & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Navigation Buttons */}
            <motion.button
              onClick={() => navigate('/predictions')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
                       dark:text-gray-300 text-gray-700 dark:hover:bg-white/10 hover:bg-gray-100
                       transition-all duration-300 group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <TrendingUp className="w-4 h-4 group-hover:text-primary-400 transition-colors" />
              <span>AI Predictions</span>
            </motion.button>

            <motion.button
              onClick={() => navigate('/knowledge-graph')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm
                       dark:text-gray-300 text-gray-700 dark:hover:bg-white/10 hover:bg-gray-100
                       transition-all duration-300 group"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Brain className="w-4 h-4 group-hover:text-accent-400 transition-colors" />
              <span>Knowledge Graphs</span>
            </motion.button>

            {/* Theme Toggle */}
            <motion.button
              onClick={toggleTheme}
              className="relative p-2 rounded-xl dark:bg-white/5 bg-gray-100 border border-white/10
                       dark:hover:bg-white/10 hover:bg-gray-200 transition-all duration-300 group"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Toggle theme"
            >
              <motion.div
                initial={false}
                animate={{
                  rotate: theme === 'dark' ? 0 : 180,
                  scale: theme === 'dark' ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Moon className="w-5 h-5 text-primary-400" />
              </motion.div>
              <motion.div
                initial={false}
                animate={{
                  rotate: theme === 'light' ? 0 : 180,
                  scale: theme === 'light' ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-center"
              >
                <Sun className="w-5 h-5 text-yellow-500" />
              </motion.div>
            </motion.button>

            {/* User Profile */}
            <UserProfile />
          </div>
        </div>
      </div>
    </motion.header>
  );
};
