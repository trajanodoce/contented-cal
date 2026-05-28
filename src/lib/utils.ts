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

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-gray-500 bg-gray-50 border-gray-200';
    default: return 'text-gray-500 bg-gray-50 border-gray-200';
  }
}

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
  switch (priority) {
    case 'urgent': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
}

export function getUserInitials(email?: string, fullName?: string): string {
  if (fullName) return fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
