# Code review fixes — 2026-06-04

Findings from the eval session review of June 3-4 commits (16 commits, 22 files). All four items are UI-layer changes for the build session. No backend changes needed.

---

## 1. CreateItemModal: add `applies_to` filter on custom fields

**Severity:** Should-fix (functional inconsistency)

**Problem:** DetailSlideOver filters custom fields with a two-layer check:
1. Content-type scope (`!f.content_type_id || f.content_type_id === item.content_type_id`)
2. Task-category scope (`f.applies_to === 'both' || f.applies_to === item.category`)

CreateItemModal only has layer 1. A design-only field (e.g. "Asset Dimensions" with `applies_to='design'`) shows in the content create form, then vanishes when the item opens in the detail panel.

**File:** `src/components/content/CreateItemModal.tsx`

**Fix:**

```typescript
// Current (line 279-283):
const activeCustomFields = useMemo(
  () => customFieldDefs
    .filter(f => !f.content_type_id || f.content_type_id === contentTypeId)
    .sort((a, b) => a.position - b.position),
  [customFieldDefs, contentTypeId]
);

// Fixed — add applies_to filter using taskCategory (already computed at line 379):
// Move taskCategory computation into a useMemo so it's available earlier:
const taskCategory: 'content' | 'design' =
  initialTags?.includes('design-request') ? 'design' : 'content';

const activeCustomFields = useMemo(
  () => customFieldDefs
    .filter(f => {
      const contentTypeMatch = !f.content_type_id || f.content_type_id === contentTypeId;
      if (!contentTypeMatch) return false;
      return f.applies_to === 'both' || f.applies_to === taskCategory;
    })
    .sort((a, b) => a.position - b.position),
  [customFieldDefs, contentTypeId, taskCategory]
);
```

Also pass `taskCategory` to the `<CustomFieldsSection>` so pill-row rendering picks up the right category color:

```tsx
<CustomFieldsSection
  fields={activeCustomFields}
  values={customFieldValues}
  onChange={updateCustomField}
  taskCategory={taskCategory}
/>
```

Remove the duplicate `taskCategory` declaration inside the `handleSubmit` function (line 379) since it's now computed at the component level.

**Scope:** ~15 lines in CreateItemModal.tsx. No other files.

---

## 2. CreateItemModal: align priority colors with canonical PRIORITY_STYLES

**Severity:** Should-fix (visual inconsistency)

**Problem:** The modal's local `priorityOptions` array (line 39-44) defines its own color hex values that don't match the canonical `PRIORITY_STYLES` in `utils.ts`. The dropdown dots show old Tailwind colors while every other surface uses the new board-palette colors.

| Level | CreateItemModal (old) | PRIORITY_STYLES (canonical) |
|-------|----------------------|----------------------------|
| urgent | `#ef4444` | `#BA2C2C` |
| high | `#f97316` | `#C4504A` |
| medium | `#fbbf24` | `#D98A6B` |
| low | `#9ca3af` | `#64748B` |

**File:** `src/components/content/CreateItemModal.tsx`

**Fix:**

```typescript
// Current (line 39-44):
const priorityOptions = [
  { value: 'low', label: 'Low', color: '#9ca3af' },
  { value: 'medium', label: 'Medium', color: '#fbbf24' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
];

// Fixed — derive from PRIORITY_STYLES:
import { PRIORITY_STYLES } from '../../lib/utils';

const priorityOptions = ['low', 'medium', 'high', 'urgent'].map(key => ({
  value: key,
  label: PRIORITY_STYLES[key].label,
  color: PRIORITY_STYLES[key].hex,
}));
```

**Scope:** ~5 lines in CreateItemModal.tsx. No other files.

---

## 3. Multi-select pills: enforce readable contrast on option colors

**Severity:** Should-fix (accessibility)

**Problem:** When a multi-select option has a `color`, the active pill uses it directly as text color over a 7%-opacity tinted background (`${color}12`). Light pastel option colors (e.g. `#FFCCCC`) produce near-invisible text. The codebase already has `pillTextColor()` in `utils.ts` that forces high saturation + low lightness — it just isn't wired up here.

**File:** `src/components/content/CustomFieldsSection.tsx`

**Fix:**

```typescript
// Add import at top:
import { pillTextColor } from '../../lib/utils';

// Current (line 195-199) — active pill with color:
? {
    backgroundColor: `${color}12`,
    color,
    borderColor: `${color}30`,
  }

// Fixed — run through pillTextColor for readable contrast:
? {
    backgroundColor: `${color}12`,
    color: pillTextColor(color),
    borderColor: `${color}30`,
  }
```

Apply the same fix to the inactive pill's border hint (line 202) if the raw color is too light for the border to be visible — though at 30% opacity this is less critical.

Also consider applying the same fix to the pill-row `single_select` renderer (line 154-167) if per-option colors are ever added there. Currently single_select pills use the task category color, so this doesn't apply yet.

**Scope:** ~3 lines in CustomFieldsSection.tsx. No other files.

---

## 4. HomePage: move `ProjectMiniStats` interface above first reference

**Severity:** Nitpick (code quality)

**Problem:** `projectHealthColor` on line 68 references `ProjectMiniStats`, but the interface isn't declared until line 147. TypeScript hoists it so the code compiles, but it reads poorly and will confuse future editors scanning top-to-bottom.

**File:** `src/pages/HomePage.tsx`

**Fix:** Move the `ProjectMiniStats` interface declaration (lines 147-151) to just above `projectHealthColor` (before line 68). No logic change.

**Scope:** Cut-paste 5 lines within the same file.

---

## Execution notes

- Items 1-3 can ship independently in any order. No dependencies between them, no backend changes.
- Item 1 is the highest priority — it's a functional inconsistency users will notice (fields appear then vanish).
- Item 2 is quick (5 lines) and eliminates a visual mismatch across surfaces.
- Item 3 is defensive — only matters when users create pastel-colored options. Quick fix.
- Item 4 is pure readability housekeeping.
