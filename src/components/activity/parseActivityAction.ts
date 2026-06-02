import type { ActivityType } from './ActivityLogRow';

export type ActionPart =
  | { kind: 'text'; value: string }
  | { kind: 'quote'; value: string; italic?: boolean }
  | { kind: 'pill'; label: string; color?: string }
  | { kind: 'bold'; value: string };

export interface ParsedAction {
  type: ActivityType;
  parts: ActionPart[];
}

function classify(action: string): ActivityType {
  const a = action.toLowerCase();
  if (a.includes('moved to project') || a.includes('reordered')) return 'move';
  if (a.includes('status') || a.startsWith('moved to') || a.includes(' moved to ')) return 'status';
  if (a.includes('assigned') || a.includes('unassigned')) return 'assignment';
  if (a.includes('comment')) return 'comment';
  if (a.includes('subtask')) return 'subtask';
  if (a.includes('delete') || a.includes('removed') || a.includes('archived') || a.includes('rejected')) return 'delete';
  if (a.includes('created') || a.includes('approved')) return 'create';
  return 'move';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseActivityAction(action: string, metadata?: unknown): ParsedAction {
  const type = classify(action);
  const raw = action.trim();
  const meta = isPlainObject(metadata) ? metadata : undefined;

  // "changed status from X to Y"
  let m = raw.match(/^changed status from (.+?) to (.+)$/i);
  if (m) {
    return {
      type: 'status',
      parts: [
        { kind: 'text', value: 'changed status from ' },
        { kind: 'pill', label: m[1] },
        { kind: 'text', value: ' to ' },
        { kind: 'pill', label: m[2] },
      ],
    };
  }

  // "changed status to X"
  m = raw.match(/^changed status to (.+)$/i);
  if (m) {
    return {
      type: 'status',
      parts: [
        { kind: 'text', value: 'changed status to ' },
        { kind: 'pill', label: m[1] },
      ],
    };
  }

  // "moved to X" (status move from board)
  m = raw.match(/^moved to (.+)$/i);
  if (m && !/project/i.test(m[1])) {
    return {
      type: 'status',
      parts: [
        { kind: 'text', value: 'moved to ' },
        { kind: 'pill', label: m[1] },
      ],
    };
  }

  // "changed priority to X"
  m = raw.match(/^changed priority to (.+)$/i);
  if (m) {
    return {
      type: 'move',
      parts: [
        { kind: 'text', value: 'changed priority to ' },
        { kind: 'pill', label: m[1] },
      ],
    };
  }

  // "assigned to X" / "assigned X"
  m = raw.match(/^assigned(?: to)? (.+)$/i);
  if (m) {
    return {
      type: 'assignment',
      parts: [
        { kind: 'text', value: 'assigned ' },
        { kind: 'bold', value: m[1] },
      ],
    };
  }

  // "unassigned X"
  m = raw.match(/^unassigned (.+)$/i);
  if (m) {
    return {
      type: 'assignment',
      parts: [
        { kind: 'text', value: 'unassigned ' },
        { kind: 'bold', value: m[1] },
      ],
    };
  }

  // "commented: X"
  m = raw.match(/^commented:?\s*(.+)$/i);
  if (m && raw.toLowerCase().startsWith('commented')) {
    return {
      type: 'comment',
      parts: [
        { kind: 'text', value: 'commented: ' },
        { kind: 'quote', value: m[1], italic: true },
      ],
    };
  }

  // "added subtask: X" or "added subtask X"
  m = raw.match(/^added subtask:?\s*(.+)$/i);
  if (m) {
    return {
      type: 'subtask',
      parts: [
        { kind: 'text', value: 'added subtask ' },
        { kind: 'quote', value: m[1].replace(/^"|"$/g, '') },
      ],
    };
  }

  // "completed subtask: X" / "completed subtask X" / "completed subtask "X""
  m = raw.match(/^completed subtask:?\s*(.+)$/i);
  if (m) {
    return {
      type: 'subtask',
      parts: [
        { kind: 'text', value: 'completed subtask ' },
        { kind: 'quote', value: m[1].replace(/^"|"$/g, '') },
      ],
    };
  }

  // "deleted subtask X"
  m = raw.match(/^deleted subtask:?\s*(.+)$/i);
  if (m) {
    return {
      type: 'subtask',
      parts: [
        { kind: 'text', value: 'deleted subtask ' },
        { kind: 'quote', value: m[1].replace(/^"|"$/g, '') },
      ],
    };
  }

  // "added link X"
  m = raw.match(/^added link:?\s*(.+)$/i);
  if (m) {
    return {
      type: 'move',
      parts: [
        { kind: 'text', value: 'added link ' },
        { kind: 'quote', value: m[1] },
      ],
    };
  }

  // "set due date to X" / "changed due date to X"
  m = raw.match(/^(set|changed) due date to (.+)$/i);
  if (m) {
    if (m[2].toLowerCase() === 'none') {
      return {
        type: 'move',
        parts: [{ kind: 'text', value: 'cleared due date' }],
      };
    }
    return {
      type: 'move',
      parts: [
        { kind: 'text', value: `${m[1].toLowerCase()} due date to ` },
        { kind: 'quote', value: m[2] },
      ],
    };
  }

  // "cleared due date"
  if (/^cleared due date$/i.test(raw)) {
    return { type: 'move', parts: [{ kind: 'text', value: 'cleared due date' }] };
  }

  // "rescheduled to X"
  m = raw.match(/^rescheduled to (.+)$/i);
  if (m) {
    return {
      type: 'move',
      parts: [
        { kind: 'text', value: 'rescheduled to ' },
        { kind: 'quote', value: m[1] },
      ],
    };
  }

  // "Updated <field>" with metadata { field, value }
  m = raw.match(/^updated (.+)$/i);
  if (m && meta && typeof meta.field === 'string') {
    const value = meta.value;
    if (value !== undefined && value !== null && value !== '') {
      return {
        type: 'move',
        parts: [
          { kind: 'text', value: `changed ${meta.field} to ` },
          { kind: 'quote', value: String(value) },
        ],
      };
    }
    return {
      type: 'move',
      parts: [{ kind: 'text', value: `updated ${m[1]}` }],
    };
  }

  // "created" / "created this item"
  if (/^created(\s+this\s+item)?$/i.test(raw)) {
    return { type: 'create', parts: [{ kind: 'text', value: 'created this item' }] };
  }

  // "approved from triage queue" variants
  if (/^approved from triage/i.test(raw)) {
    return { type: 'create', parts: [{ kind: 'text', value: raw }] };
  }

  // "rejected from triage: X"
  m = raw.match(/^rejected from triage:?\s*(.+)$/i);
  if (m) {
    return {
      type: 'delete',
      parts: [
        { kind: 'text', value: 'rejected from triage: ' },
        { kind: 'quote', value: m[1] },
      ],
    };
  }

  // "deleted X"
  m = raw.match(/^deleted (.+)$/i);
  if (m) {
    return {
      type: 'delete',
      parts: [
        { kind: 'text', value: 'deleted ' },
        { kind: 'quote', value: m[1] },
      ],
    };
  }

  if (/^archived$/i.test(raw)) {
    return { type: 'delete', parts: [{ kind: 'text', value: 'archived' }] };
  }

  // Catch-all
  return { type, parts: [{ kind: 'text', value: raw }] };
}
