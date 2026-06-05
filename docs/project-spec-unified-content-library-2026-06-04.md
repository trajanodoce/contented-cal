# Project Spec — Unified Project Content Library

**Date:** 2026-06-04
**Effort estimate:** Medium — ~3–4 hr total across DB + frontend
**Hand-off:** Build Session
**Priority:** Medium — quality-of-life win for project-level discoverability; no data migration risk

---

## Problem

Today, the Content Library on a project page (`/projects/:projectId`) only shows items added directly to that project's library (`project_library` table). But every linked asset attached to a *task* inside that project — Figma files, Canva docs, Google Drive uploads, Notion pages, etc. (`external_links` table) — lives only on the task. To find a Figma file that a teammate linked from a blog task three weeks ago, you have to remember which task they linked it to and open that task's slide-over.

For a content team that ships dozens of pieces per project, this is friction every time someone needs to:

- find a brand template used across multiple pieces
- audit which assets are linked across all blog posts in a campaign
- hand a project off to a new contributor

The fix: surface task-level linked assets in the project's Content Library, alongside the directly-uploaded items, with clear attribution back to the parent task.

---

## Current state

### Data model

**`external_links`** (per-task assets):

| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `content_item_id` | uuid | FK → `content_items.id` |
| `platform` | enum | `figma` / `canva` / `miro` / `ordinal` / `google_docs` / `google_drive` / `notion` / `linear` / `file` / `other` |
| `url` | text | required |
| `title` | text | nullable |
| `thumbnail_url` | text | nullable |
| `metadata` | jsonb | platform-specific payload |
| `created_at` | timestamptz | |

**`project_library`** (project-level items today):

| column | type | notes |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → `projects.id` |
| `type` | text | `'file'` or `'link'` |
| `title` | text | |
| `url` | text | nullable (when `type='file'`) |
| `file_name` / `file_size` / `file_type` / `storage_path` | various | file-specific |
| `created_at` | timestamptz | |

The two tables don't reference each other. There's no join path from `external_links` → `project_id` today; we'd derive it via `content_items.project_id`.

### Components

- **`<ContentLibrary projectId workspaceId readOnly>`** at `src/components/projects/ContentLibrary.tsx` — renders `project_library` rows.
- **`<ExternalLinksSection contentItemId addToast readOnly>`** at `src/components/content/ExternalLinks.tsx` — renders `external_links` rows for one task.

---

## Proposed solution

**Read-only mirror, not duplication.** Don't copy `external_links` rows into `project_library`. Instead, the Content Library component fetches *both* sources and renders them in a unified view. Source of truth stays where each row lives; updates propagate automatically.

### Why this approach over duplication

- **No data drift.** If someone edits the asset title on the task, the library view reflects it without a sync job.
- **No FK fragility.** Soft-deleting a task → its linked assets disappear from the library cleanly. No orphan rows.
- **One write path.** Editing/deleting a task asset is still done from the task. The library view is a *consumer*, not an editor.
- **Simpler permissions.** No need to think about who can delete a project-library entry that's actually a task asset.

### UI shape

Two visual groups inside the Content Library card:

1. **Project library** (existing — items from `project_library`)
2. **From tasks** (new — items from `external_links` joined to tasks in this project)

Each "from tasks" item shows:

- Platform icon + label (reuse `PLATFORM_META` from `ExternalLinks.tsx`)
- Asset title (falls back to URL host if title is null)
- Thumbnail if `thumbnail_url` is set
- **Parent task chip** — clickable, opens the task slide-over via `setSelectedItemId`
- Created date
- Open-in-new-tab affordance

Items in the "from tasks" group are **read-only** in the library view. Edit + delete still happen via the parent task's slide-over (one click via the chip).

### Empty states

- **Both groups empty** → existing empty state (unchanged)
- **Only project library populated** → render existing group; hide "From tasks" header
- **Only from-tasks populated** → render "From tasks" group; render existing empty/CTA for project library

### Filter / search

Defer to v2. Right now Content Library has no filter or search, and adding both at once doubles the surface area. If "From tasks" volume becomes overwhelming (>50 items), we add a `<FilterBar>`-lite (platform filter + search) as a follow-up.

---

## Data fetching

Two queries, parallel. Both keyed on `projectId`.

```ts
// Existing — project_library
const { data: libraryItems } = await supabase
  .from('project_library')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false });

// New — external_links joined via content_items
const { data: taskAssets } = await supabase
  .from('external_links')
  .select(`
    id,
    platform,
    url,
    title,
    thumbnail_url,
    metadata,
    created_at,
    content_item_id,
    content_items!inner ( id, title, project_id, archived )
  `)
  .eq('content_items.project_id', projectId)
  .eq('content_items.archived', false)
  .order('created_at', { ascending: false });
```

Notes:

- `content_items!inner` ensures we filter on the join, not just select.
- Archived tasks' assets are excluded — keeps the library focused on active work. Restoring a task automatically restores its assets to the library view (no migration needed).
- Workspace-level RLS already gates `external_links` via `content_items` → no new policies needed.

### Realtime

For v1, refetch when the slide-over closes (cheap, ~2 queries). Save Supabase realtime subscriptions for v2 if the team flags lag.

---

## Files to touch

| File | Change |
|---|---|
| `src/components/projects/ContentLibrary.tsx` | Add `taskAssets` state + second fetch + grouped render. New sub-component `<TaskAssetRow>` mirroring the existing library row shape. ~80 lines. |
| `src/lib/database.types.ts` | No change (read-only join uses existing types) |
| `supabase/migrations/...` | No change — no schema additions needed |

No new components outside `ContentLibrary.tsx`. The visual treatment for "from tasks" rows is a styled variant of the existing library row, with a parent-task chip added.

---

## Phasing

Three sub-phases. Each independently shippable.

### CL.1 — Fetch + render task assets (~1.5 hr)

- Add `taskAssets` state + the second Supabase query
- Render in a new "From tasks" group below the existing library items
- Parent-task chip with click-to-open behavior
- Empty-state handling per the matrix above
- Loading state: shimmer skeleton matching existing library row

### CL.2 — Visual polish (~45 min)

- Platform icons (reuse `PLATFORM_META`)
- Thumbnail rendering when present
- Card spacing + section header treatment matching the canonical Phase 7 heading style (`text-[11px] font-semibold uppercase slate-500 tracking-[0.06em]`)
- Hover state + "open in new tab" affordance
- Date formatting consistent with existing rows

### CL.3 — Edge cases + polish (~30 min)

- Handle archived tasks (excluded from query — verify no edge cases)
- Handle deleted external_links mid-session (realtime caveat — refetch on slide-over close)
- Loading + error states surfaced as toasts via existing `addToast` channel
- Read-only enforcement: clicking edit/delete from a "from tasks" row routes to the parent task slide-over instead of attempting an inline mutation

---

## Out of scope (v2 candidates)

- **Filter + search bar** inside the Content Library — defer until volume warrants.
- **Bulk "promote to project library"** — convert a task asset into a true project-library entry. Skipping for now since the unified view solves the discoverability problem without the data duplication.
- **Drag-and-drop ordering** of library items — no user request for this yet.
- **Thumbnail generation pipeline** — for platforms that don't return a `thumbnail_url`, we could fetch og:image at link-create time. Already a v2 backlog item in the link-metadata fetcher.
- **Cross-project library** — surface all assets across all projects in a workspace. Different problem; out of scope.
- **Permissions** — a "viewer can see assets from tasks they can't open" check. Today RLS handles this via content_items membership; revisit if any user reports a leak.

---

## Edge cases

- **Task moved between projects.** External_links join via `content_items.project_id`, so moving a task automatically moves its assets between project libraries. No migration needed.
- **Task archived.** Assets disappear from the library view (filtered by `content_items.archived = false`). Restore re-adds them.
- **Task deleted (hard).** FK cascade removes the external_links rows. Library view updates on next refetch.
- **External_link with no title or thumbnail.** Fall back to URL host (e.g. "figma.com"). No empty card.
- **Same URL linked from two tasks.** Show both rows — they're separate `external_links` entries with separate parent tasks. Don't dedup. Users may want to see which tasks reference a shared brand template.
- **Large project (100+ tasks, 300+ assets).** Pagination in v2 if it becomes a problem. For v1, the team's projects are well under that threshold.

---

## Acceptance criteria

- [ ] Opening any project's Content Library shows two visually distinct groups when both have content: "Project library" + "From tasks"
- [ ] "From tasks" items show platform icon, title (or URL fallback), thumbnail if available, parent-task chip, and created date
- [ ] Clicking the parent-task chip opens that task's slide-over without leaving the project page
- [ ] Edit and delete affordances on "from tasks" rows are absent (read-only from the library)
- [ ] Archived tasks' assets are excluded from the view
- [ ] Loading and error states render gracefully (no flicker, no infinite spinners)
- [ ] Both groups render their existing empty states correctly when content is missing on either side
- [ ] No schema migration required — verified by typecheck + visual smoke test
