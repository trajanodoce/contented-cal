# Nitpick fixes from 2026-06-02 code review

Two small issues surfaced during the eval session review. Neither is broken — both are data-completeness gaps that will annoy someone eventually.

---

## 1. useTriageItems: realtime INSERT doesn't backfill channelMap

**File:** `src/hooks/useTriageItems.ts`

**What's happening:** The hook batch-fetches `channel_name` from `slack_thread_links` during `refresh()` (lines 36-51), but the realtime INSERT handler (line 69-72) adds the new item to `items` without fetching its channel name. The `channelMap` is stale until the next full `refresh()`.

**User-visible effect:** When a new Slack @mention creates a triage item in real time, the "#channel" chip on that row is blank. It fills in on the next page navigation or manual refresh. At current triage volume (~1-3 items/day) this is a sub-second flash, but it'll be more noticeable if Slack triage picks up.

**Fix:**

In the realtime INSERT handler (line 69-72), after adding the row to `items`, fetch the channel name for the new item and update `channelMap`:

```typescript
// Current (line 69-72):
if (payload.eventType === 'INSERT') {
  const row = payload.new as ContentItem;
  if (!row.needs_triage || row.archived) return;
  setItems((prev) => [row, ...prev]);
}

// Proposed:
if (payload.eventType === 'INSERT') {
  const row = payload.new as ContentItem;
  if (!row.needs_triage || row.archived) return;
  setItems((prev) => [row, ...prev]);

  // Backfill channel name for the new item
  supabase
    .from('slack_thread_links')
    .select('content_item_id, channel_name')
    .eq('content_item_id', row.id)
    .eq('is_origin', true)
    .maybeSingle()
    .then(({ data: link }) => {
      if (link?.channel_name) {
        setChannelMap((prev) => {
          const next = new Map(prev);
          next.set(link.content_item_id, link.channel_name);
          return next;
        });
      }
    });
}
```

**Notes:**
- The fetch is fire-and-forget — if it fails, the chip stays blank (same as current behavior). No error handling needed.
- There's a brief window where the item renders without the chip, then it pops in. This is fine — same pattern as avatar loading throughout the app.
- The `slack_thread_links` row may not exist yet when the realtime event fires (the Slack edge function creates the content item first, then inserts the thread link). If `.maybeSingle()` returns null, the chip stays blank until the next event or refresh. This is a race that's acceptable at this scale — the thread link insert follows within milliseconds.

**Scope:** ~10 lines in `useTriageItems.ts`. No other files touched. No backend changes.

---

## 2. Priority color conflict: PRIORITY_COLOR vs PRIORITY_STYLES

**Files:**
- `src/lib/colors.ts` (lines 17-22) — `PRIORITY_COLOR`
- `src/lib/utils.ts` (lines 47-82) — `PRIORITY_STYLES`

**What's happening:** Two priority color maps exist with different hex values for urgent:

| Level | `PRIORITY_COLOR` (colors.ts) | `PRIORITY_STYLES` (utils.ts) |
|-------|------------------------------|-------------------------------|
| urgent | `#ef4444` (Tailwind red-500) | `#BA2C2C` (brand crimson) |
| high | `#f97316` (same) | `#f97316` (same) |
| medium | `#fbbf24` (same) | `#fbbf24` (same) |
| low | `transparent` | `#94a3b8` (slate-400) |

`PRIORITY_COLOR` is **never imported anywhere** — it's an orphan created during the `colors.ts` extraction but never wired up. `PRIORITY_STYLES` in `utils.ts` is the actual source of truth, consumed by: HomePage, ListPage, MyWorkPage, DetailSlideOver.

**Fix — option A (recommended): delete PRIORITY_COLOR, add hex to comment**

Remove the orphan entirely. The canonical priority colors live in `PRIORITY_STYLES`. If a future consumer needs raw hex without Tailwind classes, they can use `PRIORITY_STYLES[level].hex`.

```diff
// colors.ts — delete lines 17-22:
-export const PRIORITY_COLOR = {
-  urgent: '#ef4444',
-  high: '#f97316',
-  medium: '#fbbf24',
-  low: 'transparent',
-} as const;
```

Add a comment in `colors.ts` pointing to the canonical location:

```typescript
// Priority colors live in PRIORITY_STYLES (src/lib/utils.ts) — they need
// Tailwind classes alongside hex, so they stay there as the single source.
```

**Fix — option B: reconcile and migrate**

If you want priority hex values in `colors.ts` as the single source, update `PRIORITY_COLOR` to match `PRIORITY_STYLES` and then have `PRIORITY_STYLES` import from `colors.ts`:

```typescript
// colors.ts
export const PRIORITY_COLOR = {
  urgent: '#BA2C2C',  // brand crimson (was #ef4444)
  high: '#f97316',
  medium: '#fbbf24',
  low: '#94a3b8',     // slate-400 (was transparent)
} as const;

// utils.ts — import and use:
import { PRIORITY_COLOR } from './colors';
// ... PRIORITY_STYLES entries reference PRIORITY_COLOR[level] for .hex
```

This is cleaner long-term but touches more files. Only worth it if you're planning the broader "extract all hex to colors.ts" pass from the design-system code-alignment backlog item.

**Scope:** Option A is ~5 lines deleted + 2 comment lines. Option B is ~15 lines across 2 files.

---

## Execution order

Either fix can ship independently. No dependencies between them, no backend changes, no migrations.
