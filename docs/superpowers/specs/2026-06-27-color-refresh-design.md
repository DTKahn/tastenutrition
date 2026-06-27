# Verdant Color Refresh — Design Spec

**Date:** 2026-06-27  
**Status:** Approved, ready for implementation

## Goal

Replace the current placeholder Tailwind color palette (cool slate + generic blue accent) with a cohesive warm-and-fresh theme called **Verdant**: deep forest topbar, pale green-cream page background, rich green accent, and a refined green selected/ordered state.

WCAG 2.0 requirement: must pass Level A; targeting Level AA (4.5:1 contrast for normal text, 3:1 for large/bold text and UI components).

## Design Direction

**Verdant** — high color presence, green-primary.

- Dark forest topbar (`#1e4a35`) gives strong brand identity
- Pale green-cream page background (`#f2f8f4`) warms the surfaces without adding noise
- Deep forest green accent (`#2a8050`) for CTAs — positive-reading, food/nature adjacent; white button text passes AA at ~4.9:1
- Ordered/selected state uses a brighter, more vivid green (distinct from the accent) so the two greens don't compete
- Warm green-tinted text instead of blue-shifted slate — everything reads as one coherent system

## Token Changes

All changes are in `shared/tokens.css`. No component logic changes — only values.

### New token: topbar background

```css
--color-topbar-bg: #1e4a35;
```

This separates topbar color from surface color, enabling the dark forest bar without changing card/surface whites.

### Full token map

| Token | Old value | New value | Notes |
|---|---|---|---|
| `--color-page-bg` | `#f1f5f9` | `#f2f8f4` | Pale warm green-cream |
| `--color-surface` | `#ffffff` | `#ffffff` | Unchanged |
| `--color-border` | `#e2e8f0` | `#c8ddd0` | Green-tinted |
| `--color-item-border` | `#f1f5f9` | `#daeae0` | Lighter green-tinted |
| `--color-text-primary` | `#1e293b` | `#2a4a32` | Dark forest; ~9.9:1 on white ✓ |
| `--color-text-subtle` | `#64748b` | `#4a6a54` | ~6.1:1 on white ✓ |
| `--color-text-muted` | `#94a3b8` | `#567858` | ~5.0:1 on white ✓ (was ~2.5:1 — fixed) |
| `--color-accent` | `#3b82f6` | `#2a8050` | Deep forest green; ~4.9:1 for white text ✓ |
| `--color-selected-bg` | `#f0fdf4` | `#e8f7ef` | Slightly warmer |
| `--color-selected-text` | `#15803d` | `#1e6b45` | ~5.9:1 on selected-bg ✓ |
| `--color-selected-desc` | `#86efac` | `#386a52` | Was nearly invisible (~1.5:1); now ~5.7:1 ✓ |
| `--color-selected-ind` | `#22c55e` | `#1e7848` | Checkmark glyph; ~5.0:1 on selected-bg ✓ |
| `--color-border-ordered` | `#bbf7d0` | `#a8d8b8` | Slightly deeper |
| `--color-border-closed` | `#f1f5f9` | `#e4eeea` | Warm green-neutral |
| `--color-veg-text` | `#16a34a` | `#1a6040` | Deeper for contrast |
| `--color-veg-bg` | `#dcfce7` | `#c8e8d4` | Warmer tint |
| `--color-badge-ordered-text` | `#15803d` | `#1e6b45` | Matches selected-text |
| `--color-badge-ordered-bg` | `#dcfce7` | `#c8e8d4` | Matches veg-bg |
| `--color-topbar-bg` | *(new)* | `#1e4a35` | Dark forest |

### WCAG notes

- **Fixed regressions from current palette:** `--color-text-muted` (`#94a3b8`) failed AA at ~2.5:1 on white; `--color-selected-desc` (`#86efac`) was ~1.5:1 on its bg. Both corrected.
- **Verify in implementation:** `--color-text-muted` on `--color-page-bg` (the green-tinted bg is slightly darker than white, making this easier — but confirm with a contrast checker).
- **CTA button text:** White on `--color-accent` (`#2a8050`) passes at ~4.9:1. Do not use white text on the brighter `#3daa70` indicator color — that only passes at ~2.9:1.
- **Topbar text:** White on `--color-topbar-bg` (`#1e4a35`) passes at ~10:1 ✓.

## Component Changes

### `shared/components.css`

One line change in the `.topbar` rule:

```css
/* before */
background: var(--color-surface);

/* after */
background: var(--color-topbar-bg);
```

Topbar text color in `web/styles.css` must be set to `color: white` explicitly since it currently inherits from `body` (dark text). Apply to `.topbar`, `.topbar-logo`, and `.topbar-right`.

### `web/styles.css`

- `#studentSelect` and `#logoutBtn` currently use `--color-page-bg` for background and `--color-border` for border — these will automatically update with the new token values, but visual check needed since they now sit on the dark topbar.
- These controls need `background: rgba(255,255,255,0.15)` or similar to be legible on the dark bar, plus `color: white; border-color: rgba(255,255,255,0.3)`.

### Extension

No extension-specific changes needed. `sync-shared.sh` propagates `tokens.css` and `components.css` into `extension/`. The shadow root already injects both files. The extension footer bar uses its own color (not the topbar token) — unaffected.

## Out of Scope

- Typography, spacing, radius tokens — unchanged
- Extension footer bar color — unchanged
- Login card layout — color tokens update automatically
- Any content or data changes

## Files Changed

1. `shared/tokens.css` — all token values + new `--color-topbar-bg`
2. `shared/components.css` — topbar background token reference
3. `web/styles.css` — topbar control colors for dark bar

## Testing

1. `python3 -m http.server 5173` from repo root → visual check at `http://localhost:5173/web/`
2. Chrome: verify login card, topbar, day cards (ordered + unordered), badges, VEG badge, week nav
3. Run `sync-shared.sh` → load unpacked extension → visual check on `school_menu.asp`
4. Spot-check contrast with browser DevTools accessibility panel or a contrast checker on: muted text on page bg, selected-desc on selected-bg, accent button text
