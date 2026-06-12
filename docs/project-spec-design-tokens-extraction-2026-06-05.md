# Project Spec — Design Token Extraction (CSS Variables + Tailwind)

**Date:** 2026-06-05
**Effort estimate:** L — ~4 hours, one sitting, one commit
**Hand-off:** Build Session
**Priority:** Medium — no current pain, but a hard prerequisite for dark mode and workspace-level white-labeling

---

## ⏳ STATUS (updated 2026-06-12)

**Phase 1 — Foundation: SHIPPED** (commit `efdbe69`).

Two deviations from the plan below, both intentional after a fresh audit:

1. **Naming — wired existing tokens instead of inventing new semantic names.** The audit found the codebase already standardized on the numeric Tailwind scale (`brand-600` = #005D97, `brand-900` = #002339, plus `surface-*` / `accent-*`) across *hundreds* of usages, and `colors.ts` `BRAND`/`SURFACE` were dead. So rather than introduce `brand-navy`/`brand-darker` (a second naming scheme), `tailwind.config.js` now resolves every existing token to `rgb(var(--color-X) / <alpha-value>)`. This made all those existing class usages white-label/dark-mode-ready with **zero call-site changes** — a bigger immediate win than the spec assumed. Added `accent-teal` (#2F8889) and `accent-berry` (#B8447A, post-dates this spec) as the two semantic colors that were inline-only.

2. **Scope is ~2× the spec.** Inline hexes in `components`/`pages` are now ~1,044 (not ~521) after the feature work since 2026-06-05. The inline-hex sweep (Steps 2–4 below) is therefore split into its own follow-up commit(s) rather than folded into the foundation commit.

**⚠️ Correction to the opacity mapping in Steps 2 & 5 below:** `#005D9712 → /12` is WRONG. The `12` is a hex alpha byte (0x12 = 18/255 ≈ **7%**), not 12%. The sweep must decode each 8-digit hex's alpha byte to its true decimal (e.g. `#005D9712` → `bg-brand-600/[0.07]`) to preserve exact rendering. Common bytes: `08`≈0.03, `10`≈0.06, `12`≈0.07, `18`≈0.09, `1F`≈0.12, `30`≈0.19.

**Remaining:** the ~450 inline brand-hex edits (Step 2), then surface/neutral (Step 3) and state/source (Step 4) sweeps.

---

## Problem

There are ~521 hardcoded hex color values inline across the ContentedCal codebase (e.g., `style={{ color: '#005D97' }}`, `className="bg-[#005D9712]"`). Some are already centralized (`BRAND` and `SURFACE` in `lib/colors.ts`, `PRIORITY_STYLES` in `lib/utils.ts`, `BOARD_COLUMN_PALETTE`, source colors in `ordinal.ts`) — but most aren't.

At current scale this isn't actively painful, but it blocks two roadmap items:

1. **Dark mode.** Every semantic color (text, surface, border, brand, state) needs to know its dark equivalent. Inline hexes mean a `dark:` variant per usage instead of one variable swap.
2. **Workspace-level white-labeling.** Brand colors (navy, accent crimson, banner gradients) need to be runtime-swappable per workspace. Tailwind classes are compile-time only — CSS variables are required for runtime overrides.

The fix is one focused refactor that lays the foundation for both futures. No user-visible change when done well.

---

## Current state

### What's already centralized

- **`src/lib/colors.ts`** — `BRAND` (navy, blue, teal, crimson), `SURFACE` (card, page), `BOARD_COLUMN_PALETTE` (10 colors)
- **`src/lib/utils.ts`** — `PRIORITY_STYLES` (urgent, high, medium, low with `.hex`, `.dot`, `.text`, `.pill`)
- **`src/lib/ordinal.ts`** — source colors (ORDINAL_COLOR, LINEAR_COLOR, GRANOLA_COLOR, SLACK_COLOR, INTERNAL_COLOR)

### What's still inline

~521 hex references scattered across components. Common offenders:

- `#005D97` (brand navy) — ~100+ usages, mostly as `text-[#005D97]`, `bg-[#005D9712]`, `border-[#00233930]`
- `#002339` (darker navy / border) — ~80+ usages
- `#F4F8FB`, `#F7F9FC` (surface page / card) — scattered
- `#BA2C2C` (crimson) — used everywhere for error/urgent/overdue states
- `#2F8889` (teal) — AI Assistant accent
- `#FBE7F1` (pink) — banner gradients
- Various opacity suffixes (`#005D9712`, `#005D9722`, `#00233918`, `#00233930`, etc.) — these are tricky to spot-replace because the hex+alpha pattern doesn't directly translate to CSS variables

---

## Proposed solution

### Technical approach: Tailwind theme + CSS variables in channel format

The modern Tailwind + design-token pattern. CSS variables hold RGB channel values (not hex), Tailwind config references them, opacity modifiers work natively.

**1. CSS variables** in a new `src/styles/tokens.css` (or appended to `src/index.css`):

```css
:root {
  /* Brand */
  --color-brand-navy: 0 93 151;
  --color-brand-darker: 0 35 57;
  --color-brand-blue: 46 139 192;
  --color-brand-teal: 47 136 137;
  --color-brand-crimson: 186 44 44;
  --color-brand-pink: 251 231 241;

  /* Surfaces */
  --color-surface-page: 244 248 251;
  --color-surface-card: 247 249 252;
  --color-surface-nested: 247 249 252;

  /* Text */
  --color-text-primary: 15 23 42;       /* slate-900 */
  --color-text-secondary: 51 65 85;     /* slate-700 */
  --color-text-muted: 100 116 139;      /* slate-500 */
  --color-text-subtle: 148 163 184;     /* slate-400 */

  /* Borders */
  --color-border-default: 0 35 57;      /* navy, typically used at low alpha */
  --color-border-subtle: 226 232 240;   /* slate-200 */

  /* State */
  --color-state-success: 53 114 84;
  --color-state-error: 186 44 44;
  --color-state-warning: 234 184 74;
  --color-state-info: 46 139 192;

  /* Sources (Ordinal / Linear / Granola / Slack / Internal) */
  --color-source-ordinal: 196 181 217;
  --color-source-linear: 91 79 138;
  --color-source-granola: 146 209 178;
  --color-source-slack: 109 64 109;
  --color-source-internal: 153 165 170;
}

/* Reserved for Phase 2 (dark mode). Empty for now — light values cascade. */
.dark {
  /* --color-surface-page: 15 20 25; etc. */
}
```

**2. Tailwind config** (`tailwind.config.js`) references the vars:

```js
theme: {
  extend: {
    colors: {
      brand: {
        navy: 'rgb(var(--color-brand-navy) / <alpha-value>)',
        darker: 'rgb(var(--color-brand-darker) / <alpha-value>)',
        teal: 'rgb(var(--color-brand-teal) / <alpha-value>)',
        crimson: 'rgb(var(--color-brand-crimson) / <alpha-value>)',
        pink: 'rgb(var(--color-brand-pink) / <alpha-value>)',
      },
      surface: {
        page: 'rgb(var(--color-surface-page) / <alpha-value>)',
        card: 'rgb(var(--color-surface-card) / <alpha-value>)',
        nested: 'rgb(var(--color-surface-nested) / <alpha-value>)',
      },
      // ... etc.
    },
  },
}
```

**3. Usage** — clean and compile-time-checkable:

```jsx
// Before
<div style={{ color: '#005D97' }} className="bg-[#005D9712] border-[#00233930]">

// After
<div className="text-brand-navy bg-brand-navy/12 border-brand-darker/30">
```

### Why this approach

- **Solid colors** are clean: `text-brand-navy`
- **Opacity variants** work natively: `text-brand-navy/12` compiles to `rgb(0 93 151 / 0.12)`
- **Runtime swappable** for white-label: `[data-workspace="acme"] { --color-brand-navy: 153 51 0; }`
- **Theme-flippable** for dark mode: `.dark { --color-surface-page: 15 20 25; }`
- **Discoverable** in IDEs: Tailwind autocomplete picks up the new token names
- **Doesn't replace what's already extracted** — `PRIORITY_STYLES`, `BOARD_COLUMN_PALETTE` etc. keep working; they're orthogonal concerns (per-task colors, not theme-level)

---

## Phasing (one sitting, one commit)

### Step 1 — Foundation (~45 min)

- Create `src/styles/tokens.css` with the full variable system
- Update `src/index.css` to import tokens
- Update `tailwind.config.js` to reference vars under `theme.extend.colors`
- Smoke test: render any page, verify nothing visually shifts (all vars hold current light-mode values)

### Step 2 — Brand sweep (~45 min)

Replace all references to:

- `#005D97`, `#002339`, `#2E8BC0`, `#2F8889`, `#BA2C2C`, `#FBE7F1`

Use a combination of grep + manual review. The tricky ones are opacity suffixes — `#005D9712` becomes `bg-brand-navy/12`, `#00233930` becomes `border-brand-darker/30`, etc.

White-label foundation done after this step.

### Step 3 — Surface + neutral sweep (~60 min)

Replace:

- `#F4F8FB`, `#F7F9FC` (surfaces)
- `#0F172A`, `#1E293B`, `#334155`, `#475569`, `#64748B`, `#94A3B8`, `#CBD5E1`, `#E2E8F0` (slate scale)

Tailwind already has these as `slate-*`, so most are likely using `text-slate-500` etc. The migration is to replace `text-slate-500` → `text-text-muted` (semantic) so that dark mode can later swap meaning, not just shade.

Dark mode foundation done after this step.

### Step 4 — State + source sweep (~60 min)

Replace state colors (`#357254` success, `#A05042` etc.), source colors (Ordinal purple, Linear, Granola green, Slack red, Internal gray).

### Step 5 — Verify (~30 min)

Click through every page. Things to watch:

- Opacity suffixes — did `#005D9712` correctly become `bg-brand-navy/12` (not `bg-brand-navy` solid)?
- Border colors — `border-[#00233930]` → `border-brand-darker/30`
- Inline gradients — `linear-gradient(135deg, #005D9718 0%, ...)` → `linear-gradient(135deg, rgb(var(--color-brand-navy) / 0.18) 0%, ...)`. These need manual review.
- Hover states — `hover:bg-[#005D9718]` → `hover:bg-brand-navy/18`
- Drag/drop, modals, tooltips, toasts — visit each surface

---

## Files to touch

| File | Change | Lines |
|---|---|---|
| `src/styles/tokens.css` | **NEW** — CSS variable definitions | ~60 |
| `src/index.css` | Import tokens; verify no conflicts | ~5 |
| `tailwind.config.js` | Add `theme.extend.colors` referencing vars | ~50 |
| All `src/components/**/*.tsx` and `src/pages/**/*.tsx` | Replace inline hexes with token classes | ~500+ small edits |
| `src/lib/colors.ts` | Keep BRAND/SURFACE as fallbacks for non-Tailwind contexts; update to reference vars | ~20 |
| `src/lib/utils.ts` | `PRIORITY_STYLES.hex` values stay as raw hex (used in dynamic style props); no change | 0 |

No database migration. No backend changes.

---

## Out of scope (this project)

- **Dark mode color values.** The `.dark` block is added but empty. Picking dark equivalents for each variable is a design decision (UX/UX-session work), not a refactor task. Comes in a follow-up project.
- **Workspace-level theme override mechanism.** The `data-workspace-theme` attribute + per-workspace variable overrides are easy to wire once tokens exist (~30 min in a follow-up). Out of scope here.
- **Board column palette extraction.** Already centralized in `BOARD_COLUMN_PALETTE`; per-column color is dynamic (chosen per column), not theme-level. Stays as-is.
- **`PRIORITY_STYLES.hex` etc.** Used in dynamic inline styles (`style={{ backgroundColor: PRIORITY_STYLES[p].hex }}`). Stays as raw hex strings; the dynamic context can't use Tailwind classes.
- **Email templates / external surfaces.** If any edge functions or transactional emails reference brand hexes, those stay inline (not affected by the CSS variable system).

---

## Risk + mitigations

| Risk | Mitigation |
|---|---|
| Opacity suffix mistakes (`#005D9712` → `bg-brand-navy` instead of `bg-brand-navy/12`) | Step 5 verification pass. Most-used opacity stops (`/10`, `/12`, `/18`, `/22`, `/30`, `/50`) double-checked manually. |
| Inline gradients with opacity hex aren't auto-replaceable | Grep all `linear-gradient` occurrences; convert manually using `rgb(var(...) / X)` syntax. |
| Dynamic style props (`style={{ color: someHex }}`) where the hex comes from data (e.g. board column color, content type color) | These stay as-is — they're data, not tokens. Token system is for theme-level colors. |
| Tailwind config typos break the build | Step 1 smoke test catches this before any inline replacement happens. |
| Hidden inline hexes inside generated TS files (e.g. `skill-content.ts`) | Skip auto-generated files. The token system is for source code only. |

---

## Acceptance criteria

- [ ] `src/styles/tokens.css` exists with the full variable system in channel format
- [ ] `tailwind.config.js` references the vars under `theme.extend.colors`
- [ ] `npx tsc --noEmit` passes (zero errors)
- [ ] `npx eslint src/` passes (no new errors introduced)
- [ ] Visual smoke test: every page renders identically to the pre-refactor state in light mode
- [ ] Grep audit: inline `#XXXXXX` references in `src/components/**` and `src/pages/**` are limited to (a) `PRIORITY_STYLES.hex` and similar dynamic data sources, (b) auto-generated files, (c) any documented exceptions
- [ ] `.dark` block exists in tokens.css (empty body OK) so future dark mode work has the structure ready
- [ ] No new schema, no edge function deploys, no migrations

---

## Follow-up projects this unlocks

1. **Dark mode — color value design pass.** UX session picks dark equivalents for each variable. Then a build session populates the `.dark` block + adds the theme toggle. ~3–5 hr total.
2. **Workspace-level white-labeling.** Add a `theme` JSONB column to `workspaces`, render `<style>` overrides on the workspace shell, expose a Settings → Branding tab. ~1–2 hr build + UX work for the picker UI.
