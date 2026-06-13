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

// Priority colors live in PRIORITY_STYLES (src/lib/utils.ts) — they need
// Tailwind classes alongside hex, so they stay there as the single source.
// Need raw hex? Use PRIORITY_STYLES[level].hex.

// ── Board status spectrum (canonical 2026-06-13) ────────────────────────────
// 8 semantic colors forming a warm→cool workflow arc (Backlog → Done), with
// Blocked as semantic red outside the flow. This is the swatch set the
// Settings → Board Columns picker offers. These colors are hard-wired into
// pills, dots, calendar chips, etc. via `board_columns.color`, so changes here
// ripple app-wide. Use the hex with an alpha suffix for tinting (e.g.
// `${color}06` column bg, `${color}12` header).
// NOTE (white-label): other orgs may need more columns; expand this curated
// set per-org — a free color picker is unsafe given how widely colors are used.
export const BOARD_COLUMN_PALETTE = [
  { name: 'Slate',    hex: '#94A3B8' }, // Backlog — neutral / not started
  { name: 'Apricot',  hex: '#FFB07C' }, // Research/Outline
  { name: 'Orchid',   hex: '#D279D2' }, // Draft
  { name: 'Wisteria', hex: '#6E7BC0' }, // In Review — bluer nudge, off Ordinal's lavender
  { name: 'Mint',     hex: '#92D1B2' }, // Approved
  { name: 'Teal',     hex: '#18767A' }, // Scheduled
  { name: 'Cobalt',   hex: '#0061C2' }, // Published/Done
  { name: 'Crimson',  hex: '#BA2C2C' }, // Blocked (semantic, = accent-crimson)
] as const;
