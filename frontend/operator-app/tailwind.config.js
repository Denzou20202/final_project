const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

// Light palette lifted from the approved design prototype
// (Веб-приложение для поддержки.zip → Тикет-деск.dc.html); the dark palette
// lives next to it in styles.css. Every semantic token resolves through an
// "R G B" CSS variable so the same utility class renders the right color in
// both themes — including Tailwind's /opacity modifiers via <alpha-value>.
const token = (name) => `rgb(var(--tk-${name}) / <alpha-value>)`;

module.exports = {
  darkMode: 'class',
  content: [
    join(__dirname, 'index.html'),
    join(__dirname, 'src/**/*.{js,ts,jsx,tsx}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: token('surface'),
          card: token('surface-card'),
          sidebar: token('surface-sidebar'),
          muted: token('surface-muted'),
        },
        border: {
          DEFAULT: token('border'),
          subtle: token('border-subtle'),
        },
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
          subtle: token('ink-subtle'),
          faint: token('ink-faint'),
        },
        // Solid contrast chip (toasts, avatars, update prompt): dark ink in
        // the light theme, lifted slate in the dark one — always paired
        // with text-white, unlike `ink`, which flips to a light text color
        // in the dark theme and would swallow its own label.
        elevated: token('elevated'),
        brand: {
          50: token('brand-50'),
          100: token('brand-100'),
          600: token('brand-600'),
          700: token('brand-700'),
          // Darken-on-hover for solid brand buttons. Split from 700 because
          // in the dark theme 700 doubles as high-contrast brand TEXT (a
          // bright teal) — unusable as a hover fill under white labels.
          hover: token('brand-hover'),
        },
        status: {
          new: '#0D9488',
          open: '#C2683F',
          pending: '#E6A817',
          resolved: '#5B8A72',
          closed: '#C7BDAF',
        },
        priority: {
          low: '#9A9086',
          medium: '#E6A817',
          high: '#C2683F',
          urgent: '#BC472C',
        },
      },
    },
  },
  plugins: [],
};
