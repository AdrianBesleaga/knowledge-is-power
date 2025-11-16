/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0a0f',
          surface: '#13131a',
          elevated: '#1a1a24',
          border: '#2a2a38',
          hover: '#232330',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #0a0a0f 0%, #13131a 50%, #1a1a24 100%)',
        'gradient-primary': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #075985 100%)',
        'gradient-accent': 'linear-gradient(135deg, #d946ef 0%, #c026d3 50%, #a21caf 100%)',
        'gradient-mixed': 'linear-gradient(135deg, #0ea5e9 0%, #7c3aed 50%, #d946ef 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'spark': 'spark 1.5s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.2), 0 0 40px rgba(217, 70, 239, 0.1)' },
          '100%': { boxShadow: '0 0 30px rgba(14, 165, 233, 0.4), 0 0 60px rgba(217, 70, 239, 0.2)' },
        },
        spark: {
          '0%, 100%': { opacity: 0, transform: 'translateY(0) scale(0)' },
          '50%': { opacity: 1, transform: 'translateY(-30px) scale(1)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(14, 165, 233, 0.3), 0 0 40px rgba(217, 70, 239, 0.2)',
        'glow-lg': '0 0 30px rgba(14, 165, 233, 0.4), 0 0 60px rgba(217, 70, 239, 0.3)',
        'inner-glow': 'inset 0 0 20px rgba(14, 165, 233, 0.2)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
