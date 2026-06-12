/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Colors reference CSS variables (src/styles/tokens.css) in RGB-channel
      // format so opacity modifiers (e.g. bg-brand-600/12) work natively and
      // the values are runtime-swappable for white-labeling / dark mode.
      // Channel values reproduce the prior hex palette exactly.
      colors: {
        brand: {
          50: 'rgb(var(--color-brand-50) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900) / <alpha-value>)',
          950: 'rgb(var(--color-brand-950) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface-card) / <alpha-value>)',
          page: 'rgb(var(--color-surface-page) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
          nested: 'rgb(var(--color-surface-nested) / <alpha-value>)',
        },
        accent: {
          pink: 'rgb(var(--color-accent-pink) / <alpha-value>)',
          coral: 'rgb(var(--color-accent-coral) / <alpha-value>)',
          lavender: 'rgb(var(--color-accent-lavender) / <alpha-value>)',
          mint: 'rgb(var(--color-accent-mint) / <alpha-value>)',
          crimson: 'rgb(var(--color-accent-crimson) / <alpha-value>)',
          teal: 'rgb(var(--color-accent-teal) / <alpha-value>)',
          berry: 'rgb(var(--color-accent-berry) / <alpha-value>)',
        },
        navy: {
          DEFAULT: 'rgb(var(--color-brand-900) / <alpha-value>)',
          border: '#00233930',
        },
        // Override Tailwind's default `slate` scale with vars so every
        // existing slate-* class is var-driven (dark-mode swappable) with no
        // call-site changes. Values match Tailwind's slate exactly.
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950) / <alpha-value>)',
        },
        // Semantic text roles (preferred for new code + portable to other
        // apps). Usage: text-ink, text-ink-muted, etc.
        ink: {
          DEFAULT: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          subtle: 'rgb(var(--color-text-subtle) / <alpha-value>)',
          inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)',
        },
        // Semantic state colors.
        state: {
          success: 'rgb(var(--color-state-success) / <alpha-value>)',
          'success-tint': 'rgb(var(--color-state-success-tint) / <alpha-value>)',
          error: 'rgb(var(--color-state-error) / <alpha-value>)',
          warning: 'rgb(var(--color-state-warning) / <alpha-value>)',
          'warning-tint': 'rgb(var(--color-state-warning-tint) / <alpha-value>)',
          info: 'rgb(var(--color-state-info) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Faune-Display_Black', 'Faune', 'serif'],
        heading: ['Faune-Text_Bold', 'Faune', 'serif'],
        body: ['Violet Sans', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        // Navy-tinted shadow scale — see § Shadow Tokens in ContentedCal-Design-System.html
        'xs': '0 1px 2px rgba(0,35,57,.09)',
        'sm': '0 2px 4px rgba(0,35,57,.09), 0 4px 8px rgba(0,35,57,.11)',
        DEFAULT: '0 2px 4px rgba(0,35,57,.09), 0 4px 8px rgba(0,35,57,.11)',
        'md': '0 4px 6px rgba(0,35,57,.11), 0 10px 16px rgba(0,35,57,.16)',
        'lg': '0 20px 40px -8px rgba(0,35,57,.22)',
        'xl': '0 30px 56px -10px rgba(0,35,57,.30)',
        'none': 'none',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
};
