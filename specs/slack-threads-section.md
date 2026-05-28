# Slack Threads Section — Detail Panel UI/UX

**Status:** Draft spec
**Owner:** Taylor
**Discussed in:** ContentedCal UX/Functionality session
**Hand-off to:** Code Review Session (for implementation)
**Related specs:** `specs/slack-thread-behavior.md` (the underlying capture behavior)

---

## Context

Today, links out to Slack threads from a content item would fall into the generic `external_links` table — the same place a Figma URL or Google Doc lives. But a Slack thread carries far more structured context than a generic link:

- A channel
- A requester (who triggered the @mention)
- A parent message
- Thread participants
- A timestamp
- An optional captured transcript

This makes Slack threads a **conversation artifact**, not an **asset** — closer in nature to a Granola meeting note than to a design file link. ContentedCal already has a dedicated `GranolaNoteSection` for meeting notes. This spec defines the parallel pattern for Slack.

---

## Mental model

Two tiers of integration in the detail panel:

| Tier | Examples | Treatment |
|---|---|---|
| **Conversation artifacts** | Granola notes, Slack threads | Dedicated section with structured metadata, multiple-per-item, expandable detail |
| **Assets / references** | Figma, Google Docs, Notion, file uploads | Generic `External Links` section, badge per link |

After this spec ships, the rule is: **conversations get their own sections; assets share a section.**

---

## What ships in v1

1. **Top-of-panel source banner** for items that *originated* in Slack — same visual treatment as the existing Ordinal/Linear banner.
2. **`SlackThreadsSection`** in the detail panel body, parallel to `GranolaNoteSection`.
3. **Auto-link**: the originating thread (from `slack-content-request` / @mention) attaches automatically when the item is created.
4. **Manual link**: a "Link a Slack thread" affordance lets users paste a Slack thread permalink to attach an additional thread.
5. **Multi-thread support**: a single content item can have many linked Slack threads.

---

## 1. Source banner (top of detail panel)

For items where the **origin** is Slack (`tags` includes `slack-request` OR `custom_fields._source === 'slack'`).

**Visual:**

- Sits at the very top of the detail panel, above the title — matches the existing Ordinal/Linear banner placement.
- Background: `${SLACK_COLOR}30` (light red wash). Border-bottom: `1px solid ${SLACK_TEXT}` (or `SLACK_COLOR` darker variant).
- Icon: Slack-style speech-bubble or `#` glyph in a `SLACK_TEXT`-colored 24×24 rounded square.
- Heading: `Sourced from Slack — #{channel name}` (bold, `SLACK_TEXT`).
- Sub-line: `Requested by {requester display name} • {relative timestamp}` (small, `SLACK_TEXT` lighter).
- Right-side action: `Open in Slack →` button (matches Ordinal/Linear banner style — outline button using `SLACK_TEXT` color, `${SLACK_COLOR}60` border, white bg).

**Behavior:**

- Banner is informational; it doesn't take an action other than the "Open in Slack" link.
- Editing the item title/description/etc. is still allowed (unlike Ordinal which marks the item read-only).
- If the originating Slack thread is later **unlinked** in the SlackThreadsSection (by deleting it from the list), the banner disappears too. The `tags` and `_source` value persist — the banner is purely tied to the active link, not historical metadata.

---

## 2. `SlackThreadsSection` — placement and structure

**Where it lives in the detail panel:**

Place between **Granola Notes** and **External Links** (so the order top-to-bottom is: Granola → Slack → External Links → Subtasks → Comments → Activity). Rationale: conversation artifacts grouped at top, references below them, work artifacts at the bottom.

**Section header (always visible):**

- Faune Text Bold 700 / 13px label: `SLACK THREADS` (uppercase, slate-500, tracking-wide), with the Slack icon at `SLACK_TEXT` color
- Count pill: `{thread count}` (light Slack-color bg, `SLACK_TEXT` text)
- Right side: `+ Link Thread` button (small chip, `SLACK_TEXT` text, `${SLACK_COLOR}15` bg)

**Empty state:** show the section header with an inline `Link a Slack thread` dashed-border button below it, mirroring the Granola empty state.

---

## 3. Per-thread card (collapsed state)

Each linked Slack thread renders as a card inside the section. Default collapsed.

**Layout:**

```
┌────────────────────────────────────────────────┐
│ [icon] {parent message first line, 1-line     │  
│        truncated}                             │
│        {channel} • {requester} • {time ago}   │
│                              [Open in Slack ▸]│
└────────────────────────────────────────────────┘
```

**Visual specs:**

- Card: rounded-xl, white bg, `border: 1px solid ${SLACK_COLOR}30`
- Left icon column: 32×32 rounded-lg square, `${SLACK_COLOR}15` bg, Slack icon `SLACK_TEXT` color
- Title row: parent message first line (or "Untitled thread" fallback), truncated, 14px / 600 weight / slate-900
- Meta row: `#{channel} • @{requester} • {relative time, e.g. "3 days ago"}` — 11px / slate-500
- "Open in Slack" button: 11px / 600 / `SLACK_TEXT`, `${SLACK_COLOR}40` border, `${SLACK_COLOR}08` bg, small chevron icon. Same style as Granola's "Open in Granola" button.
- Whole card is clickable to expand (hover state: lifts slightly).

---

## 4. Per-thread card (expanded state)

When the card is expanded (user clicks the row), reveal additional detail below the header:

**Expanded sections:**

1. **Meeting-style details row** — chips with icons:
   - Clock icon + thread start datetime
   - Folder icon + channel name (clickable to open the channel in Slack? Optional v2)
   - People icon + number of participants (e.g. "4 participants")

2. **Captured thread transcript** — light-bg block showing each message in the thread as captured at creation time (per `slack-thread-behavior.md` description formatting rules):
   ```
   [YYYY-MM-DD HH:mm] Author Name:
   Message body...
   ```
   Each message separated by a divider. Long threads collapse with a "Show all N messages" toggle (per the truncation rule in the behavior spec: first 5 + last 20 + omitted marker).

3. **Footer actions row:**
   - `Open in Slack →` (primary, opens the thread)
   - `Refresh thread` (icon button — refetches the thread content and updates the transcript; v2 maybe)
   - `Unlink` (icon button, slate-400 → red-500 on hover; confirmation popover before removing)

---

## 5. Manual linking flow

**Trigger:** clicking `+ Link Thread` in the section header.

**UI:**

A small modal or inline form appears below the section header:

```
┌────────────────────────────────────────────────┐
│  Paste a Slack thread URL                     │
│  ┌──────────────────────────────────────────┐ │
│  │ https://yourworkspace.slack.com/archives/│ │
│  └──────────────────────────────────────────┘ │
│                       [Cancel]  [Link Thread] │
└────────────────────────────────────────────────┘
```

**Validation:**

- Accepted URL pattern: `https://{workspace}.slack.com/archives/{channel_id}/p{message_ts_no_dot}` (and variations: thread permalinks).
- The form parses out `channel_id` and `thread_ts` from the URL.
- On submit, the backend resolves the thread via the Slack API to:
  - Verify the bot has access (must be in the channel).
  - Fetch the parent message + reply count + participants + permalink.
  - Insert into `slack_thread_links` (new table — see Data model section).
- If parsing fails → inline error: *"That doesn't look like a Slack thread URL. Try copying the link from the message's '⋮ menu → Copy link.'"*
- If the bot can't access it → inline error: *"ContentedCal can't see this thread. Make sure the bot is invited to #{channel}."*
- If the thread is already linked to this item → inline message: *"This thread is already linked."*
- If the thread is linked to a *different* item → inline warning: *"This thread is currently linked to '{other item title}'. [Move it here] [Cancel]"*

**Result:** new thread card appears in the section. Activity log entry: *"linked Slack thread from #channel."*

---

## 6. Data model

A new table `slack_thread_links` (parallel to `granola_note_links`):

```sql
CREATE TABLE slack_thread_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  slack_channel_id text NOT NULL,
  slack_thread_ts text NOT NULL,
  permalink text NOT NULL,
  channel_name text,
  parent_message text,
  parent_author_id text,
  parent_author_name text,
  requester_id text,                       -- Slack user ID who triggered the @mention (NULL for manually-linked threads)
  requester_name text,
  participant_count integer,
  captured_at timestamptz NOT NULL DEFAULT now(),
  thread_start_at timestamptz,             -- When the parent message was posted
  is_origin boolean NOT NULL DEFAULT false,-- TRUE for the auto-linked originating thread (drives the top-of-panel banner)
  raw_thread_snapshot jsonb,               -- Full message list captured at link-time, used for the expanded transcript
  added_by uuid REFERENCES profiles(id),   -- ContentedCal user who manually linked (NULL for auto)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_slack_thread_links_per_item ON slack_thread_links (content_item_id, slack_channel_id, slack_thread_ts);
CREATE INDEX idx_slack_thread_links_content_item ON slack_thread_links (content_item_id);
CREATE INDEX idx_slack_thread_links_thread ON slack_thread_links (slack_channel_id, slack_thread_ts);
```

**RLS:** select/insert/delete gated by workspace membership through the `content_items` row.

**Migration considerations:**

- Existing Slack-origin content items (today they have `tags: ['slack-request']` + `custom_fields._slack_*` fields) need to be backfilled into `slack_thread_links` rows with `is_origin = true`. Idempotent backfill: for every content_item where `_slack_thread_ts` exists, INSERT into `slack_thread_links` if not already present. Code Review Session handles the migration script.
- After backfill, the `custom_fields._slack_*` fields can stay for historical compatibility but `slack_thread_links` becomes the source of truth.

**Index used by the spec's dedup logic** (from `slack-thread-behavior.md`): the unique index on `(content_item_id, slack_channel_id, slack_thread_ts)` plus the `idx_slack_thread_links_thread` on `(slack_channel_id, slack_thread_ts)` make the "is this thread already linked anywhere?" lookup fast.

---

## 7. Edge cases

1. **Manually linking the originating thread again** — already covered by the unique constraint. Inline message: *"This thread is already linked."*
2. **Manually linking a thread that's the *origin* of a different item** — show the "Move it here / Cancel" prompt. Confirming `Move it here` sets `is_origin = false` on the old row and `is_origin = true` on the new row (or just transfers ownership — open question, see below).
3. **The originating thread is unlinked by the user** — the source banner disappears. `is_origin` flag on the row is gone (row deleted). Future @mentions in that same thread (per `slack-thread-behavior.md`) would re-create it: the spec's create-vs-comment branch would see no existing link and *create* a new content item, not comment on the now-unlinked one. (Alternative: dedup by `(channel_id, thread_ts)` *globally*, ignoring linked-state. See open questions.)
4. **Workspace member loses Slack mapping** — `requester_name` is captured at link-time, so it survives even if the user later disconnects. The "Open in Slack" link still works (Slack will prompt to log in if needed).
5. **Slack workspace disconnected from ContentedCal** — existing `slack_thread_links` rows stay (historical record). New auto-linking and manual linking both fail with a clear error. Section header can show a banner: *"Slack is disconnected. Reconnect in Settings → Integrations to link new threads."*
6. **Long parent message** — truncate to first line / 120 chars in the collapsed card; expanded view shows full first message.
7. **Threaded messages with attachments** — represent in the expanded transcript as `📎 filename.ext` lines (per behavior spec).

---

## 8. Source banner — when to show

Show the banner if and only if there's at least one `slack_thread_links` row for the item with `is_origin = true`.

If the user unlinks the origin thread, the banner disappears even though the item was historically Slack-sourced. The `tags = ['slack-request']` tag and `custom_fields._source = 'slack'` stay (so filters still work), but the banner is link-driven, not tag-driven.

---

## 9. Acceptance criteria

Code Review Session can verify against these:

- [ ] An item created via a Slack @mention (per `slack-thread-behavior.md`) automatically gets a `slack_thread_links` row with `is_origin = true`.
- [ ] Opening the detail panel for that item shows the source banner with channel name, requester, and "Open in Slack" link.
- [ ] The `SlackThreadsSection` lists that thread as a card. Clicking the card expands it to show the captured transcript and meta details.
- [ ] Clicking `+ Link Thread`, pasting a valid Slack permalink, and submitting adds a second thread card to the section.
- [ ] Pasting a malformed URL → inline error, no row created.
- [ ] Pasting a permalink the bot can't access → inline error.
- [ ] Pasting a permalink already linked to *this* item → "already linked" message.
- [ ] Pasting a permalink linked to *another* item → "Move it here / Cancel" choice; choosing Move transfers the link.
- [ ] Unlinking the origin thread removes both the card and the source banner.
- [ ] Unlinking a non-origin thread removes only the card.
- [ ] Existing Slack-origin items (pre-migration) show the banner + a thread card after backfill runs.
- [ ] The section honors workspace RLS — users without access to the workspace can't see the section.

---

## 10. Out of scope (v1)

- **Live thread sync** — once captured, the transcript is frozen. We don't re-fetch when new messages arrive in Slack.
- **Slack message reactions as signals** — e.g., 👀 reaction on the parent doesn't change the item's status.
- **In-Slack search from ContentedCal** — no "find a thread to link" via Slack search UI from inside ContentedCal. Users paste URLs only.
- **Cross-workspace linking** — a Slack thread must be in a channel that maps to the current ContentedCal workspace.
- **Thread preview unfurl** — no inline image/file thumbnails for attachments in v1; just text + `📎 filename`.

---

## 11. Open questions

1. **"Move it here" semantics** — when manually linking a thread that's already linked to another item, does the new link *transfer ownership* (delete the old row) or *create a duplicate* (one thread → multiple items)? Spec assumes transfer. Confirm before build.
2. **Origin re-attach** — if user unlinks the origin thread and later a new @mention fires in that same thread, should the spec's dedup-by-(channel,thread_ts) logic look at *all* historical links or only active links? Default: only active. Means an unlinked origin thread can be re-captured into a new item.
3. **Manual link → does it count as "origin"?** Default: no. `is_origin` only ever set by auto-link from the Slack Edge Function. Manual links from a user are always `is_origin = false`. Confirm.
4. **Refresh transcript action** — the per-thread footer suggests a "Refresh thread" button that re-fetches the latest content from Slack. Worth shipping in v1 or defer to v2?
5. **Custom emoji / Slack-specific formatting** — captured messages may contain `:smile:` shortcodes or rich Slack mentions like `<@U12345>`. Decode to display names + emoji unicode in the transcript? Or keep raw? Default: decode, fall back to raw if resolution fails.

---

## 12. Visual reference — design system anchors

- Source color: `SLACK_COLOR = #9B3A3A`, `SLACK_TEXT = #9B3A3A` (already in `src/lib/ordinal.ts`).
- Slack badge background convention from design system: `${SLACK_COLOR}15` for fills, `${SLACK_COLOR}30` for borders, `${SLACK_COLOR}40` for selected/hover.
- Section follows the same card hierarchy as `GranolaNoteSection` — 1.5px outer card border (`#002339`) on the detail panel, 1px nested borders (`#00233930`) on per-thread cards.
- Typography per the design system: Faune Text Bold 700 for section heading, Violet Sans for body, 11px uppercase for field labels.

---

## 13. Hand-off notes for the Code Review Session

- Build the new `slack_thread_links` table + RLS policies + backfill migration first.
- Update the Slack Edge Function (`slack-content-request`, `slack-contentcal-bot`) to write rows to `slack_thread_links` with `is_origin = true` on create, matching the dedup rules in `specs/slack-thread-behavior.md`.
- Create `SlackThreadsSection` component (`src/components/content/SlackThreadsSection.tsx`) modeled after `GranolaNoteSection`.
- Wire it into `DetailSlideOver` between Granola and External Links.
- Update the existing source-banner logic in `DetailSlideOver` to also handle Slack (it currently handles only Ordinal/Linear).
- Add the manual-link URL parser + Slack API resolver as a new Edge Function or inline in the existing Slack function.
- Verify the spec changes from `specs/slack-thread-behavior.md` still hold — specifically the dedup behavior — once the origin link lives in the new table instead of `custom_fields`.
- Surface deviations or ambiguities back to this session before implementing.
