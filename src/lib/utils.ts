import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

/**
 * Parse a date string as a LOCAL date.
 * date-fns v4 parseISO treats date-only strings (yyyy-MM-dd) as UTC midnight,
 * which shifts to the previous day in timezones behind UTC (all US timezones).
 * This helper splits the string and constructs a local Date instead.
 * For full ISO timestamps (with T), it falls back to parseISO.
 */
export function parseLocalDate(dateStr: string): Date {
  const datePart = dateStr.split('T')[0];
  // If it's a date-only string, construct local date
  if (datePart === dateStr || dateStr.endsWith('T00:00:00') || dateStr.endsWith('T00:00:00.000')) {
    const [y, m, d] = datePart.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  // Full timestamp — use parseISO
  return parseISO(dateStr);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = parseLocalDate(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

export function formatDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return format(parseLocalDate(dateStr), 'MMM d, yyyy');
}

export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = parseLocalDate(dateStr);
  return isPast(d) && !isToday(d);
}

// ── Centralized priority palette ────────────────────────────────────────────
// Single source of truth — every page imports from here.

// Per the v2 UI/UX update: priority colors now use canonical design system
// hexes instead of stock Tailwind orange/yellow.
//   urgent → delete-red  #BA2C2C
//   high   → coral       #C4504A  (board palette)
//   medium → peach       #D98A6B  (board palette)
//   low    → slate       #64748B  (board palette)
//
// Visual weight scales with severity so urgent reads as actually urgent and
// stacked pills (e.g. the HomePage "By Priority" card) are easy to scan:
//
//   urgent  — strongest fill (bg-22 + border-50 + bold text)
//   high    — medium fill    (bg-15 + border-35)
//   medium  — soft fill      (bg-10 + border-30)
//   low     — ghost          (transparent bg + slate-300 border)
//
// All four colors stay distinct in the warm-to-cool spectrum, but the
// gradient in visual weight keeps the urgency hierarchy legible.
export const PRIORITY_STYLES: Record<string, {
  label: string;
  dot: string;       // small colored dot (bg class)
  text: string;      // text color class
  pill: string;      // text + bg + border for pill badges
  hex: string;       // raw hex for select option dots
}> = {
  urgent: {
    label: 'Urgent',
    dot: 'bg-[#BA2C2C]',
    text: 'text-[#BA2C2C]',
    pill: 'text-[#BA2C2C] bg-[#BA2C2C22] border-[#BA2C2C50] font-bold',
    hex: '#BA2C2C',
  },
  high: {
    label: 'High',
    dot: 'bg-[#C4504A]',
    text: 'text-[#C4504A]',
    pill: 'text-[#C4504A] bg-[#C4504A15] border-[#C4504A35]',
    hex: '#C4504A',
  },
  medium: {
    label: 'Medium',
    dot: 'bg-[#D98A6B]',
    text: 'text-[#D98A6B]',
    pill: 'text-[#D98A6B] bg-[#D98A6B10] border-[#D98A6B30]',
    hex: '#D98A6B',
  },
  low: {
    label: 'Low',
    dot: 'bg-[#64748B]',
    text: 'text-[#64748B]',
    pill: 'text-[#64748B] bg-transparent border-slate-300',
    hex: '#64748B',
  },
};

/**
 * Convert any hex color into a vivid, dark variant for pill text/borders.
 * Extracts the hue, then forces high saturation (65%) and low lightness (32%)
 * so pastels like #B7CEEC become a rich navy instead of a washed-out gray.
 */
export function pillTextColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d + 6) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  const sat = 0.65, lit = 0.32;
  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lit - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (hue < 60) { r1 = c; g1 = x; }
  else if (hue < 120) { r1 = x; g1 = c; }
  else if (hue < 180) { g1 = c; b1 = x; }
  else if (hue < 240) { g1 = x; b1 = c; }
  else if (hue < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

export function getPriorityDot(priority: string): string {
  return PRIORITY_STYLES[priority]?.dot ?? PRIORITY_STYLES.low.dot;
}

/** Default channel list for new workspaces or when none are configured */
export const DEFAULT_CHANNELS = [
  'Blog',
  'Social',
  'Newsletter/Email',
  'Sales Enablement',
  'Promo',
  'Website',
  'Media/External',
  'Other',
];

/** Extract channels from workspace settings JSON, falling back to defaults */
export function getWorkspaceChannels(settings: unknown): string[] {
  if (
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    'channels' in settings &&
    Array.isArray((settings as Record<string, unknown>).channels)
  ) {
    return (settings as Record<string, string[]>).channels;
  }
  return DEFAULT_CHANNELS;
}

/** A reusable subtask checklist template stored on a workspace. */
export interface SubtaskTemplate {
  name: string;
  items: string[];
}

/** Extract subtask templates from workspace settings JSON, returning [] if absent or malformed. */
export function getWorkspaceSubtaskTemplates(settings: unknown): SubtaskTemplate[] {
  if (
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    'subtask_templates' in settings &&
    Array.isArray((settings as Record<string, unknown>).subtask_templates)
  ) {
    const templates = (settings as Record<string, unknown>).subtask_templates as unknown[];
    return templates.filter((t): t is SubtaskTemplate => {
      return (
        typeof t === 'object' &&
        t !== null &&
        'name' in t &&
        'items' in t &&
        typeof (t as SubtaskTemplate).name === 'string' &&
        Array.isArray((t as SubtaskTemplate).items) &&
        (t as SubtaskTemplate).items.every((i) => typeof i === 'string')
      );
    });
  }
  return [];
}
