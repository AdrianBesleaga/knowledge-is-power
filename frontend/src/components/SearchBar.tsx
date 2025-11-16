import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (topic: string) => void;
  loading?: boolean;
  initialValue?: string;
  buttonText?: string;
  loadingText?: string;
  disabled?: boolean;
  disabledMessage?: string;
  onDisabledClick?: () => void;
}

export const SearchBar = ({
  onSearch,
  loading = false,
  initialValue = '',
  buttonText = 'Generate Graph',
  loadingText = 'Generating...',
  disabled = false,
  disabledMessage = 'Please sign in to continue',
  onDisabledClick
}: SearchBarProps) => {
  const [topic, setTopic] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled && onDisabledClick) {
      onDisabledClick();
      return;
    }
    if (topic.trim() && !loading && !disabled) {
      onSearch(topic.trim());
    }
  };

  return (
    <motion.form
      className="w-full max-w-4xl mx-auto"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative">
        {/* Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-mixed opacity-20 blur-2xl group-hover:opacity-30 transition-opacity duration-500" />

        <div className="relative flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={disabled ? disabledMessage : "Enter any topic... (e.g., Future of AI, Climate Change, Bitcoin)"}
              disabled={loading || disabled}
              maxLength={200}
              className="w-full pl-12 pr-4 py-4 rounded-2xl font-medium text-base
                       dark:bg-white/5 bg-white dark:text-white text-gray-900
                       border-2 dark:border-white/10 border-gray-200
                       dark:focus:border-primary-500/50 focus:border-primary-500
                       dark:focus:bg-white/10 focus:bg-gray-50
                       placeholder:text-gray-400 dark:placeholder:text-gray-500
                       transition-all duration-300 outline-none
                       disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {/* Sparkle decoration */}
            {topic && !loading && (
              <motion.div
                className="absolute right-4 top-1/2 transform -translate-y-1/2"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
              >
                <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
              </motion.div>
            )}
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading || (!disabled && !topic.trim())}
            className="relative px-8 py-4 rounded-2xl font-bold text-base text-white
                     bg-gradient-mixed hover:shadow-glow-lg
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                     transition-all duration-300 overflow-hidden group whitespace-nowrap"
            whileHover={{ scale: loading || (!disabled && !topic.trim()) ? 1 : 1.05 }}
            whileTap={{ scale: loading || (!disabled && !topic.trim()) ? 1 : 0.95 }}
          >
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-600 via-purple-600 to-accent-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Content */}
            <span className="relative flex items-center gap-2">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{loadingText}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{buttonText}</span>
                </>
              )}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
};
