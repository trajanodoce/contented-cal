// ── Brand colors ────────────────────────────────────────────────────────────
// Single source of truth for hardcoded hex values used across the app.
// Use these instead of inline hex strings.

export const BRAND = {
  navy: '#002339',
  blue: '#005D97',
  teal: '#2F8889',
  crimson: '#BA2C2C',
} as const;

export const SURFACE = {
  card: '#F7F9FC',
  page: '#F4F8FB',
} as const;

export const PRIORITY_COLOR = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#fbbf24',
  low: 'transparent',
} as const;
