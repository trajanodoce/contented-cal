# Build Session Handoff — 2026-06-08

Items from the eval session's security & hygiene review that touch `src/` or require git coordination. The eval session will handle everything else (edge functions, migrations, deploys).

---

## Item 10 — Remove 3 `any` types in frontend code

Three Supabase join queries return a dynamic shape that's currently typed as `any`. Each has an eslint-disable comment. The fix is to define a local interface matching the join result, eliminating the `any` without fighting the Supabase generic.

### 10.A — `src/contexts/AppContext.tsx` line 144

**Current:**
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
const enriched = membersRes.data.map((m: any) => ({
  ...m,
  id: m.user_id,
  email: m.profiles?.email ?? (m.user_id === user.id ? user.email : undefined),
  full_name: m.profiles?.full_name ?? (m.user_id === user.id ? user.user_metadata?.full_name : undefined),
  avatar_url: m.profiles?.avatar_url ?? (m.user_id === user.id ? user.user_metadata?.avatar_url : undefined),
  profiles: undefined,
}));
```

**Fix:** Define a local type above the map call:

```ts
interface MemberWithProfile {
  user_id: string;
  workspace_id: string;
  role: WorkspaceRole;
  created_at: string;
  muted_projects: string[];
  profiles: Profile | null;
}
```

Then cast: `membersRes.data.map((m: MemberWithProfile) => ...)`. Remove the eslint-disable line.

The query that feeds this is the `workspace_members` select with a `profiles(...)` join — check what columns are actually selected and match.

---

### 10.B — `src/components/settings/TeamTab.tsx` line 80

**Current:**
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
const mapped = (membersRes.data || []).map((m: any) => ({
  user_id: m.user_id,
  role: m.role as Role,
  created_at: m.created_at,
  profile: m.profiles as Profile,
}));
```

**Fix:** Reuse the same `MemberWithProfile` shape (or define locally). The destructured fields are `user_id`, `role`, `created_at`, `profiles`. Same join shape as 10.A.

```ts
const mapped = (membersRes.data || []).map((m: MemberWithProfile) => ({
  user_id: m.user_id,
  role: m.role,
  created_at: m.created_at,
  profile: m.profiles,
}));
```

If you want to share the type across files, export it from `database.types.ts` alongside the existing `WorkspaceMember` type.

---

### 10.C — `src/pages/MyWorkPage.tsx` line 94

**Current:**
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join returns dynamic shape
const mapped = (mySubtasks || []).map((st: any) => ({
  ...st,
  parent_title: st.content_items?.title || 'Unknown',
  parent_id: st.content_items?.id || st.content_item_id,
  content_items: undefined,
}));
```

The query at line 86–91 is:
```ts
.from('subtasks')
.select('*, content_items!inner(id, title, workspace_id)')
.eq('assignee_id', user.id)
.eq('completed', false)
.eq('content_items.workspace_id', currentWorkspace.id)
```

**Fix:** Define a local type:

```ts
interface SubtaskWithParent {
  id: string;
  title: string;
  content_item_id: string;
  assignee_id: string | null;
  completed: boolean;
  due_date: string | null;
  position: number;
  content_items: { id: string; title: string; workspace_id: string };
}
```

Then: `(mySubtasks || []).map((st: SubtaskWithParent) => ...)`. Remove the eslint-disable line.

---

### Verification

After all three, run `npx tsc --noEmit` and `npm run lint` — the three eslint-disable comments should be gone and no new errors should appear.

---

## Item 7 — Pull 3 deployed edge functions into the repo

Three edge functions exist on the remote Supabase deployment but have no source in `supabase/functions/`. They need to be pulled into the repo for code review, git history, and rollback capability.

| Function | Remote version | verify_jwt | Notes |
|---|---|---|---|
| `slack-status-notify` | v7 | true | Triggered by DB webhook on status change |
| `sync-ordinal-posts` | v8 | true | Ordinal post sync |
| `sync-granola-notes` | v9 | true | Granola note sync |

### Steps

1. For each function, use the Supabase dashboard (or `supabase functions download <slug>` if available) to get the deployed source
2. Create the local directory: `supabase/functions/<slug>/index.ts`
3. Verify the local copy matches the deployed version by comparing behavior (the deployed `ezbr_sha256` hashes are in the edge function list)
4. Commit all three together

### Important

- Do **not** redeploy after pulling — the goal is source parity, not a new deploy
- All three have `verify_jwt: true`, so they use Supabase's built-in JWT gate (no application-level auth needed)
- If any function imports shared modules or has a `deno.json`, pull those too

---

## Ownership

| Item | Session | Status |
|---|---|---|
| 10.A–C (any types) | Build | Ready to execute |
| 7 (pull functions) | Build | Ready to execute |
| Items 1–6, 8–9 | Eval (this session) | Pending Taylor's go-ahead |
