import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2 } from 'lucide-react';

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
  buttonText = 'Analyze',
  loadingText = 'Analyzing...',
  disabled = false,
  disabledMessage = 'Sign in to continue',
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
      className="w-full max-w-3xl mx-auto"
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={disabled ? disabledMessage : "Enter a topic to analyze..."}
            disabled={loading || disabled}
            maxLength={200}
            className="w-full pl-12 pr-4 py-3.5 rounded-lg font-medium text-base
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     border-2 border-gray-200 dark:border-gray-700
                     focus:border-primary-500 dark:focus:border-primary-500
                     focus:ring-2 focus:ring-primary-500/20
                     placeholder:text-gray-400 dark:placeholder:text-gray-500
                     transition-all outline-none
                     disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={loading || (!disabled && !topic.trim())}
          className="px-8 py-3.5 rounded-lg font-semibold text-base text-white
                   bg-gradient-to-r from-primary-600 to-primary-500
                   hover:from-primary-500 hover:to-primary-600
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all shadow-lg shadow-primary-500/25
                   hover:shadow-xl hover:shadow-primary-500/30
                   whitespace-nowrap"
          whileHover={{ scale: loading || (!disabled && !topic.trim()) ? 1 : 1.02 }}
          whileTap={{ scale: loading || (!disabled && !topic.trim()) ? 1 : 0.98 }}
        >
          <span className="flex items-center gap-2">
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            <span>{loading ? loadingText : buttonText}</span>
          </span>
        </motion.button>
      </div>
    </motion.form>
  );
};
