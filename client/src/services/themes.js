// Server themes — applied as CSS filter + accent color overrides on the channel area
export const THEMES = {
  ctos: {
    label: 'CTOS Blue',
    description: 'Default Watch Dogs cyberpunk',
    filter: '',
    preview: '#00d4ff',
  },
  matrix: {
    label: 'Matrix',
    description: 'Green terminal hacker',
    filter: 'hue-rotate(300deg) saturate(1.3)',
    preview: '#00ff41',
  },
  crimson: {
    label: 'Crimson',
    description: 'Red alert override',
    filter: 'hue-rotate(175deg) saturate(1.4)',
    preview: '#ff2244',
  },
  amber: {
    label: 'Amber',
    description: 'Retro orange terminal',
    filter: 'hue-rotate(210deg) saturate(1.3) brightness(0.95)',
    preview: '#ff8c00',
  },
  ghost: {
    label: 'Ghost Protocol',
    description: 'Purple stealth mode',
    filter: 'hue-rotate(85deg) saturate(1.2)',
    preview: '#c084fc',
  },
  arctic: {
    label: 'Arctic',
    description: 'Ice cold blue-white',
    filter: 'hue-rotate(15deg) brightness(1.1) saturate(0.8)',
    preview: '#89d4f5',
  },
};

export function getThemeFilter(themeId) {
  return THEMES[themeId]?.filter || '';
}
