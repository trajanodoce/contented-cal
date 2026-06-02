/**
 * Phase 6.3 — @mention syntax utilities.
 *
 * Storage format: `@[Display Name](uuid)` is embedded inline in `comments.body`.
 * The `comments.mentions[]` column is the derived list of distinct uuids
 * referenced by tags in the body — kept in sync at save time so the alert
 * trigger doesn't have to parse text.
 *
 * Why inline-tag-with-uuid (vs. plain `@Name`):
 *   - Unambiguous: each mention carries the uuid, so renaming a profile or
 *     having two "Taylors" never breaks the link.
 *   - Round-trips cleanly: the body is the source of truth; mentions[] is a
 *     fast-lookup mirror for the SQL trigger.
 *   - No DB-side parsing needed.
 *
 * Lean v1 (per the Phase 6 bloat-review trim):
 *   - Always renders as `@First Last` (no workspace-aware `@First L.` logic)
 *   - Mention anyone in the workspace (no project-scope add-modal)
 */

import { createElement, type ReactNode } from 'react';

/** Matches an inline mention tag: `@[Display Name](uuid)`. */
export const MENTION_TAG_REGEX = /@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g;

export interface ParsedMention {
  uuid: string;
  name: string;
  /** Start index in the original string. */
  start: number;
  /** End index (exclusive) in the original string. */
  end: number;
}

/**
 * Extract all @mentions from a body string with their positions.
 * Preserves order; duplicates remain duplicated (caller can dedup if needed).
 */
export function parseMentions(body: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  // reset lastIndex on the shared regex by working on a fresh copy
  const re = new RegExp(MENTION_TAG_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push({
      name: m[1],
      uuid: m[2],
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return out;
}

/**
 * Distinct uuid[] referenced by inline mention tags in the body.
 * This is what gets persisted to `comments.mentions[]` on save.
 */
export function extractMentionIds(body: string): string[] {
  const seen = new Set<string>();
  for (const m of parseMentions(body)) {
    seen.add(m.uuid);
  }
  return Array.from(seen);
}

/**
 * Render a body string into React nodes, replacing inline mention tags with
 * chip elements. Plain text outside mentions stays as-is.
 *
 * The chip renderer is passed in so callers can hand back styled components
 * without this utility taking a JSX dependency on Tailwind classes etc.
 */
export function renderBodyWithMentions(
  body: string,
  renderChip: (mention: ParsedMention) => ReactNode,
): ReactNode[] {
  if (!body) return [];
  const nodes: ReactNode[] = [];
  let cursor = 0;
  const re = new RegExp(MENTION_TAG_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > cursor) {
      nodes.push(
        createElement('span', { key: `txt-${cursor}` }, body.slice(cursor, m.index)),
      );
    }
    const mention: ParsedMention = {
      name: m[1],
      uuid: m[2],
      start: m.index,
      end: m.index + m[0].length,
    };
    // Wrap the caller's chip in a keyed Fragment so React arrays stay happy.
    nodes.push(
      createElement(
        'span',
        { key: `chip-${m.index}-${m[2]}` },
        renderChip(mention),
      ),
    );
    cursor = m.index + m[0].length;
  }
  if (cursor < body.length) {
    nodes.push(
      createElement('span', { key: `txt-${cursor}` }, body.slice(cursor)),
    );
  }
  return nodes;
}

/**
 * Serialize a member into the inline tag form for insertion at the caret.
 * Trailing space is intentional so the cursor lands naturally after the chip.
 */
export function formatMentionTag(uuid: string, displayName: string): string {
  return `@[${displayName}](${uuid}) `;
}

/**
 * Find an active "@query" state at the given caret position.
 *
 * Returns `{ query, start }` if the caret is currently inside a mention
 * trigger (after a typed `@` with no closing punctuation/whitespace yet),
 * else null.
 *
 * Trigger rules:
 *   - `@` must be at start of string OR preceded by whitespace/punctuation
 *     (avoids triggering inside emails or mid-word references).
 *   - Query is everything from `@` (exclusive) up to caret.
 *   - Query is canceled by whitespace, newline, or `@` re-entry.
 *   - Query caps at 30 chars (keyboard-nav safety; nobody types that far).
 */
export function detectMentionQuery(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  if (caret <= 0 || caret > text.length) return null;

  // Walk backward from caret looking for the trigger @
  let i = caret - 1;
  let scanned = 0;
  while (i >= 0 && scanned < 31) {
    const ch = text[i];
    if (ch === '@') {
      const prev = i === 0 ? '' : text[i - 1];
      // @ must be at SOS or after whitespace/punctuation, not mid-word
      if (i === 0 || /[\s.,;:!?(){}[\]"'<>—–-]/.test(prev)) {
        const query = text.slice(i + 1, caret);
        // Cancel if the query slice contains forbidden chars
        if (/[\s\n]/.test(query)) return null;
        // Cancel if we hit a complete tag (the inline format already)
        if (query.includes('[') || query.includes(']') || query.includes('(')) return null;
        return { query, start: i };
      }
      return null;
    }
    if (/[\s\n]/.test(ch)) return null;
    i--;
    scanned++;
  }
  return null;
}

/**
 * Apply a member selection to a textarea value: replace the active @query
 * span with the formatted mention tag, and return the new value + the new
 * caret position (just after the inserted tag).
 */
export function applyMentionInsertion(
  value: string,
  triggerStart: number,
  caret: number,
  uuid: string,
  displayName: string,
): { value: string; caret: number } {
  const before = value.slice(0, triggerStart);
  const after = value.slice(caret);
  const tag = formatMentionTag(uuid, displayName);
  const next = before + tag + after;
  return { value: next, caret: before.length + tag.length };
}
