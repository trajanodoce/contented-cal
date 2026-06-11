# Spec — Strict typecheck cleanup pass (28 errors)

**Created:** 2026-06-08 (post Commit B sweep)
**Trigger:** Type regeneration on commit `8faa414` surfaced 28 pre-existing `npm run typecheck` errors across 14 files. The canonical `tsconfig.app.json` had been bypassed by the default `npx tsc` invocation for months, masking drift.

**Status:** Not blocking — `vite build` ships clean (esbuild type-strips, doesn't enforce strict TS). Blocks any future strict CI gate.

**Recommended order:** Cluster A → B → C → D (largest impact first). All four can land in one commit, or split per cluster.

**Total estimate:** ~1 hr 30 min focused work.

---

## Cluster A — `members` shape mismatch (7 errors, fixed at the source)

**Cluster size:** 7 errors across `BoardPage.tsx` and `CalendarPage.tsx`.

**Files / lines:**
- `src/pages/BoardPage.tsx:526` (passed to `<FilterBar>`)
- `src/pages/BoardPage.tsx:600` (passed to `<BoardColumnContainer>`)
- `src/pages/BoardPage.tsx:616` (passed to `<BoardCard>` overlay)
- `src/pages/CalendarPage.tsx:1111` (passed to `<FilterBar>`)
- `src/pages/CalendarPage.tsx:1267` (passed to `<MonthView>`)
- `src/pages/CalendarPage.tsx:1290` (passed to `<WeekView>`)
- `src/pages/CalendarPage.tsx:1309` (passed to `<DayView>`)

**Root cause:** `AppContext.members` is typed as
```ts
(WorkspaceMember & { id: string; email?: string; full_name?: string; avatar_url?: string })[]
```
but every receiving component expects `Profile[]`:
```ts
{ id: string; email: string | null; full_name: string | null; avatar_url: string | null }[]
```
The differences are real: AppContext's optional `?:` properties produce `string | undefined`, but `Profile` uses `string | null`. TypeScript distinguishes the two.

`DetailSlideOver.tsx:417` already has a workaround — it builds a `memberProfiles` array by mapping AppContext members into the `Profile` shape:
```ts
const memberProfiles = useMemo(
  () => members.map(m => ({ id: m.user_id, email: m.email ?? '', full_name: m.full_name ?? '', avatar_url: m.avatar_url ?? null })),
  [members]
);
```

**Fix — pick one approach:**

**Option 1 (recommended): Fix at the AppContext source.** Map `members` into `Profile[]` inside the provider so every consumer gets the same shape. Single change kills 7 errors + removes the duplicated `memberProfiles` mapping in DetailSlideOver.

In `src/contexts/AppContext.tsx`:
```ts
// Existing:
members: (WorkspaceMember & { id: string; email?: string; full_name?: string; avatar_url?: string })[];

// Change to two fields — keep the raw join for any code that needs role/workspace_id,
// and expose a clean Profile[] for UI components:
members: WorkspaceMember[];       // raw row, with role and workspace_id
memberProfiles: Profile[];        // shaped for FilterBar, BoardCard, etc.
```
Then map once in the provider after fetching. Update consumers: anything passing `members` to a `Profile[]`-typed prop switches to `memberProfiles`. Anything needing role/workspace info keeps `members`.

**Option 2 (faster, uglier): Cast at each call site.** `members={members as unknown as Profile[]}` at the 7 lines above. Works but propagates the lie.

**Estimate:** Option 1 = 25 min (one provider edit + ~10 consumer renames). Option 2 = 5 min. Recommend Option 1.

---

## Cluster B — `<Mic title="...">` not a valid lucide prop (5 errors)

**Files / lines:**
- `src/pages/BoardPage.tsx:147`
- `src/pages/CalendarPage.tsx:883`
- `src/pages/ListPage.tsx:523`
- `src/pages/MyWorkPage.tsx:405`
- `src/pages/ProjectDetailPage.tsx:1242`

**Root cause:** lucide-react icons don't accept a `title` HTML attribute. The intent — a hover tooltip showing "Has meeting notes" — is silently dropped today.

**Current pattern (all 5 sites):**
```tsx
<Mic className="w-3 h-3 ..." style={{ color: GRANOLA_TEXT }} title="Has meeting notes" />
```

**Fix:** wrap the icon in a span that carries the title. CalendarPage already uses this pattern in its WeekView for the same use case — copy it:
```tsx
<span title="Has meeting notes">
  <Mic className="w-3 h-3 ..." style={{ color: GRANOLA_TEXT }} />
</span>
```

**Estimate:** 10 min — five mechanical edits.

---

## Cluster C — ActivityLogRow lucide shim mismatch (7 errors)

**File / lines:** `src/components/activity/ActivityLogRow.tsx:43–52` — all 7 entries of the `ICON_STYLES` map.

**Root cause:** The `IconStyle` interface declares the `Icon` field as:
```ts
Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
```
But lucide-react icons are typed as `LucideIcon` (a `ForwardRefExoticComponent<LucideProps>`), which includes `size?: string | number` — a wider type. TypeScript rejects the narrower shim.

**Fix:** import lucide's canonical type and use it. In `ActivityLogRow.tsx`:
```ts
// Add at top:
import type { LucideIcon } from 'lucide-react';

// Change line 39:
type IconStyle = {
  background: string;
  color: string;
  Icon: LucideIcon;   // was: React.ComponentType<{ size?, color?, strokeWidth? }>
};
```
All 7 errors disappear in one swap. The shim was a defensive narrowing that no longer matches lucide's actual exported type.

**Estimate:** 3 min.

---

## Cluster D — Nine one-offs

### D.1 — `BulkActionToolbar.tsx:345` · ref-type mismatch
**Code:**
```ts
ref={btnRef}
```
where `btnRef` is `RefObject<HTMLButtonElement | null>` but `<button>` expects `LegacyRef<HTMLButtonElement>`.

**Fix:** the `btnRef` declaration above probably uses `useRef<HTMLButtonElement | null>(null)`. Drop the explicit null union — React's `useRef<HTMLButtonElement>(null)` returns `RefObject<HTMLButtonElement>` which is assignable.
```ts
// Was: const btnRef = useRef<HTMLButtonElement | null>(null);
const btnRef = useRef<HTMLButtonElement>(null);
```

**Estimate:** 2 min.

### D.2 — `ContentLibrary.tsx:146` · Supabase shape vs `LibraryItem`
**Code:**
```ts
setItems(libraryRes.data ?? []);
```
Supabase's inferred row type for `project_library` doesn't extend `LibraryItem` (the local interface includes computed/derived fields).

**Fix:** map explicitly into `LibraryItem[]`. The file already has a similar `.map((row): TaskAsset => {...})` pattern on line 153 — mirror it for the library rows:
```ts
const rows = (libraryRes.data ?? []).map((row): LibraryItem => ({
  /* shape it explicitly */
  ...row,
  // any computed fields here
}));
setItems(rows);
```

**Estimate:** 8 min (need to read `LibraryItem` interface to know required fields).

### D.3 — `BoardColumnsTab.tsx:273` · color literal-union narrowing
**Code:**
```ts
setFormData({ name: column.name, color: column.color ?? COLOR_PALETTE[0], position: column.position });
```
`column.color` is `string | null` from the DB, but `formData.color` is typed as the literal union of `COLOR_PALETTE` values.

**Fix:** cast — the DB stores a string from the palette, but TS can't prove it. Use:
```ts
color: (column.color ?? COLOR_PALETTE[0]) as typeof COLOR_PALETTE[number],
```

**Estimate:** 2 min.

### D.4 — `CustomFieldsTab.tsx:539` · `Json[]` → `SelectOption[]` cast
**Code:**
```ts
if (Array.isArray(raw)) return raw as SelectOption[];
```
TS rejects a direct cast between non-overlapping types.

**Fix:** route through `unknown` per the error hint:
```ts
if (Array.isArray(raw)) return raw as unknown as SelectOption[];
```
Or — better — actually validate the shape with a type guard. For v1, the unknown cast is fine since the data is hand-curated.

**Estimate:** 2 min.

### D.5 — `IntakeFormBuilder.tsx:142` · insert overload mismatch
**Code:**
```ts
const { data, error } = await supabase.from('intake_form_fields').insert(insertData).select().single();
```
`insertData` shape doesn't match the regenerated `intake_form_fields` Insert type (likely a `null` vs `undefined` or missing required field after schema changes).

**Fix:** Read `insertData`'s declaration above line 142 and compare to the Insert type. Probably needs an explicit cast or a missing field. **Open this one in editor first** — without seeing `insertData` I can't write the exact fix.

**Estimate:** 10 min (read + fix).

### D.6 — `SubtaskTemplatesTab.tsx:74` · settings Json type
**Code:**
```ts
.update({ settings: { ...currentSettings, subtask_templates: updated } })
```
`settings` column is `Json | undefined`; spreading a typed object into it produces a structural mismatch.

**Fix:** cast the update payload:
```ts
.update({
  settings: { ...currentSettings, subtask_templates: updated } as unknown as Json,
})
```

**Estimate:** 2 min.

### D.7 — `useGranolaNotes.ts:19` · `string | null` to `.eq()`
**Code:**
```ts
.eq('content_items.workspace_id', workspaceId);
```
`workspaceId` is `string | null` from the hook param.

**Fix:** add a guard above the query:
```ts
if (!workspaceId) return;
```
There's likely already an outer check; if so, narrow it explicitly via early return so TS knows `workspaceId` is non-null below.

**Estimate:** 3 min.

### D.8 — `useTriageItems.ts:88` · same pattern
**Code:**
```ts
next.set(link.content_item_id, link.channel_name);
```
`link.channel_name` is `string | null` going into `Map<string, string>`.

**Fix:** the outer `if (link?.channel_name)` already guards on truthy. TS still narrows poorly inside a `.then()` callback. Hoist to a local:
```ts
.then(({ data: link }) => {
  const name = link?.channel_name;
  if (!name) return;
  setChannelMap((prev) => {
    const next = new Map(prev);
    next.set(link!.content_item_id, name);
    return next;
  });
});
```

**Estimate:** 3 min.

### D.9 — `ListPage.tsx:775` · `null` as index type
**Code:**
```ts
const currentPriority = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
```
`priority` is the row's `priority` field which is `'low' | 'medium' | 'high' | 'urgent' | null`. Indexing into `PRIORITY_STYLES` with `null` fails strict mode.

**Fix:** narrow before indexing:
```ts
const currentPriority = PRIORITY_STYLES[priority ?? 'medium'] ?? PRIORITY_STYLES.medium;
```

**Estimate:** 2 min.

---

## Execution checklist

In commit order (smallest blast radius first):

- [ ] **D.3, D.4, D.6, D.7, D.8, D.9** — six surgical one-line fixes (~14 min)
- [ ] **D.1** — `BulkActionToolbar` ref cleanup (~2 min)
- [ ] **D.2** — `ContentLibrary` row mapping (~8 min)
- [ ] **D.5** — `IntakeFormBuilder` insert overload (~10 min)
- [ ] **Cluster C** — `LucideIcon` type swap in `ActivityLogRow` (~3 min)
- [ ] **Cluster B** — five `<Mic title>` → `<span title>` wrappers (~10 min)
- [ ] **Cluster A** — `AppContext` `memberProfiles` field + consumer migration (~25 min)
- [ ] Run `npm run typecheck` — confirm 0 errors
- [ ] Run `npm run build` — confirm clean
- [ ] Run `npm run lint` — confirm no regressions
- [ ] Commit · push

**Total:** ~75 minutes focused. Reasonable single-session work.

## After

Once the typecheck is clean, consider adding `npm run typecheck && npm run lint` as a `prepush` git hook so this drift can't accumulate silently again. Also worth aliasing `tsc` in the project so `npx tsc` reaches the right config — prevents the same masking that hid these errors for weeks.
