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

// ── Board column palette (canonical Draft 5.2) ──────────────────────────────
// Predefined 10-color set. No color picker — auto-assigns left to right on
// column creation; user can swap within the set. Use the hex with an alpha
// suffix for tinting (e.g., `${color}06` for column bg, `${color}12` for header).
export const BOARD_COLUMN_PALETTE = [
  { name: 'Navy',     hex: '#005D97' },
  { name: 'Cerulean', hex: '#2E8BC0' },
  { name: 'Iris',     hex: '#6366F1' },
  { name: 'Amethyst', hex: '#7C3AED' },
  { name: 'Berry',    hex: '#B8447A' },
  { name: 'Coral',    hex: '#C4504A' },
  { name: 'Peach',    hex: '#D98A6B' },
  { name: 'Sage',     hex: '#4D9B6E' },
  { name: 'Teal',     hex: '#0F8B8D' },
  { name: 'Slate',    hex: '#64748B' },
] as const;
