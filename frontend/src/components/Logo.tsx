import { motion } from 'framer-motion';
import { Network } from 'lucide-react';

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
      {/* Modern minimalist icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 opacity-20 blur-xl group-hover:opacity-30 transition-opacity" />
        <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
          <Network className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <span className="text-lg font-bold dark:text-white text-gray-900 tracking-tight">
            Knowledge is Power
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 -mt-1">
            AI Powered Analysis
          </span>
        </div>
      )}
    </motion.div>
  );
};
