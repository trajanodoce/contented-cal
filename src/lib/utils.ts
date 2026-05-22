import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'MMM d');
}

export function formatDateFull(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
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
