import { useState, useRef, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle, type KeyboardEvent } from 'react';
import { Avatar } from '../ui/Avatar';
import { detectMentionQuery, applyMentionInsertion } from '../../lib/mentionFormat';

export interface MentionableMember {
  id: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  members: MentionableMember[];
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  /** Inline style passed through to the underlying textarea. */
  style?: React.CSSProperties;
  /**
   * Optional escape hatch for parent-managed keystrokes (e.g. ⌘↵ to save).
   * Called BEFORE this component's own handlers; if it calls preventDefault,
   * the component's handlers are skipped. Mention-related keys (Up/Down/
   * Enter/Tab/Esc) are reserved while the dropdown is open and not passed
   * through.
   */
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Auto-focus on mount. */
  autoFocus?: boolean;
}

export interface MentionAutocompleteHandle {
  focus: () => void;
}

/**
 * Phase 6.3 — Textarea with @mention autocomplete (lean v1).
 *
 * Behavior:
 *   - Typing `@` (at start-of-string or after whitespace/punctuation) opens
 *     a dropdown of workspace members filtered by the query string.
 *   - Arrow keys navigate; Enter / Tab inserts; Esc dismisses.
 *   - Clicking a row inserts via the same path.
 *   - Selection inserts the inline tag `@[Display Name](uuid)` into the
 *     value at the caret; the alert trigger reads the derived `mentions[]`
 *     column at save time (caller is responsible for extracting + saving).
 *
 * Per the simplified scope: no workspace-aware disambiguation, no
 * project-scope add-modal. Mention anyone in the workspace.
 */
export const MentionAutocomplete = forwardRef<MentionAutocompleteHandle, Props>(function MentionAutocomplete(
  { value, onChange, members, placeholder, disabled, rows = 3, className, style, onKeyDown, autoFocus },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute current trigger state from value + caret
  const trigger = useMemo(() => detectMentionQuery(value, caret), [value, caret]);

  // Filter members by the active query (case-insensitive prefix or substring)
  const matches = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (!q) {
      // Empty query: show first 8 members alphabetically
      return [...members]
        .sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || ''))
        .slice(0, 8);
    }
    const matchers = members.map((m) => {
      const name = (m.full_name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      let rank = 99;
      if (name.startsWith(q)) rank = 0;
      else if (email.startsWith(q)) rank = 1;
      else if (name.includes(q)) rank = 2;
      else if (email.includes(q)) rank = 3;
      return { m, rank };
    });
    return matchers
      .filter((x) => x.rank < 99)
      .sort((a, b) => a.rank - b.rank || (a.m.full_name || '').localeCompare(b.m.full_name || ''))
      .slice(0, 8)
      .map((x) => x.m);
  }, [trigger, members]);

  // Reset highlight when matches change
  useEffect(() => {
    setHighlight(0);
  }, [trigger?.query, trigger?.start, matches.length]);

  const open = !!trigger && matches.length > 0;

  const insertMention = useCallback(
    (member: MentionableMember) => {
      if (!trigger) return;
      const name = member.full_name || member.email || 'Unknown';
      const { value: next, caret: nextCaret } = applyMentionInsertion(
        value,
        trigger.start,
        caret,
        member.id,
        name,
      );
      onChange(next);
      // Defer caret update until React has flushed the value change
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(nextCaret, nextCaret);
          setCaret(nextCaret);
        }
      });
    },
    [trigger, value, caret, onChange],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Give parent first dibs (e.g. ⌘↵ save). If they preventDefault we bail.
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        break;
      case 'Enter':
      case 'Tab': {
        if (matches[highlight]) {
          e.preventDefault();
          insertMention(matches[highlight]);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        // Move caret one past to dismiss; simplest: insert a space (no — that
        // would mutate). Instead, signal "not in trigger" by nudging caret.
        // Cleanest: just blur briefly. We won't blur — instead, hide via state.
        // Simplest hack: append a no-op space at caret to break the trigger.
        // Actually — just unset the highlight; user can keep typing to dismiss.
        // The dropdown will close when they type whitespace anyway.
        // For an immediate dismiss, we'll set a "manually dismissed" flag:
        setDismissedTrigger({ start: trigger!.start, query: trigger!.query });
        break;
    }
  };

  // Track manually dismissed triggers so Esc actually closes the dropdown
  const [dismissedTrigger, setDismissedTrigger] = useState<{ start: number; query: string } | null>(null);
  const isDismissed =
    dismissedTrigger &&
    trigger &&
    dismissedTrigger.start === trigger.start &&
    dismissedTrigger.query === trigger.query;
  const reallyOpen = open && !isDismissed;

  // Clear dismissal when the trigger position changes
  useEffect(() => {
    if (!trigger) {
      if (dismissedTrigger) setDismissedTrigger(null);
      return;
    }
    if (dismissedTrigger && dismissedTrigger.start !== trigger.start) {
      setDismissedTrigger(null);
    }
  }, [trigger, dismissedTrigger]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        style={style}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
        }}
        onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
        onClick={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={handleKeyDown}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
      />
      {reallyOpen && (
        <div
          className="absolute z-50 mt-1 left-0 right-0 max-w-md bg-white rounded-lg shadow-lg overflow-hidden"
          style={{
            border: '1px solid #00233920',
            background: 'linear-gradient(135deg, #F7F9FC 0%, #FFFFFF 100%)',
          }}
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 border-b" style={{ borderColor: '#00233910' }}>
            {trigger?.query ? `Mention: "${trigger.query}"` : 'Mention someone'}
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {matches.map((m, i) => {
              const name = m.full_name || m.email || 'Unknown';
              const isActive = i === highlight;
              return (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm"
                  style={{
                    backgroundColor: isActive ? '#005D9712' : 'transparent',
                  }}
                >
                  <Avatar src={m.avatar_url} name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{name}</div>
                    {m.email && m.full_name && (
                      <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-1 text-[10px] text-slate-400 border-t" style={{ borderColor: '#00233910' }}>
            ↑↓ navigate · ↵ select · Esc dismiss
          </div>
        </div>
      )}
    </div>
  );
});
