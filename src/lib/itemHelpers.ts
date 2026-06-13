import type { ContentType, BoardColumn, Profile } from './database.types';
import { parseLocalDate, formatDate } from './utils';
import { isPast, isToday, isTomorrow } from 'date-fns';

// ── Done-status detection ───────────────────────────────────────────────────

/**
 * Whether a board column name represents a "done" state (Published or Completed).
 * Accepts the column name directly (already lowercased or not).
 */
export function isDoneStatus(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n === 'published/done' || n === 'published' || n === 'completed';
}

/**
 * Whether a board column represents a "done" state.
 * Convenience wrapper that takes the full column object.
 */
export function isDoneColumn(column: BoardColumn | null | undefined): boolean {
  return isDoneStatus(column?.name);
}

// ── Lookup helpers ──────────────────────────────────────────────────────────

export function getContentType(
  contentTypeId: string | null,
  contentTypes: ContentType[]
): ContentType | null {
  if (!contentTypeId) return null;
  return contentTypes.find((ct) => ct.id === contentTypeId) || null;
}

export function getBoardColumn(
  statusId: string | null,
  boardColumns: BoardColumn[]
): BoardColumn | null {
  if (!statusId) return null;
  return boardColumns.find((bc) => bc.id === statusId) || null;
}

export function getAssignees(assigneeIds: string[], members: Profile[]): Profile[] {
  return assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Profile => m !== undefined);
}

// ── Date formatting ─────────────────────────────────────────────────────────

export function formatDueDateWithStatus(
  date: string | null
): { text: string; isOverdue: boolean; isSoon: boolean } {
  if (!date) return { text: '-', isOverdue: false, isSoon: false };

  const dueDate = parseLocalDate(date);
  const overdue = isPast(dueDate) && !isToday(dueDate);
  const soon = isToday(dueDate) || isTomorrow(dueDate);

  return {
    text: formatDate(date),
    isOverdue: overdue,
    isSoon: soon,
  };
}

