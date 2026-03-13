/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Solid backgrounds — use CSS vars, no opacity modifier needed
        'nc-bg-primary':    'var(--nc-bg-primary)',
        'nc-bg-secondary':  'var(--nc-bg-secondary)',
        'nc-bg-tertiary':   'var(--nc-bg-tertiary)',
        'nc-bg-input':      'var(--nc-bg-input)',

        // Colors that need /XX opacity modifier support — use rgb channel vars
        'nc-bg-floating':           'rgb(var(--nc-bg-floating-rgb) / <alpha-value>)',
        'nc-bg-modifier-hover':     'rgb(var(--nc-bg-modifier-hover-rgb) / <alpha-value>)',
        'nc-bg-modifier-active':    'rgb(var(--nc-bg-modifier-active-rgb) / <alpha-value>)',
        'nc-bg-modifier-selected':  'rgb(var(--nc-bg-modifier-selected-rgb) / <alpha-value>)',

        // Text
        'nc-text-normal':    'var(--nc-text-normal)',
        'nc-text-muted':     'var(--nc-text-muted)',
        'nc-text-link':      'var(--nc-text-link)',

        // Interactive
        'nc-interactive-normal':  'var(--nc-interactive-normal)',
        'nc-interactive-hover':   'var(--nc-interactive-hover)',
        'nc-interactive-active':  'var(--nc-interactive-active)',
        'nc-interactive-muted':   'var(--nc-interactive-muted)',

        // Brand — needs opacity modifier support
        'nc-brand':       'rgb(var(--nc-brand-rgb) / <alpha-value>)',
        'nc-brand-hover': 'var(--nc-brand-hover)',
        'nc-brand-560':   'var(--nc-brand-560)',

        // Status colors — need opacity modifier support
        'nc-green':  'rgb(var(--nc-green-rgb) / <alpha-value>)',
        'nc-yellow': 'var(--nc-yellow)',
        'nc-red':    'rgb(var(--nc-red-rgb) / <alpha-value>)',
        'nc-white':  'var(--nc-white)',

        'nc-status-positive': 'var(--nc-status-positive)',
        'nc-status-warning':  'var(--nc-status-warning)',
        'nc-status-danger':   'var(--nc-status-danger)',
        'nc-status-info':     'var(--nc-status-info)',

        // UI
        'nc-channel-icon':   'var(--nc-channel-icon)',
        'nc-divider':        'rgb(var(--nc-divider-rgb) / <alpha-value>)',
        'nc-header-primary': 'var(--nc-header-primary)',
        'nc-header-secondary': 'var(--nc-header-secondary)',

        // Legacy CTOS specific
        'ctos-cyan':  '#00d4ff',
        'ctos-green': '#00ff88',
        'ctos-orange':'#ff6b00',
        'ctos-dark':  '#020508',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Helvetica Neue"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"Courier New"', 'monospace'],
      },
      fontSize: {
        'xxs': '0.625rem',
      },
      boxShadow: {
        'ctos':       '0 0 8px rgba(0,212,255,0.3), 0 0 2px rgba(0,212,255,0.6)',
        'ctos-lg':    '0 0 20px rgba(0,212,255,0.25), 0 0 4px rgba(0,212,255,0.5)',
        'ctos-green': '0 0 8px rgba(0,255,136,0.3)',
        'ctos-red':   '0 0 8px rgba(255,60,0,0.4)',
      },
      animation: {
        'fade-in':     'fadeIn 0.15s ease-in-out',
        'slide-up':    'slideUp 0.15s ease-out',
        'slide-right': 'slideRight 0.2s ease-out',
        'typing':      'typing 1.4s infinite',
        'pulse-cyan':  'pulseCyan 2s ease-in-out infinite',
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'glitch':      'glitch 5s ease-in-out infinite',
        'flicker':     'flicker 8s linear infinite',
        'boot':        'boot 0.5s ease-out',
        'scanline':    'scanline 6s linear infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: 0 },           '100%': { opacity: 1 } },
        boot:      { '0%': { opacity: 0, transform: 'scaleY(0.02)' }, '60%': { opacity: 1, transform: 'scaleY(1.02)' }, '100%': { transform: 'scaleY(1)' } },
        slideUp:   { '0%': { transform: 'translateY(8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        slideRight:{ '0%': { transform: 'translateX(-100%)' },           '100%': { transform: 'translateX(0)' } },
        typing:    { '0%,100%': { transform: 'translateY(0)' },          '50%': { transform: 'translateY(-4px)' } },
        pulseCyan: {
          '0%,100%': { boxShadow: '0 0 4px rgba(0,212,255,0.4)' },
          '50%':     { boxShadow: '0 0 14px rgba(0,212,255,0.9), 0 0 28px rgba(0,212,255,0.3)' },
        },
        pulseGreen: {
          '0%,100%': { boxShadow: '0 0 4px rgba(0,255,136,0.4)' },
          '50%':     { boxShadow: '0 0 12px rgba(0,255,136,0.9)' },
        },
        glitch: {
          '0%,92%,100%': { transform: 'translate(0)',        filter: 'none' },
          '93%':          { transform: 'translate(-3px,0)',  filter: 'hue-rotate(90deg) brightness(1.3)' },
          '94%':          { transform: 'translate(3px,0)',   filter: 'hue-rotate(-90deg)' },
          '95%':          { transform: 'translate(-1px,0)',  filter: 'none' },
          '96%':          { transform: 'translate(0)' },
          '97%':          { transform: 'translate(2px,0)',   filter: 'brightness(1.6)' },
          '98%':          { transform: 'translate(0)' },
        },
        flicker: {
          '0%,18%,22%,25%,53%,57%,100%': { opacity: 1 },
          '20%,24%,55%':                  { opacity: 0.7 },
        },
        scanline: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(200vh)' },
        },
      },
    },
  },
  plugins: [],
};
