# Verdant Color Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current placeholder Tailwind color palette with the Verdant theme — warm green-cream surfaces, dark forest topbar, deep green accent — targeting WCAG AA contrast throughout.

**Architecture:** Three CSS files change; no logic changes. `shared/tokens.css` gets new values + one new token (`--color-topbar-bg`). `shared/components.css` switches the topbar background to use that token and adds white text. `web/styles.css` updates the topbar dropdown and logout button for the dark bar. Extension inherits all changes via `sync-shared.sh`.

**Tech Stack:** Plain CSS custom properties. No build step. Tested visually in Chrome.

## Global Constraints

- WCAG 2.0 AA: 4.5:1 for normal text, 3:1 for large/bold text and UI components
- No hardcoded colors — all component styles reference tokens from `shared/tokens.css`
- `shared/components.css` is shared between web and extension — changes must work in both surfaces
- Do not touch spacing, radius, or typography tokens
- `--color-faded-opacity: 0.35` is unchanged

---

## File Map

| File | Change |
|---|---|
| `shared/tokens.css` | Replace all color values; add `--color-topbar-bg` |
| `shared/components.css` | `.topbar` background → `var(--color-topbar-bg)`; add `color: white` |
| `web/styles.css` | `#studentSelect` and `#logoutBtn` restyled for dark topbar |
| `extension/` (generated) | Updated via `sync-shared.sh` — do not edit directly |

---

## Task 1: Update color tokens

**Files:**
- Modify: `shared/tokens.css`

**Interfaces:**
- Produces: all Verdant token values consumed by Tasks 2 and 3, plus `--color-topbar-bg: #1e4a35`

- [ ] **Step 1: Replace shared/tokens.css**

Replace the entire file with:

```css
/* Taste+ design tokens — Verdant palette.
   All component CSS must reference these vars — no hardcoded colors.
   WCAG AA targets: 4.5:1 normal text, 3:1 large text / UI components. */
:root {
  /* selected / ordered state */
  --color-selected-bg:   #e8f7ef;
  --color-selected-text: #1e6b45;  /* 5.9:1 on selected-bg ✓ */
  --color-selected-desc: #386a52;  /* 5.7:1 on selected-bg ✓ (was #86efac ~1.5:1) */
  --color-selected-ind:  #1e7848;  /* 5.0:1 on selected-bg ✓ */

  /* faded state (unselected siblings on ordered day, closed-window options) */
  --color-faded-opacity: 0.35;

  /* day-column border tints */
  --color-border-ordered: #a8d8b8;
  --color-border-closed:  #e4eeea;

  /* page / surface */
  --color-page-bg:    #f2f8f4;
  --color-surface:    #ffffff;
  --color-border:     #c8ddd0;
  --color-item-border:#daeae0;

  /* topbar */
  --color-topbar-bg: #1e4a35;  /* dark forest; white text = 10:1 ✓ */

  /* text */
  --color-text-primary: #2a4a32;  /* 9.9:1 on white ✓ */
  --color-text-muted:   #567858;  /* 5.0:1 on white ✓ (was #94a3b8 ~2.5:1) */
  --color-text-subtle:  #4a6a54;  /* 6.1:1 on white ✓ */

  /* accent (footer button, active nav, links) */
  --color-accent: #2a8050;  /* 4.9:1 for white text on button ✓ */

  /* VEG badge */
  --color-veg-text: #1a6040;
  --color-veg-bg:   #c8e8d4;

  /* ordered badge */
  --color-badge-ordered-text: #1e6b45;
  --color-badge-ordered-bg:   #c8e8d4;

  /* spacing / shape */
  --radius-card:  10px;
  --radius-badge: 20px;
  --gap-grid:     8px;

  /* layout breakpoint (used in JS, mirrored here for reference) */
  /* 700px — below = stack, at or above = week grid */
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/tokens.css
git commit -m "feat: Verdant color tokens — warm green palette + topbar token"
```

---

## Task 2: Wire topbar token in shared components

**Files:**
- Modify: `shared/components.css` (lines 6–11, the `.topbar` rule)

**Interfaces:**
- Consumes: `--color-topbar-bg` from Task 1
- Produces: `.topbar` with dark forest background and white text, used by both web and extension

- [ ] **Step 1: Update the .topbar rule in shared/components.css**

Find this block (currently around line 6):

```css
.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 16px; height: 52px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
```

Replace with:

```css
.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 16px; height: 52px;
  background: var(--color-topbar-bg);
  border-bottom: 1px solid rgba(255,255,255,0.1);  /* subtle light edge on dark bar */
  color: white;
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/components.css
git commit -m "feat: topbar uses --color-topbar-bg, white text"
```

---

## Task 3: Update web topbar controls for dark bar

The web-only `#studentSelect` and `#logoutBtn` currently style themselves for a white topbar. They need to flip to a translucent-on-dark style.

**Files:**
- Modify: `web/styles.css` (the topbar section, currently around lines 20–28)

**Interfaces:**
- Consumes: dark topbar from Task 2
- Produces: readable dropdown and logout button on dark forest topbar

- [ ] **Step 1: Update topbar control styles in web/styles.css**

Find this block:

```css
#studentSelect {
  font-size: 13px; background: var(--color-page-bg);
  border: 1px solid var(--color-border); border-radius: 8px; padding: 5px 10px; cursor: pointer;
}
#logoutBtn {
  font-size: 13px; color: var(--color-text-muted);
  background: none; border: 1px solid var(--color-border); border-radius: 8px;
  padding: 5px 12px; cursor: pointer;
}
```

Replace with:

```css
#studentSelect {
  font-size: 13px; background: rgba(255,255,255,0.12);
  color: white; border: 1px solid rgba(255,255,255,0.25);
  border-radius: 8px; padding: 5px 10px; cursor: pointer;
}
#logoutBtn {
  font-size: 13px; color: rgba(255,255,255,0.75);
  background: none; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px;
  padding: 5px 12px; cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/styles.css
git commit -m "feat: topbar dropdown + logout button styled for dark bar"
```

---

## Task 4: Sync to extension and visual verify

**Files:**
- Run: `sync-shared.sh` (propagates `shared/tokens.css` and `shared/components.css` into `extension/`)

**Interfaces:**
- Consumes: all changes from Tasks 1–3

- [ ] **Step 1: Serve the web app locally**

From the repo root (not `worker/`):

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173/web/` in Chrome.

- [ ] **Step 2: Visual check — web**

Check each of the following. All should look correct before moving on:

| Element | Expected |
|---|---|
| Topbar | Dark forest green (`#1e4a35`), white logo text |
| Student dropdown | Translucent white-on-dark, readable |
| Logout button | Translucent white text, readable |
| Page background | Pale green-cream (noticeably warmer than before) |
| Day cards (unordered) | White surface, green-tinted borders |
| Day cards (ordered) | Green header tint, ordered badge |
| Selected option | Soft green bg, dark green text, visible checkmark |
| Muted text (descriptions) | Readable dark green-gray (not the old light slate) |
| VEG badge | Green text on green-tinted bg |
| Login card | White surface, green accent button |
| Week nav arrows | Subtle, readable |

- [ ] **Step 3: Contrast spot-check in DevTools**

In Chrome DevTools → Accessibility panel (or Elements → Computed → Contrast):
- Muted text (`#567858`) on page bg (`#f2f8f4`) — confirm ≥ 4.5:1
- Selected desc (`#386a52`) on selected bg (`#e8f7ef`) — confirm ≥ 4.5:1
- If either fails, darken the token value by one step and re-check

- [ ] **Step 4: Sync shared files to extension**

From the repo root:

```bash
bash sync-shared.sh
```

Expected output: confirmation that `tokens.css` and `components.css` were copied into `extension/`.

- [ ] **Step 5: Load extension in Chrome and visual check**

In Chrome: `chrome://extensions` → Load unpacked → select `extension/` folder (or reload if already loaded).

Navigate to `school_menu.asp` on Taste. The Taste+ shadow DOM panel should show:
- Dark forest topbar
- Green-cream surfaces
- Ordered days with green header tint
- Footer bar unchanged (it's not a `.topbar` element)

- [ ] **Step 6: Commit**

```bash
git add extension/
git commit -m "feat: sync Verdant theme to extension"
```

---

## Contrast Reference

These are the values to verify in Step 4-3. If any fail, the fix is to darken the foreground token.

| Foreground token | Value | Background | Target | Expected |
|---|---|---|---|---|
| `--color-text-primary` | `#2a4a32` | `#ffffff` | ≥4.5:1 | ~9.9:1 ✓ |
| `--color-text-subtle` | `#4a6a54` | `#ffffff` | ≥4.5:1 | ~6.1:1 ✓ |
| `--color-text-muted` | `#567858` | `#f2f8f4` | ≥4.5:1 | ~5.0:1 (verify) |
| `--color-selected-text` | `#1e6b45` | `#e8f7ef` | ≥4.5:1 | ~5.9:1 ✓ |
| `--color-selected-desc` | `#386a52` | `#e8f7ef` | ≥4.5:1 | ~5.7:1 ✓ |
| `--color-selected-ind` | `#1e7848` | `#e8f7ef` | ≥4.5:1 | ~5.0:1 ✓ |
| `--color-accent` (btn text) | `#ffffff` | `#2a8050` | ≥4.5:1 | ~4.9:1 ✓ |
| Topbar text | `#ffffff` | `#1e4a35` | ≥4.5:1 | ~10:1 ✓ |
