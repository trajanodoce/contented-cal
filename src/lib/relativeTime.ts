import {
  format,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  isYesterday,
  isThisYear,
} from 'date-fns';

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();

  // Clamp future timestamps (clock skew, server-stamped slightly in future) to "just now"
  const mins = Math.max(0, differenceInMinutes(now, d));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;

  const hours = Math.max(0, differenceInHours(now, d));
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.max(0, differenceInDays(now, d));
  if (days === 1 || isYesterday(d)) {
    return `Yesterday at ${format(d, 'h:mm a')}`;
  }

  if (isThisYear(d)) return format(d, 'MMM d');
  return format(d, 'MMM d, yyyy');
}
