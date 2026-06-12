# Portable Design Tokens

A drop-in, runtime-themeable color system for a **React + Tailwind** app.
Extracted from ContentedCal (2026-06-12). Two files do the work:

| File | What it is |
|---|---|
| `tokens.css` | CSS variables — the single source of truth for every color (RGB-channel format). |
| `tailwind.tokens.js` | A Tailwind `colors` object that references those vars, so utility classes (`bg-brand-600/12`, `text-ink-muted`) resolve to them. |

The whole point: **change a color once (a CSS variable) and it updates
everywhere** — across Tailwind classes *and* inline styles — which is what
makes runtime white-labeling and dark mode possible. Tailwind classes alone
are compile-time; the variable layer is what you can override at runtime.

---

## Setup (3 steps)

**1. Copy both files** into the new app (e.g. `src/design-system/`).

**2. Import the CSS first**, before Tailwind, in your root stylesheet:

```css
/* src/index.css */
@import './design-system/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

**3. Merge the colors** into your Tailwind config and enable class dark mode:

```js
// tailwind.config.js
import { colors as dsColors } from './src/design-system/tailwind.tokens.js';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: { extend: { colors: dsColors } },
};
```

That's it. Restart the dev server so Tailwind picks up the new color names.

---

## Using the tokens

### In Tailwind classes (preferred)

```jsx
<div className="bg-surface-card border border-line/12 text-ink">
  <h2 className="text-ink">Heading</h2>
  <p className="text-ink-muted">Secondary copy</p>
  <span className="bg-brand-600/12 text-brand-600">Tag</span>
  <button className="bg-brand-600 text-ink-inverse hover:bg-brand-700">Save</button>
  <p className="text-state-error">Something went wrong</p>
</div>
```

**Opacity modifiers work natively** — `bg-brand-600/12` → `rgb(… / 0.12)`.
For an exact byte-level alpha, use an arbitrary value: `bg-brand-600/[0.071]`.

### In inline styles / gradients (when a class won't do)

Reference the variable directly with the `rgb(var(...))` form:

```jsx
<div style={{ color: 'rgb(var(--color-brand-600))' }} />
<div style={{ background:
  'linear-gradient(135deg, rgb(var(--color-brand-600) / 0.13) 0%, transparent 70%)' }} />
```

### Token reference

| Group | Tailwind class examples | Role |
|---|---|---|
| `brand-50…950` | `bg-brand-600`, `text-brand-900`, `bg-brand-600/12` | Primary brand ramp |
| `surface-page/card/nested` | `bg-surface-page`, `bg-surface-card` | App / card / inset backgrounds |
| `ink` / `ink-secondary/muted/subtle/inverse` | `text-ink`, `text-ink-muted` | Semantic text |
| `line` / `line-subtle/strong` | `border-line/12`, `border-line-subtle` | Borders, dividers |
| `state-success/error/warning/info` (+ `-tint`) | `text-state-error`, `bg-state-success-tint` | Status |
| `accent-*` | `text-accent-teal`, `bg-accent-berry/15` | Brand-adjacent accents |
| `slate-50…950` | `text-slate-500` | Neutral ramp (overrides Tailwind's slate, now var-driven) |

---

## White-labeling (per-tenant brand)

Override any variable on a wrapper element — everything beneath re-themes,
no rebuild:

```css
[data-theme="acme"] {
  --color-brand-600: 153 51 0;   /* acme orange */
  --color-brand-900: 61 20 0;
}
```

```jsx
<div data-theme={workspace.slug}>{/* app */}</div>
```

(For DB-driven themes, render a small `<style>` block with the workspace's
overrides on the app shell.)

## Dark mode

Fill in the `.dark` block in `tokens.css` (starter inversions are commented
there), then toggle `class="dark"` on `<html>`. Because components use
*semantic* tokens (`text-ink`, `bg-surface-page`), dark mode is a values-only
change — no component edits.

```js
document.documentElement.classList.toggle('dark', isDark);
```

---

## Adapting to a different brand

Everything except **BRAND** and **ACCENTS** in `tokens.css` is a universal
default (neutrals, text roles, borders, state) — keep it. Swap the
`--color-brand-*` ramp (and accents) for your brand's hues. To generate an
11-step ramp from one base color, any tint/shade tool works (e.g.
uicolors.app), then convert each hex to `R G B` channels.

> **Channel format gotcha:** values are space-separated RGB **without**
> `rgb()` — `0 93 151`, not `#005D97` or `rgb(0,93,151)`. That's required for
> the `rgb(var(--x) / <alpha-value>)` opacity trick to work.
