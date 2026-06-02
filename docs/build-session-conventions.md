# Build Session Conventions — ContentedCal

Workflow patterns for the build/ship session. Read this first when starting fresh.

## Session roles

- **This session (build):** writes code, runs migrations, deploys edge functions, commits, pushes to main.
- **The other session (UI/UX):** ideation only — designs in `ContentedCal-Design-Workshop.html`, promotes to `ContentedCal-Design-System.html`, writes handoff docs. Does NOT build or commit.
- **Handoffs flow one direction:** UI/UX session → docs/handoff file → build session reads spec → builds → ships.

## Shipping conventions

- **Hold and batch commits.** Build everything, commit logically, push once. Each `git push` = one Vercel deploy. The free tier cap is 100/day but the real win is easier rollback and less noise.
- **Commit structure:** group by logical unit, not by file. Each commit should be independently revertible.
- **Push only when the user says "push" or "ship"** — never auto-push after building.
- **Co-author trailer:** `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` on every commit, regardless of actual model version (project convention).

## Verification before committing

Always run these before committing meaningful changes:
```bash
cd /Users/taylor/Documents/GitHub/contented-cal && npx tsc --noEmit
```

For lint baseline, target ≤10 problems (we shipped at 22 problems; most are `react-refresh/only-export-components` warnings which are harmless).

## Parallel agents

- Use parallel agents for **independent** work (different files, no data dependencies).
- Use sequential when one depends on the other's output.
- Send multiple `Agent` tool calls in a **single message** to run in parallel.
- Cap practical parallelism at ~4 concurrent agents.
- After agents finish, always re-run `npx tsc --noEmit` to verify integration.

## Self-refactor traps to watch

- **Don't trust "unused import" warnings blindly.** Symbols used inside `useMemo`/`useCallback` bodies can be missed by simple lint rules. Search the whole file for the symbol before removing.
- **Don't reuse variable names across scopes when refactoring.** The `statusName` → `isDoneStatus()` extraction left an orphaned reference because one site still used `statusName` inline.
- **After mass removal, grep for the removed symbol** to confirm zero references remain.

## Repo geography

| Path | Purpose |
|------|---------|
| `src/components/ui/` | Canonical shared components (Avatar, ConfirmModal, EmptyState, SettingsTabs, AvatarUploadModal) |
| `src/components/activity/` | ActivityLogRow + parseActivityAction |
| `src/components/custom-fields/` | CustomFieldInput + CustomFieldReadout |
| `src/components/list/` | BulkActionToolbar |
| `src/lib/itemHelpers.ts` | isDoneStatus, getContentType, getBoardColumn, etc. |
| `src/lib/colors.ts` | BRAND, SURFACE, PRIORITY_COLOR constants (created but not yet swept into consumers) |
| `src/lib/relativeTime.ts` | Canonical relative-time formatter |
| `supabase/migrations/` | DB migrations (applied via Supabase MCP `apply_migration`) |
| `supabase/functions/` | Edge functions (deployed via Supabase MCP `deploy_edge_function`) |
| `docs/` | Handoff docs from UI/UX session + hygiene reviews |

## Database / backend tools

- **Apply migrations** via `mcp__supabase__apply_migration` (Supabase MCP). Also write the SQL file to `supabase/migrations/<timestamp>_<name>.sql` for git history.
- **Deploy edge functions** via `mcp__supabase__deploy_edge_function`. Set `verify_jwt: false` for public endpoints with custom auth (API key, Slack signature).
- **Don't use Supabase CLI** — it's not installed and the user authenticates via MCP.

## State management patterns

- **AppContext** owns the workspace content_items load + one centralized realtime subscription. Pages consume `useApp().contentItems`. `patchContentItem(id, fields)` is the canonical optimistic-update helper.
- **State flags** (`archived`, `needs_triage`) live on `content_items` as booleans. AppContext filters them out of the central list. Realtime handler removes-on-flip-true and adds-on-flip-false.
- **Members** come from `useApp().members` (enriched with `id` alias = `user_id`). Don't refetch locally — BoardPage and CalendarPage used to do this and were unified.

## Design system anchors

| Source | Use |
|--------|-----|
| `ContentedCal-Design-System.html` | Canonical truth for promoted patterns. Open in browser; search by `<h2>` heading. |
| `ContentedCal-Design-Workshop.html` | Drafts in review (Wave 3 source). Items here are NOT yet promoted. |
| `docs/design-system-batch-3-handoff-2026-06-01.md` | Wave 2 + Wave 3 spec list + file pointers. |

## Specific gotchas

- **Slack manifest:** has `pkce_enabled: true` baked in. Can't be removed once set. If updating the manifest, keep `token_rotation_enabled: true`.
- **`.mcp.json`** is gitignored — contains the API key. Don't commit it.
- **The ListPage Avatar wiring** uses `useWorkspaceData` for members, not `useApp().members`. Don't conflate the two shapes — `useWorkspaceData` returns `Profile[]` directly.
- **Vercel free tier:** 100 deploys/day. We're nowhere near it but bundle commits anyway for sanity.
- **Edge function `slack-contentcal-bot`** has thread dedup via `slack_thread_links` table. Don't re-add custom_fields-based dedup.

## Notion backlog

The Notion backlog at `https://www.notion.so/36ed971055d68145831ced976ccc9418` tracks:
- Open items (organized by area)
- Recently completed (changelog format, dated)
- Specs that are parked but not built

Update the changelog section after shipping a feature. Don't double-track items already in Notion in this file.

## When in doubt

- Read the spec from the canonical HTML file before guessing
- Spot-check the actual data shape in the database before writing types
- If the UI/UX handoff doc is ambiguous, flag it back to the user rather than guessing
