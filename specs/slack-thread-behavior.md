# Slack Thread Behavior — ContentedCal

**Status:** Draft spec
**Owner:** Taylor
**Discussed in:** ContentedCal UX/Functionality session
**Hand-off to:** Code Review Session (for code-level diagnosis + implementation)

---

## Context

ContentedCal has a Slack integration that lets a user `@mention` the bot (or use a slash command — see open question below) to create a content item directly from Slack. The integration works well when the trigger fires on a top-level channel message, but **breaks down when triggered inside a thread**.

This spec defines how the integration *should* behave in threads. It does **not** diagnose the current bug — that's a separate Code Review Session task.

---

## Current state (assumed, not verified)

Best guesses about what's wrong today. The Code Review Session should confirm/correct these:

- Thread context (the parent message + replies) is likely ignored — only the message that contains the `@mention` is captured.
- The bot may reply to the channel instead of the thread, polluting the channel.
- Multiple `@mentions` in the same thread probably create duplicate items instead of being coalesced.
- The content item likely doesn't preserve a permalink back to the Slack thread.

---

## Desired behavior

### 1. Trigger: `@mention` (or slash command) inside a Slack thread

When the bot is `@mention`ed inside a thread:

1. The bot identifies the thread via `thread_ts` (and `channel_id`).
2. The bot looks up whether a ContentedCal content item already exists for this `(channel_id, thread_ts)` pair.

#### 1a. First `@mention` in the thread → **create** a content item

- **Description content:** the **full thread context** — the parent message **plus all replies up to and including** the `@mention` message that triggered the bot. Captured as the item's description.
- **Title:** the parent message's first line (truncated to ~120 chars), or a sensible fallback if the parent has no text.
- **Permalink:** the Slack thread URL stored on the item so users can jump back from ContentedCal to the original thread.
- **Source tag:** existing `slack-request` tag pattern (consistent with the rest of the integration).
- **Bot replies in-thread** with a message like:
  > ✅ Created in ContentedCal — [item title]
  > [link to the item]

#### 1b. Subsequent `@mention` in the *same thread* → **append as a comment** to the existing item

- Look up the item by `(channel_id, thread_ts)` and post the latest `@mention` message (just that message, not the whole thread) as a **comment** on the existing item.
- Bot replies in-thread:
  > 💬 Added to ContentedCal — [item title]
  > [link to the item]
- Rationale: lets a thread serve as a running log of follow-ups against the same item, rather than creating duplicates.

### 2. Trigger: `@mention` in a top-level channel message (no thread)

Behavior unchanged from today — create a content item from that single message. The `(channel_id, thread_ts)` dedup key still applies; the `thread_ts` is just the message's own ts when it's not in a thread.

### 3. Bot reply location

| Trigger location | Bot replies to |
|---|---|
| Top-level channel message | Channel (in-thread to the original message, i.e. `thread_ts = original message ts`) |
| Inside an existing thread | The same thread |
| DM with the bot | The DM |

Never replies to the channel as a separate top-level message in response to a thread trigger.

### 4. Content item structure (Slack-origin items)

| Field | Source |
|---|---|
| `title` | Parent message's first line (truncated 120 chars), or first non-empty line of the `@mention` message if no parent |
| `description` | Full thread context (parent + replies, formatted with author + timestamp per message) |
| `external_links` | Slack permalink → links table with `platform: 'slack'` |
| `tags` | Includes `slack-request` |
| `custom_fields._source` | `'slack'` |
| `custom_fields._slack_channel_id` | The channel ID |
| `custom_fields._slack_thread_ts` | The thread's parent ts (used as dedup key) |
| `custom_fields._slack_requested_by` | Slack user ID + display name of the person who triggered the bot |
| `created_by` | The ContentedCal user mapped to that Slack user (if mapping exists) or workspace default |

---

## Description formatting

Each captured message in the thread description should be formatted as:

```
[YYYY-MM-DD HH:mm] Author Name:
Message body text here. Mentions of @people resolved to display names.
Attachments listed as: 📎 filename.ext (link)
```

Messages separated by a blank line. The `@mention` of the bot itself is omitted from the captured text (it's noise).

If the thread is **very long** (say > 50 messages), capture the first 5, the last 20, and insert a `[…N messages omitted…]` marker between them. Avoids unbounded item description size.

---

## Deduplication key

The pair **`(channel_id, thread_ts)`** uniquely identifies a thread.

- For top-level messages, `thread_ts === message.ts`.
- For thread replies, `thread_ts` is the parent's ts.
- The Edge Function should query for an existing content item with matching `custom_fields._slack_channel_id` and `custom_fields._slack_thread_ts` before deciding create vs. comment.

A composite index on `(_slack_channel_id, _slack_thread_ts)` inside `custom_fields` would help this lookup. (Implementation note for Code Review Session.)

---

## Edge cases

1. **Bot is `@mention`ed in a DM with itself.** Treat the DM like a channel; thread_ts logic still applies. Create or comment based on dedup key. Bot replies in the DM.

2. **Bot can't read the parent message** (e.g., thread was started before the bot joined, or in a private channel the bot lacks `groups:history` for). Fall back to capturing only the `@mention` message. The bot reply mentions this:
   > ✅ Created in ContentedCal — couldn't read the full thread (missing permissions), so only your message was captured. [link]

3. **Thread parent was deleted** by the time the bot is `@mention`ed. Capture available replies and the `@mention`. Note in the description that the parent was deleted.

4. **`@mention` arrives with no message text** (just the bot ping). Use the parent message's first line as the title and the thread context as the description, same as 1a.

5. **Message edited in Slack after the item exists.** Out of scope for v1 — content items are frozen at creation. Future enhancement could re-fetch on every new `@mention`. (See open questions.)

6. **Message deleted in Slack after the item exists.** Out of scope for v1 — the deleted message stays in the description. Item is not deleted.

7. **Multiple workspaces share the same Slack workspace.** Route by the `channel_id` → workspace mapping (whichever ContentedCal workspace owns that Slack channel). If the channel isn't mapped, bot replies:
   > ⚠️ This Slack channel isn't connected to a ContentedCal workspace. Have an admin connect it in Settings → Integrations.

8. **Rate limit / 3-second Slack timeout.** Edge Function must `ack` within 3s, then process async (Slack's standard pattern). Show "Working on it…" interim if needed.

9. **Race condition: two `@mentions` fire near-simultaneously in a new thread.** Both could attempt to create an item. The dedup query must be wrapped in a transaction or use a unique constraint on `(_slack_channel_id, _slack_thread_ts)` to prevent duplicates.

10. **Bot is removed from the channel mid-conversation.** Subsequent `@mentions` won't reach us. No-op from our side. (Slack's responsibility.)

---

## Slash command parity

If a `/contentcal` slash command exists (e.g., `/contentcal new`), behavior in threads should match `@mention` behavior:

- `/contentcal` in a thread → same create-or-comment logic.
- `/contentcal new` (explicit override) → always create a new item, even if the thread already has one. Bot reply in-thread: *"Created a second ContentedCal item for this thread — [link]."*
- `/contentcal status` → bot replies in-thread with the linked item's current status (if exists), or "No ContentedCal item for this thread yet."

---

## Acceptance criteria

The Code Review Session can verify against these:

- [ ] `@mention` in a thread creates a content item whose `description` contains the parent message text and at least one reply.
- [ ] The created item has a Slack permalink in `external_links` (or equivalent).
- [ ] A second `@mention` in the same thread (different user, different reply) adds a comment to the *same* item rather than creating a new one.
- [ ] Bot's confirmation message posts inside the thread, not as a new channel message.
- [ ] `@mention` in a DM with the bot creates an item and replies in the DM.
- [ ] `@mention` in a top-level channel message (no thread) still works exactly as before.
- [ ] Triggering twice in a fresh thread within 1 second produces exactly one content item (race-safe).
- [ ] When the bot lacks permission to read the parent, it still creates an item from just the `@mention` and tells the user.

---

## Out of scope (v1)

- Real-time sync: editing or deleting a Slack message does NOT update or delete the corresponding ContentedCal item.
- Posting back from ContentedCal to Slack (e.g., "this item just moved to Published" → reply in the thread). Could be a future enhancement.
- Reactions as signals (e.g., 👀 → set status to Research). Future.
- Slack workflow builder / unfurl integration.

---

## Open questions

1. **Re-fetch thread on every new `@mention`?** Currently spec'd to freeze the description at item creation and append later `@mentions` as comments. Alternative: every `@mention` re-pulls the thread and overwrites the description with the latest. Which is more useful?
2. **Should the slash command be `/contentcal` or `/cc` or something else?** Branding decision.
3. **Should the bot user automatically be mapped to a ContentedCal user?** Today, `requested_by` is captured but the `created_by` falls back to the workspace default if there's no Slack→ContentedCal user mapping. Should we surface a "Map your Slack account" prompt in Settings?
4. **Threading depth.** Slack threads aren't nested, but messages can quote each other. Do we want to flatten quoted text into the description, or strip it?
5. **Comment author attribution.** When a follow-up `@mention` becomes a comment on the existing item, whose name is on the comment in ContentedCal — the Slack user who triggered it (mapped through), or the bot?

---

## Hand-off notes for the Code Review Session

- Diagnose the current Slack Edge Function (`supabase/functions/slack-events/` or similar) and report which of the assumed-current-behavior bullets above are actually true.
- Confirm the Slack app's OAuth scopes include `channels:history`, `groups:history`, `im:history`, `mpim:history`, `chat:write`, and `reactions:read` (the last only if we ever want reactions in scope).
- Verify the dedup key strategy is race-safe — ideally a Postgres unique constraint on the `(_slack_channel_id, _slack_thread_ts)` JSONB extraction, OR an upsert with `ON CONFLICT`.
- Build the changes against this spec's acceptance criteria.
- Surface any deviation from the spec back to this session before implementing — it's likely some bits will turn out to be more nuanced than this captures.
