/**
 * Portable Tailwind color tokens — pairs with tokens.css.
 *
 * Every color resolves to `rgb(var(--token) / <alpha-value>)`, so:
 *   - opacity modifiers work natively:  bg-brand-600/12  text-ink-muted/70
 *   - colors are runtime-swappable (white-label) + theme-flippable (dark mode)
 *
 * SETUP (see README.md):
 *   // tailwind.config.js
 *   import { colors as dsColors } from './design-system/tailwind.tokens.js';
 *   export default {
 *     darkMode: 'class',
 *     theme: { extend: { colors: dsColors } },
 *   };
 *
 * NOTE: this OVERRIDES Tailwind's built-in `slate` palette with the token
 * vars (so existing slate-* classes become theme-swappable). If you'd rather
 * keep Tailwind's stock slate, rename the `slate` key below to e.g. `neutral`.
 */

const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

export const colors = {
  brand: {
    50: v('--color-brand-50'),
    100: v('--color-brand-100'),
    200: v('--color-brand-200'),
    300: v('--color-brand-300'),
    400: v('--color-brand-400'),
    500: v('--color-brand-500'),
    600: v('--color-brand-600'),
    700: v('--color-brand-700'),
    800: v('--color-brand-800'),
    900: v('--color-brand-900'),
    950: v('--color-brand-950'),
  },
  surface: {
    DEFAULT: v('--color-surface-card'),
    page: v('--color-surface-page'),
    card: v('--color-surface-card'),
    nested: v('--color-surface-nested'),
  },
  accent: {
    pink: v('--color-accent-pink'),
    coral: v('--color-accent-coral'),
    lavender: v('--color-accent-lavender'),
    mint: v('--color-accent-mint'),
    crimson: v('--color-accent-crimson'),
    teal: v('--color-accent-teal'),
    berry: v('--color-accent-berry'),
  },
  // Overrides Tailwind's default slate scale (see NOTE above).
  slate: {
    50: v('--color-slate-50'),
    100: v('--color-slate-100'),
    200: v('--color-slate-200'),
    300: v('--color-slate-300'),
    400: v('--color-slate-400'),
    500: v('--color-slate-500'),
    600: v('--color-slate-600'),
    700: v('--color-slate-700'),
    800: v('--color-slate-800'),
    900: v('--color-slate-900'),
    950: v('--color-slate-950'),
  },
  // Semantic text roles → text-ink, text-ink-muted, text-ink-subtle, …
  ink: {
    DEFAULT: v('--color-text-primary'),
    secondary: v('--color-text-secondary'),
    muted: v('--color-text-muted'),
    subtle: v('--color-text-subtle'),
    inverse: v('--color-text-inverse'),
  },
  // Semantic borders → border-line, border-line-subtle, border-line-strong
  line: {
    DEFAULT: v('--color-border-default'),
    subtle: v('--color-border-subtle'),
    strong: v('--color-border-strong'),
  },
  state: {
    success: v('--color-state-success'),
    'success-tint': v('--color-state-success-tint'),
    error: v('--color-state-error'),
    warning: v('--color-state-warning'),
    'warning-tint': v('--color-state-warning-tint'),
    info: v('--color-state-info'),
  },
};

export default colors;
