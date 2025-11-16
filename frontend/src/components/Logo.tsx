import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  onClick?: () => void;
}

export const Logo = ({ size = 40, showText = true, onClick }: LogoProps) => {
  return (
    <motion.div
      className="flex items-center gap-3 cursor-pointer group"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Logo Icon with animated gradient */}
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-xl bg-gradient-mixed opacity-20 blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          {/* Background circle with glow */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="url(#bgGradient)"
            opacity="0.1"
          />

          {/* Central core - brain/knowledge center */}
          <motion.circle
            cx="50"
            cy="50"
            r="14"
            fill="url(#coreGradient)"
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Inner ring of nodes */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            {[0, 90, 180, 270].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = 50 + 25 * Math.cos(rad);
              const y = 50 + 25 * Math.sin(rad);
              return (
                <circle
                  key={`inner-${i}`}
                  cx={x}
                  cy={y}
                  r="6"
                  fill="url(#nodeGradient)"
                  opacity="0.9"
                />
              );
            })}
          </motion.g>

          {/* Outer ring of nodes */}
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          >
            {[45, 135, 225, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = 50 + 35 * Math.cos(rad);
              const y = 50 + 35 * Math.sin(rad);
              return (
                <circle
                  key={`outer-${i}`}
                  cx={x}
                  cy={y}
                  r="5"
                  fill="url(#nodeGradient2)"
                  opacity="0.8"
                />
              );
            })}
          </motion.g>

          {/* Connection lines */}
          <g opacity="0.3" stroke="url(#lineGradient)" strokeWidth="1.5">
            <line x1="50" y1="50" x2="50" y2="25" />
            <line x1="50" y1="50" x2="75" y2="50" />
            <line x1="50" y1="50" x2="50" y2="75" />
            <line x1="50" y1="50" x2="25" y2="50" />
          </g>

          {/* Spark particles */}
          <motion.circle
            cx="50"
            cy="25"
            r="2"
            fill="#ffffff"
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              y: [-5, -15, -25]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 0,
              ease: "easeOut"
            }}
          />
          <motion.circle
            cx="75"
            cy="50"
            r="2"
            fill="#38bdf8"
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: [5, 15, 25]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: 0.5,
              ease: "easeOut"
            }}
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
            <linearGradient id="coreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
            <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
            <linearGradient id="nodeGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#d946ef" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#d946ef" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>

        {/* Sparkle icon overlay */}
        <motion.div
          className="absolute -top-1 -right-1"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Sparkles className="w-4 h-4 text-yellow-400" />
        </motion.div>
      </div>

      {/* Logo Text */}
      {showText && (
        <div className="flex flex-col">
          <motion.span
            className="text-xl font-black gradient-text group-hover:scale-105 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 50%, #d946ef 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            KnowledgeGraph AI
          </motion.span>
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 -mt-1">
            Powered by Intelligence
          </span>
        </div>
      )}
    </motion.div>
  );
};
