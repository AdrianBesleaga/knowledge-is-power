import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  onClick?: () => void;
}

export const Logo = ({ showText = true, onClick }: LogoProps) => {
  return (
    <motion.div
      className="flex items-center gap-3 cursor-pointer group"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Smart AI Brain icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary-400 to-accent-500 opacity-30 dark:opacity-40 blur-lg group-hover:opacity-50 dark:group-hover:opacity-60 transition-all duration-300" />
        <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 dark:from-primary-400 dark:to-accent-500 flex items-center justify-center shadow-lg dark:shadow-primary-500/25">
          <Brain className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={2.2} />
        </div>
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
            Knowledge is Power
          </span>
          <span className="text-xs font-semibold text-blue-400 dark:text-blue-300 -mt-1 tracking-wide">
            AI Insights
          </span>
        </div>
      )}
    </motion.div>
  );
};
