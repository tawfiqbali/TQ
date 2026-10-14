/** @type {import('tailwindcss').Config} */
// Bahnschrift ships with Windows. Phones and Macs don't have it, so Barlow
// (a close DIN-style match, loaded from Google Fonts) is used there instead.
//
// Bengali: in বাংলা mode src/index.css switches to a stack with the custom
// Aikya font. Elsewhere (e.g. the "বাংলা" label on the English site) Bengali
// letters fall back to Noto Sans Bengali (Android) or Nirmala UI (Windows).
const brandFont = [
  'Bahnschrift',
  '"Barlow"',
  '"Noto Sans Bengali"',
  '"Nirmala UI"',
  '"Segoe UI"',
  'ui-sans-serif',
  'system-ui',
  'sans-serif',
];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Teal family, anchored on the logo's deep green (#002B29)
        pine: {
          50: 'rgb(var(--pine-50) / <alpha-value>)',
          100: 'rgb(var(--pine-100) / <alpha-value>)',
          200: 'rgb(var(--pine-200) / <alpha-value>)',
          300: 'rgb(var(--pine-300) / <alpha-value>)',
          500: 'rgb(var(--pine-500) / <alpha-value>)',
          700: 'rgb(var(--pine-700) / <alpha-value>)',
          800: 'rgb(var(--pine-800) / <alpha-value>)',
          900: 'rgb(var(--pine-900) / <alpha-value>)',
          950: 'rgb(var(--pine-950) / <alpha-value>)',
        },
        // Warm gold, anchored on the logo's accent (#DBA66B)
        gold: {
          50: '#FCF6EE',
          100: '#F7EAD8',
          300: '#E8C597',
          400: '#DBA66B',
          500: '#C89A3C',
          700: '#8A6424',
        },
        sand: '#F3ECE1',
        // Theme tokens: values live in src/index.css and switch in dark mode
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        heading: 'rgb(var(--c-heading) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        tint: 'rgb(var(--c-tint) / <alpha-value>)',
        'tint-gold': 'rgb(var(--c-tint-gold) / <alpha-value>)',
      },
      fontFamily: {
        display: brandFont,
        sans: brandFont,
        arabic: ['Amiri', '"Traditional Arabic"', 'serif'],
      },
      // Reviews marquee: the row holds two identical copies, so moving it by
      // -50% (one copy) and restarting gives a seamless endless loop.
      // Duration comes from the component (--marquee-duration).
      keyframes: {
        marquee: {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(-50%, 0, 0)' },
        },
      },
      animation: {
        marquee: 'marquee var(--marquee-duration, 60s) linear infinite',
      },
      boxShadow: {
        float: '0 1px 2px rgba(0,43,41,.06), 0 8px 20px -6px rgba(0,43,41,.12), 0 24px 48px -20px rgba(0,43,41,.18)',
        'float-lg': '0 2px 4px rgba(0,43,41,.06), 0 16px 32px -8px rgba(0,43,41,.18), 0 40px 72px -24px rgba(0,43,41,.26)',
        soft: 'inset 0 1px 2px rgba(0,43,41,.06), 0 1px 0 rgba(255,255,255,.9)',
      },
    },
  },
  plugins: [],
};
