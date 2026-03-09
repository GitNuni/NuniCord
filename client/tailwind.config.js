/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Discord-like dark theme
        'nc-bg-primary': '#313338',
        'nc-bg-secondary': '#2b2d31',
        'nc-bg-tertiary': '#1e1f22',
        'nc-bg-floating': '#111214',
        'nc-bg-input': '#1e1f22',
        'nc-bg-modifier-hover': 'rgba(255,255,255,0.06)',
        'nc-bg-modifier-active': 'rgba(255,255,255,0.08)',
        'nc-bg-modifier-selected': 'rgba(255,255,255,0.10)',
        'nc-text-normal': '#dbdee1',
        'nc-text-muted': '#80848e',
        'nc-text-link': '#00a8fc',
        'nc-interactive-normal': '#b5bac1',
        'nc-interactive-hover': '#dbdee1',
        'nc-interactive-active': '#f2f3f5',
        'nc-interactive-muted': '#41434a',
        'nc-brand': '#5865f2',
        'nc-brand-hover': '#4752c4',
        'nc-brand-560': '#4752c4',
        'nc-green': '#23a55a',
        'nc-yellow': '#f0b232',
        'nc-red': '#f23f43',
        'nc-white': '#ffffff',
        'nc-status-positive': '#23a55a',
        'nc-status-warning': '#f0b232',
        'nc-status-danger': '#f23f43',
        'nc-status-info': '#00a8fc',
        'nc-channel-icon': '#80848e',
        'nc-divider': '#3f4147',
        'nc-header-primary': '#f2f3f5',
        'nc-header-secondary': '#b5bac1',
      },
      fontFamily: {
        sans: [
          'gg sans', 'Noto Sans', 'Whitney', 'Source Sans Pro',
          'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'
        ],
        mono: ['Consolas', 'Andale Mono WT', 'Andale Mono', 'Lucida Console', 'monospace'],
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-in-out',
        'slide-up': 'slideUp 0.15s ease-out',
        'slide-right': 'slideRight 0.2s ease-out',
        'typing': 'typing 1.4s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        slideRight: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        typing: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
    },
  },
  plugins: [],
};
