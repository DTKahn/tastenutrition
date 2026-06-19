# UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the web viewer and Chrome extension with a shared component layer — week-grid + stacked-card layout, inline options with descriptions, read-only (web) vs. interactive (extension) rendering, full-bleed extension takeover — deferring only final color/typography polish.

**Architecture:** `shared/ui.js` exports pure HTML-string render functions and week-navigation utilities used by both surfaces. `shared/tokens.css` defines all CSS custom properties. The web app and extension import shared code; the extension injects the token CSS into its shadow root. Read-only vs. interactive is a flag passed to render functions — not a layout concern.

**Tech Stack:** Vanilla ES modules, plain `node` for tests (no bundler), Chrome MV3 extension, Cloudflare Worker (untouched). All test files run with `node path/to/file.test.js`.

---

## Design reference

Mockups are in `.superpowers/brainstorm/` (run `extension/sync-shared.sh` first, then open the brainstorming server if needed). Key decisions from the design spec at `docs/superpowers/specs/` and `~/.claude/plans/create-a-plan-for-woolly-duckling.md`:

- **Breakpoint:** 700px CSS width — below = stack layout, at or above = week grid (5 columns Mon–Fri)
- **Read-only vs. interactive** = determined by surface, never by viewport
- **Selected color** = green on both surfaces; indicator type (radio vs checkmark) signals surface
- **Description** always present — use `"No description"` if missing from API
- **Ordered days in extension** = faded radios (locked, no click handlers)
- **Closed-window days** (no order, `orderable: false`) = show column, all options faded
- **Empty weekdays** (no school) = show placeholder card "No school"
- **First load** = week containing today (if weekend, show next Mon's week)
- **Week nav** = always advance exactly 1 week; disable ‹ before first data week, › after last

## Do not touch

`shared/parse.js`, `shared/order.js`, `extension/src/checkout.js`, `worker/` — ordering mechanism is verified. This plan is front-end only.

## File map

| File | Action |
|---|---|
| `.gitignore` | Modify — add `.superpowers/` |
| `extension/sync-shared.sh` | Modify — add `tokens.css` and `ui.js` to copy |
| `shared/tokens.css` | **Create** — CSS custom properties (design tokens) |
| `shared/ui.js` | **Create** — render functions + week utilities |
| `shared/ui.test.js` | **Create** — node-runnable tests for shared/ui.js |
| `web/styles.css` | **Rewrite** — consume tokens; week-grid + stack layouts |
| `web/app.js` | **Rewrite** — week-nav state; adopt shared render functions |
| `extension/src/styles.css` | **Rewrite** — shadow-DOM scoped; full-bleed host |
| `extension/src/ui.js` | **Rewrite** — interactive week UI, footer bar, click handling |
| `extension/src/content.js` | **Modify** — full-bleed takeover, token CSS injection into shadow root |

---

## Task 1: Housekeeping

**Files:**
- Modify: `.gitignore`
- Modify: `extension/sync-shared.sh`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` and add at the end:

```
.superpowers/
```

- [ ] **Step 2: Update `sync-shared.sh` to copy `ui.js` and `tokens.css`**

Replace the `cp` line so it reads:

```bash
cp "$here/../shared/parse.js" "$here/../shared/order.js" \
   "$here/../shared/ui.js" "$here/../shared/tokens.css" \
   "$here/shared/"
```

Full file after change:

```bash
#!/usr/bin/env bash
# Copy shared modules into the extension package so Chrome can load them as
# web-accessible resources. Run after editing anything in shared/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/shared"
cp "$here/../shared/parse.js" "$here/../shared/order.js" \
   "$here/../shared/ui.js" "$here/../shared/tokens.css" \
   "$here/shared/"
echo "synced shared/ -> extension/shared/"
```

- [ ] **Step 3: Verify the script runs without error**

```bash
cd /path/to/repo/extension && bash sync-shared.sh
```

Expected: `synced shared/ -> extension/shared/` (may fail on missing files until Task 3 — that is fine; fix by creating empty placeholders if needed or run again after Task 3).

- [ ] **Step 4: Commit**

```bash
git add .gitignore extension/sync-shared.sh
git commit -m "chore: track .superpowers/, sync ui.js + tokens.css to extension"
```

---

## Task 2: Design tokens

**Files:**
- Create: `shared/tokens.css`

These are placeholder values for the layout pass. The color/typography pass will replace values only — no structural changes needed.

- [ ] **Step 1: Create `shared/tokens.css`**

```css
/* Taste+ design tokens — placeholder color pass (values will be refined later).
   All component CSS must reference these vars — no hardcoded colors. */
:root {
  /* selected / ordered state */
  --color-selected-bg:   #f0fdf4;
  --color-selected-text: #15803d;
  --color-selected-desc: #86efac;
  --color-selected-ind:  #22c55e;

  /* faded state (unselected siblings on ordered day, closed-window options) */
  --color-faded-opacity: 0.35;

  /* day-column border tints */
  --color-border-ordered: #bbf7d0;
  --color-border-closed:  #f1f5f9;

  /* page / surface */
  --color-page-bg:    #f1f5f9;
  --color-surface:    #ffffff;
  --color-border:     #e2e8f0;
  --color-item-border:#f1f5f9;

  /* text */
  --color-text-primary: #1e293b;
  --color-text-muted:   #94a3b8;
  --color-text-subtle:  #64748b;

  /* accent (footer button, active nav, links) */
  --color-accent: #3b82f6;

  /* VEG badge */
  --color-veg-text: #16a34a;
  --color-veg-bg:   #dcfce7;

  /* ordered badge */
  --color-badge-ordered-text: #15803d;
  --color-badge-ordered-bg:   #dcfce7;

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
git commit -m "feat: add design token layer (shared/tokens.css)"
```

---

## Task 3: Shared render functions + tests

**Files:**
- Create: `shared/ui.js`
- Create: `shared/ui.test.js`

Write the tests first, confirm they fail, then implement.

- [ ] **Step 1: Write `shared/ui.test.js`**

```js
// shared/ui.test.js — run with: node shared/ui.test.js
import { strict as assert } from 'node:assert';
import {
  renderOptionItem,
  renderDayCard,
  renderEmptyDayCard,
  getMondayOf,
  getWeekDates,
  formatWeekLabel,
} from './ui.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

// ── renderOptionItem ──────────────────────────────────────────────

test('read-only selected: checkmark in title, selected class, no radio', () => {
  const html = renderOptionItem(
    { id: '1', name: 'Pesto Pasta', description: 'Basil and pine nuts', vegetarian: true },
    { selected: true, readonly: true, orderable: false, isOrderedDay: true },
  );
  assert.ok(html.includes('class="opt-item selected"'), 'has selected class');
  assert.ok(html.includes('<span class="check">✓</span>'), 'has checkmark');
  assert.ok(!html.includes('<span class="radio'), 'no radio');
  assert.ok(html.includes('VEG'), 'has VEG badge');
  assert.ok(html.includes('Basil and pine nuts'), 'has description');
});

test('read-only unselected on ordered day: faded class, no indicator', () => {
  const html = renderOptionItem(
    { id: '2', name: 'Chicken Teriyaki', description: 'Grilled chicken', vegetarian: false },
    { selected: false, readonly: true, orderable: false, isOrderedDay: true },
  );
  assert.ok(html.includes('faded'), 'has faded class');
  assert.ok(!html.includes('<span class="check"'), 'no checkmark');
  assert.ok(!html.includes('<span class="radio"'), 'no radio');
});

test('read-only available (no order): no indicator, no faded', () => {
  const html = renderOptionItem(
    { id: '3', name: 'Turkey Sub', description: 'Sliced turkey', vegetarian: false },
    { selected: false, readonly: true, orderable: true, isOrderedDay: false },
  );
  assert.ok(!html.includes('faded'), 'not faded');
  assert.ok(!html.includes('<span class="check"'), 'no checkmark');
  assert.ok(!html.includes('<span class="radio"'), 'no radio');
  assert.ok(html.includes('Sliced turkey'), 'has description');
});

test('interactive selected: green radio, selected class, data attrs', () => {
  const html = renderOptionItem(
    { id: '1', name: 'Pesto Pasta', description: 'Basil', vegetarian: false },
    { selected: true, readonly: false, orderable: true, isOrderedDay: false },
  );
  assert.ok(html.includes('class="opt-item selected"'), 'selected class');
  assert.ok(html.includes('<span class="radio on">'), 'green radio');
  assert.ok(html.includes('data-option-id="1"'), 'has option id attr');
  assert.ok(html.includes('data-clickable="true"'), 'clickable true');
});

test('interactive unselected orderable: empty radio, clickable', () => {
  const html = renderOptionItem(
    { id: '2', name: 'Chicken', description: 'Grilled', vegetarian: false },
    { selected: false, readonly: false, orderable: true, isOrderedDay: false },
  );
  assert.ok(html.includes('<span class="radio">'), 'empty radio');
  assert.ok(html.includes('data-clickable="true"'), 'clickable');
  assert.ok(!html.includes('selected'), 'not selected');
});

test('interactive ordered day sibling: faded radio, not clickable', () => {
  const html = renderOptionItem(
    { id: '2', name: 'Chicken', description: 'Grilled', vegetarian: false },
    { selected: false, readonly: false, orderable: false, isOrderedDay: true },
  );
  assert.ok(html.includes('faded'), 'faded');
  assert.ok(html.includes('<span class="radio">'), 'has radio');
  assert.ok(html.includes('data-clickable="false"'), 'not clickable');
});

test('missing description falls back to "No description"', () => {
  const html = renderOptionItem(
    { id: '1', name: 'Pasta', description: '', vegetarian: false },
    { selected: false, readonly: true, orderable: true, isOrderedDay: false },
  );
  assert.ok(html.includes('No description'), 'fallback description');
});

test('HTML special chars in name are escaped', () => {
  const html = renderOptionItem(
    { id: '1', name: 'Mac & Cheese', description: 'Good <stuff>', vegetarian: false },
    { selected: false, readonly: true, orderable: true, isOrderedDay: false },
  );
  assert.ok(html.includes('Mac &amp; Cheese'), 'name escaped');
  assert.ok(html.includes('Good &lt;stuff&gt;'), 'desc escaped');
});

// ── renderDayCard ─────────────────────────────────────────────────

const ORDERED_DAY = {
  date: '2026-06-23',
  menuId: '8551',
  status: 'ordered',
  orderedOptionId: '101',
  orderable: false,
  hasChangeOrder: false,
  options: [
    { id: '101', name: 'Pesto Pasta', description: 'Basil', vegetarian: true },
    { id: '102', name: 'Chicken', description: 'Grilled', vegetarian: false },
  ],
};

const ORDERABLE_DAY = {
  date: '2026-06-24',
  menuId: '8552',
  status: 'available',
  orderedOptionId: null,
  orderable: true,
  hasChangeOrder: false,
  options: [
    { id: '201', name: 'Turkey Sub', description: 'Sliced turkey', vegetarian: false },
    { id: '202', name: 'Mac & Cheese', description: 'Cheddar', vegetarian: true },
  ],
};

const CLOSED_DAY = {
  date: '2026-06-18',
  menuId: '8550',
  status: 'available',
  orderedOptionId: null,
  orderable: false,
  hasChangeOrder: false,
  options: [
    { id: '301', name: 'Pasta', description: 'Tomato', vegetarian: true },
  ],
};

test('renderDayCard ordered day: ordered class, ordered-badge, checkmark on selected (readonly)', () => {
  const html = renderDayCard(ORDERED_DAY, { readonly: true, selectedOptionId: null });
  assert.ok(html.includes('class="day-col ordered"'), 'ordered class');
  assert.ok(html.includes('ordered-badge'), 'has badge');
  assert.ok(html.includes('data-menu-id="8551"'), 'has menu-id');
  // option 101 is ordered → should be selected with checkmark
  assert.ok(html.includes('<span class="check">✓</span>'), 'checkmark on ordered option');
});

test('renderDayCard orderable day: user selection shown (interactive)', () => {
  const html = renderDayCard(ORDERABLE_DAY, { readonly: false, selectedOptionId: '201' });
  assert.ok(!html.includes('ordered-badge'), 'no badge');
  // option 201 selected → green radio
  assert.ok(html.includes('<span class="radio on">'), 'selected radio');
  assert.ok(html.includes('data-clickable="true"'), 'options clickable');
});

test('renderDayCard closed-window day: closed class, faded options', () => {
  const html = renderDayCard(CLOSED_DAY, { readonly: false, selectedOptionId: null });
  assert.ok(html.includes('closed'), 'closed class');
  assert.ok(html.includes('past-badge'), 'has past badge');
  assert.ok(html.includes('data-clickable="false"'), 'options not clickable');
});

test('renderDayCard no selection on orderable day: all empty radios (interactive)', () => {
  const html = renderDayCard(ORDERABLE_DAY, { readonly: false, selectedOptionId: null });
  assert.ok(!html.includes('radio on'), 'no selected radio');
  assert.ok(html.includes('data-clickable="true"'), 'radios clickable');
});

// ── renderEmptyDayCard ────────────────────────────────────────────

test('renderEmptyDayCard: shows day name and "No school"', () => {
  const html = renderEmptyDayCard('2026-06-23');
  assert.ok(html.includes('No school'), 'no school text');
  assert.ok(html.includes('Tue') || html.includes('Mon') || html.includes('day-col'), 'has day col structure');
});

// ── week utilities ────────────────────────────────────────────────

test('getMondayOf: returns the Monday of a mid-week date', () => {
  const mon = getMondayOf(new Date('2026-06-24T00:00:00')); // Wednesday
  assert.equal(mon.toISOString().slice(0, 10), '2026-06-22');
});

test('getMondayOf: Monday input returns same date', () => {
  const mon = getMondayOf(new Date('2026-06-22T00:00:00'));
  assert.equal(mon.toISOString().slice(0, 10), '2026-06-22');
});

test('getMondayOf: Sunday returns previous Monday', () => {
  const mon = getMondayOf(new Date('2026-06-21T00:00:00')); // Sunday
  assert.equal(mon.toISOString().slice(0, 10), '2026-06-15');
});

test('getWeekDates: returns 5 dates Mon–Fri', () => {
  const dates = getWeekDates(new Date('2026-06-22T00:00:00')); // Monday
  assert.equal(dates.length, 5);
  assert.equal(dates[0], '2026-06-22');
  assert.equal(dates[4], '2026-06-26');
});

test('formatWeekLabel: formats as "Jun 22 – 26"', () => {
  const label = formatWeekLabel(new Date('2026-06-22T00:00:00'));
  assert.match(label, /Jun 22.+26/);
});

// ── summary ──────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
node shared/ui.test.js
```

Expected: error like `Cannot find module './ui.js'` or `SyntaxError` — confirms the tests are live.

- [ ] **Step 3: Create `shared/ui.js`**

```js
// shared/ui.js — shared render functions for Taste+.
// Returns HTML strings. Callers attach event listeners after DOM insertion.
// Imported by web/app.js and extension/src/ui.js (synced via sync-shared.sh).

/** HTML-escape a string. */
const ESC = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );

/**
 * Render a single option item as an HTML string.
 *
 * @param {{ id: string, name: string, description: string, vegetarian: boolean }} option
 * @param {{
 *   selected: boolean,     — this option is the chosen one
 *   readonly: boolean,     — web (checkmark / no radio) vs extension (radio)
 *   orderable: boolean,    — day ordering window is open
 *   isOrderedDay: boolean, — day already has a confirmed order
 * }} opts
 * @returns {string}
 */
export function renderOptionItem(option, { selected, readonly, orderable, isOrderedDay }) {
  const desc = option.description || 'No description';
  const veg = option.vegetarian
    ? ' <span class="veg">VEG</span>'
    : '';

  let indicator = '';
  let classes = 'opt-item';
  let dataAttrs = `data-option-id="${ESC(option.id)}"`;

  if (readonly) {
    if (selected) {
      classes += ' selected';
      indicator = '<span class="check">✓</span> ';
    } else if (isOrderedDay) {
      classes += ' faded';
    }
    // available (no order, window open): no indicator, full opacity — classes unchanged
  } else {
    // Interactive surface (extension)
    const clickable = orderable && !isOrderedDay;
    dataAttrs += ` data-clickable="${clickable ? 'true' : 'false'}"`;

    if (selected) {
      classes += ' selected';
      indicator = '<span class="radio on"></span> ';
    } else if (isOrderedDay) {
      classes += ' faded';
      indicator = '<span class="radio"></span> ';
    } else if (!orderable) {
      // closed window, not ordered
      classes += ' faded';
      indicator = '<span class="radio"></span> ';
    } else {
      indicator = '<span class="radio"></span> ';
    }
  }

  return `<div class="${classes}" ${dataAttrs}>` +
    `<div class="opt-title">${indicator}${ESC(option.name)}${veg}</div>` +
    `<div class="opt-desc">${ESC(desc)}</div>` +
    `</div>`;
}

/**
 * Render a full day card (header + options list) as an HTML string.
 *
 * @param {import('./parse.js').CalendarDay} day
 * @param {{
 *   readonly: boolean,
 *   selectedOptionId?: string|null,  — in-progress pick (extension only)
 * }} opts
 * @returns {string}
 */
export function renderDayCard(day, { readonly, selectedOptionId = null }) {
  const isOrderedDay = day.status === 'ordered';
  const isClosed = !day.orderable && !isOrderedDay;

  // Which option id is "selected" for rendering purposes
  const effectiveSelectedId = isOrderedDay ? day.orderedOptionId : selectedOptionId;

  // Day header
  const date = new Date(`${day.date}T00:00:00`);
  const dowShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();

  let headerExtra = '';
  if (isOrderedDay) {
    headerExtra = '<div class="ordered-badge">✓ Ordered</div>';
  } else if (isClosed) {
    headerExtra = '<div class="past-badge">Past</div>';
  }

  // Options
  const optionsHtml = day.options
    .map((opt) =>
      renderOptionItem(opt, {
        selected: opt.id === effectiveSelectedId,
        readonly,
        orderable: day.orderable,
        isOrderedDay,
      }),
    )
    .join('');

  const classes = [
    'day-col',
    isOrderedDay && 'ordered',
    isClosed && 'closed',
  ]
    .filter(Boolean)
    .join(' ');

  return `<div class="${classes}" data-menu-id="${ESC(day.menuId)}" data-date="${ESC(day.date)}">` +
    `<div class="day-header">` +
    `<div class="dow">${ESC(dowShort)}</div>` +
    `<div class="day-num">${dayNum}</div>` +
    headerExtra +
    `</div>` +
    `<div class="opts-list">${optionsHtml}</div>` +
    `</div>`;
}

/**
 * Render a placeholder card for a weekday with no school (no calendar entry).
 * @param {string} isoDate — e.g. "2026-06-22"
 * @returns {string}
 */
export function renderEmptyDayCard(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const dowShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();
  return `<div class="day-col empty">` +
    `<div class="day-header">` +
    `<div class="dow">${ESC(dowShort)}</div>` +
    `<div class="day-num">${dayNum}</div>` +
    `</div>` +
    `<div class="opts-list empty-day">No school</div>` +
    `</div>`;
}

/**
 * Return the Monday of the week containing `date`.
 * If `date` is a Sunday, returns the Monday of the PREVIOUS week.
 * @param {Date} date
 * @returns {Date}
 */
export function getMondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d;
}

/**
 * Return the 5 ISO date strings (Mon–Fri) for the week starting at `weekStart`.
 * @param {Date} weekStart — must be a Monday
 * @returns {string[]}
 */
export function getWeekDates(weekStart) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Format a week label like "Jun 22 – 26" or "Jun 29 – Jul 3".
 * @param {Date} weekStart — Monday
 * @returns {string}
 */
export function formatWeekLabel(weekStart) {
  const fri = new Date(weekStart);
  fri.setDate(fri.getDate() + 4);
  const opts = { month: 'short', day: 'numeric' };
  const startLabel = weekStart.toLocaleDateString('en-US', opts); // "Jun 22"
  const endLabel =
    weekStart.getMonth() === fri.getMonth()
      ? fri.getDate().toString() // same month → just the day number "26"
      : fri.toLocaleDateString('en-US', opts); // different month → "Jul 3"
  return `${startLabel} – ${endLabel}`;
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
node shared/ui.test.js
```

Expected output ends with `N passed, 0 failed`. Fix any failures before continuing.

- [ ] **Step 5: Commit**

```bash
git add shared/ui.js shared/ui.test.js
git commit -m "feat: add shared render functions and week utilities (shared/ui.js)"
```

---

## Task 4: Web styles

**Files:**
- Rewrite: `web/styles.css`

Replace the existing month-calendar styles with the week-grid / stack layout consuming design tokens.

- [ ] **Step 1: Rewrite `web/styles.css`**

```css
/* Must beat class rules so [hidden] always wins */
[hidden] { display: none !important; }

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Load tokens */
@import url('../shared/tokens.css');

html, body {
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--color-page-bg);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* ── Topbar ── */
.topbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 16px; height: 52px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.topbar-logo { font-weight: 800; font-size: 17px; }
.topbar-right { display: flex; align-items: center; gap: 8px; }

#studentSelect {
  font-size: 13px; background: var(--color-page-bg);
  border: 1px solid var(--color-border); border-radius: 8px; padding: 5px 10px; cursor: pointer;
}
#logoutBtn {
  font-size: 13px; color: var(--color-text-muted);
  background: none; border: 1px solid var(--color-border); border-radius: 8px;
  padding: 5px 12px; cursor: pointer;
}

/* ── Login view ── */
.login-wrap {
  display: flex; align-items: center; justify-content: center;
  min-height: calc(100vh - 52px); padding: 24px 16px;
}
.login-card {
  background: var(--color-surface); border-radius: var(--radius-card);
  box-shadow: 0 2px 12px rgba(0,0,0,.08); padding: 28px 24px;
  width: 100%; max-width: 400px;
}
.login-card h2 { font-size: 22px; margin-bottom: 12px; }
.login-card p  { color: var(--color-text-subtle); font-size: 14px; margin-bottom: 20px; }
.login-card label { display: block; font-size: 13px; color: var(--color-text-subtle); margin-bottom: 4px; }
.login-card input {
  display: block; width: 100%; padding: 10px 12px; font-size: 15px;
  border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 14px;
}
.login-card button {
  display: block; width: 100%; padding: 12px;
  background: var(--color-accent); color: white; font-size: 15px; font-weight: 600;
  border: none; border-radius: 8px; cursor: pointer;
}
.login-error { color: #dc2626; font-size: 13px; margin-top: 10px; }

/* ── Calendar view ── */
.calendar-wrap { padding: 16px; max-width: 1200px; margin: 0 auto; }

/* ── Week nav ── */
.week-nav {
  display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
}
.week-nav h2 { font-size: 16px; font-weight: 700; flex: 1; }
.week-nav button {
  background: none; border: 1px solid var(--color-border); border-radius: 7px;
  width: 32px; height: 32px; font-size: 16px; cursor: pointer; color: var(--color-text-subtle);
  display: flex; align-items: center; justify-content: center;
}
.week-nav button:disabled { opacity: .35; cursor: default; }
.week-summary { font-size: 12px; color: var(--color-text-muted); }

/* ── Week grid (≥700px) ── */
.week-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--gap-grid);
}

/* ── Stack (<700px) ── */
.week-stack {
  display: flex; flex-direction: column; gap: var(--gap-grid);
}

/* ── Day card ── */
.day-col {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.day-col.ordered { border-color: var(--color-border-ordered); }
.day-col.closed  { border-color: var(--color-border-closed); }
.day-col.empty   { border-color: var(--color-border); }

.day-header {
  padding: 9px 10px 7px;
  border-bottom: 1px solid var(--color-item-border);
}
.day-col.ordered .day-header { background: var(--color-selected-bg); }

.dow {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .05em; color: var(--color-text-muted);
}
.day-num { font-size: 15px; font-weight: 700; margin-top: 1px; }
.day-col.ordered .day-num { color: var(--color-selected-text); }

/* stack layout: header has row with date on left, badge on right */
.week-stack .day-header {
  display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;
}
.week-stack .day-header .dow { font-size: 11px; }
.week-stack .day-num { font-size: 15px; margin-top: 0; }

/* Badges */
.ordered-badge, .past-badge {
  display: inline-flex; align-items: center;
  font-size: 9px; font-weight: 700; padding: 2px 7px;
  border-radius: var(--radius-badge); text-transform: uppercase; letter-spacing: .04em;
  margin-top: 4px;
}
.ordered-badge { background: var(--color-badge-ordered-bg); color: var(--color-badge-ordered-text); }
.past-badge    { background: var(--color-page-bg); color: var(--color-text-muted); }
.week-stack .ordered-badge, .week-stack .past-badge { margin-top: 0; }

/* ── Options list ── */
.opts-list { }

.opt-item {
  padding: 8px 10px;
  border-top: 1px solid var(--color-item-border);
}
.opt-item:first-child { border-top: none; }

/* state variants */
.opt-item.selected  { background: var(--color-selected-bg); }
.opt-item.faded     { opacity: var(--color-faded-opacity); }

/* stack: slightly more padding */
.week-stack .opt-item { padding: 9px 12px; }

/* title line */
.opt-title {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--color-text-primary);
  line-height: 1.3;
}
.week-stack .opt-title { font-size: 13px; }
.opt-item.selected .opt-title { color: var(--color-selected-text); }

/* checkmark indicator (read-only) */
.check { font-size: 11px; font-weight: 700; color: var(--color-selected-ind); }

/* description */
.opt-desc {
  font-size: 10px; color: var(--color-text-muted);
  margin-top: 2px; line-height: 1.4;
}
.week-stack .opt-desc { font-size: 12px; }
.opt-item.selected .opt-desc { color: var(--color-selected-desc); }

/* VEG badge */
.veg {
  font-size: 9px; font-weight: 700;
  color: var(--color-veg-text); background: var(--color-veg-bg);
  padding: 1px 4px; border-radius: 3px;
  align-self: center;
}

/* empty day */
.empty-day {
  padding: 12px 10px;
  font-size: 11px; color: var(--color-text-muted); font-style: italic;
}

/* loading spinner */
#loading {
  position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
  background: var(--color-text-primary); color: white;
  font-size: 12px; padding: 6px 14px; border-radius: 20px; z-index: 20;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/styles.css
git commit -m "feat: rewrite web/styles.css with token vars, week-grid + stack layouts"
```

---

## Task 5: Web app logic

**Files:**
- Rewrite: `web/app.js`

Replace the month-calendar render with week-navigation state + shared render functions.

- [ ] **Step 1: Rewrite `web/app.js`**

```js
// web/app.js — Taste+ viewer (read-only). Talks to our Worker's JSON API.
// Renders a week-at-a-glance grid (Mon–Fri) or stacked cards below 700px.

import {
  renderDayCard,
  renderEmptyDayCard,
  getMondayOf,
  getWeekDates,
  formatWeekLabel,
} from '../shared/ui.js';

const API = window.TASTE_API_BASE;
const $ = (id) => document.getElementById(id);
const BREAKPOINT = 700; // px — below = stack, at or above = week grid

const state = {
  token:     localStorage.getItem('taste_token') || null,
  students:  [],
  studentId: null,
  calendar:  null, // { studentName, days: CalendarDay[] }
  weekStart: null, // Date (always a Monday)
};

// ── API ──────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (opts.body)   headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || 'Please sign in again.'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

const showLoading = (on) => $('loading').toggleAttribute('hidden', !on);

// ── Auth ─────────────────────────────────────────────────────────
async function onLogin(e) {
  e.preventDefault();
  const err = $('loginError');
  err.hidden = true;
  $('loginBtn').disabled = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email:    $('email').value.trim(),
        password: $('password').value,
      }),
    });
    state.token = data.token;
    localStorage.setItem('taste_token', data.token);
    $('password').value = '';
    setStudents(data.students || []);
    renderShell();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    $('loginBtn').disabled = false;
  }
}

function logout() {
  state.token = null;
  state.calendar = null;
  state.students = [];
  state.weekStart = null;
  localStorage.removeItem('taste_token');
  renderShell();
}

function setStudents(students) {
  state.students = students;
  state.studentId = students[0]?.id || null;
  const sel = $('studentSelect');
  sel.innerHTML = '';
  for (const s of students) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.school ? `${s.name} — ${s.school}` : s.name;
    sel.appendChild(o);
  }
}

// ── Data ─────────────────────────────────────────────────────────
async function loadCalendar() {
  if (!state.studentId) return;
  showLoading(true);
  try {
    state.calendar = await api(`/api/calendar?student=${encodeURIComponent(state.studentId)}`);
    state.weekStart = getMondayOf(new Date());
    renderWeek();
  } catch (ex) {
    $('calendarContainer').innerHTML = `<p style="padding:16px;color:#dc2626">${ex.message}</p>`;
  } finally {
    showLoading(false);
  }
}

// ── Rendering ────────────────────────────────────────────────────

/** Show/hide login vs calendar views. */
function renderShell() {
  const authed = !!state.token;
  $('loginView').toggleAttribute('hidden', authed);
  $('calendarView').toggleAttribute('hidden', !authed);
  $('topbarRight').toggleAttribute('hidden', !authed);
  if (authed && !state.calendar) loadCalendar();
}

/** Render the current week into #calendarContainer. */
function renderWeek() {
  const cal = state.calendar;
  const weekStart = state.weekStart;
  if (!cal || !weekStart) return;

  const weekDates = getWeekDates(weekStart);
  const dayMap = new Map(cal.days.map((d) => [d.date, d]));

  // Week nav label and prev/next availability
  const label = formatWeekLabel(weekStart);
  const allDates = cal.days.map((d) => d.date).sort();
  const firstWeek = allDates.length ? getMondayOf(new Date(allDates[0] + 'T00:00:00')) : weekStart;
  const lastWeek  = allDates.length ? getMondayOf(new Date(allDates[allDates.length - 1] + 'T00:00:00')) : weekStart;
  const hasPrev = weekStart > firstWeek;
  const hasNext = weekStart < lastWeek;

  // Summary
  const ordered  = cal.days.filter((d) => d.status === 'ordered').length;
  const orderable = cal.days.filter((d) => d.orderable).length;
  const summaryHtml = `<span class="week-summary">${ordered} ordered · ${orderable} open</span>`;

  // Build day cards
  const useGrid = window.innerWidth >= BREAKPOINT;
  const containerClass = useGrid ? 'week-grid' : 'week-stack';
  const cardsHtml = weekDates
    .map((iso) => {
      const day = dayMap.get(iso);
      return day ? renderDayCard(day, { readonly: true }) : renderEmptyDayCard(iso);
    })
    .join('');

  $('calendarContainer').innerHTML =
    `<div class="week-nav">` +
    `<button id="prevWeek" ${hasPrev ? '' : 'disabled'}>‹</button>` +
    `<h2>${label}</h2>` +
    summaryHtml +
    `<button id="nextWeek" ${hasNext ? '' : 'disabled'}>›</button>` +
    `</div>` +
    `<div class="${containerClass}">${cardsHtml}</div>`;

  $('prevWeek').addEventListener('click', () => {
    state.weekStart = new Date(weekStart);
    state.weekStart.setDate(state.weekStart.getDate() - 7);
    renderWeek();
  });
  $('nextWeek').addEventListener('click', () => {
    state.weekStart = new Date(weekStart);
    state.weekStart.setDate(state.weekStart.getDate() + 7);
    renderWeek();
  });
}

// ── Wire up ──────────────────────────────────────────────────────
$('loginForm').addEventListener('submit', onLogin);
$('logoutBtn').addEventListener('click', logout);
$('studentSelect').addEventListener('change', (e) => {
  state.studentId = e.target.value;
  state.calendar = null;
  loadCalendar();
});

// Re-render on resize (layout switch)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderWeek, 150);
});

renderShell();
```

- [ ] **Step 2: Update `web/index.html` — update element ids to match new app.js**

The new `app.js` uses these element ids: `loading`, `loginError`, `loginBtn`, `email`, `password`, `studentSelect`, `logoutBtn`, `loginView`, `calendarView`, `topbarRight`, `calendarContainer`.

Open `web/index.html` and verify/update these ids. The key structural change: replace the `#calendar` + `#summary` divs with a single `#calendarContainer` div. Also change the topbar right section id to `topbarRight`. The import path for `app.js` must use `type="module"`. Example structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Lunch</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="topbar">
    <span class="topbar-logo">🍱 Lunch</span>
    <div id="topbarRight" class="topbar-right" hidden>
      <select id="studentSelect"></select>
      <button id="logoutBtn">Log out</button>
    </div>
  </header>

  <div id="loginView" class="login-wrap">
    <div class="login-card">
      <h2>Sign in</h2>
      <p>Uses your existing tastenutrition.com login. Your password is sent straight to Taste and never stored.</p>
      <form id="loginForm">
        <label for="email">Email</label>
        <input id="email" type="email" autocomplete="username" required>
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete="current-password" required>
        <button id="loginBtn" type="submit">Sign in</button>
      </form>
      <p id="loginError" class="login-error" hidden></p>
    </div>
  </div>

  <div id="calendarView" class="calendar-wrap" hidden>
    <div id="calendarContainer"></div>
  </div>

  <div id="loading" hidden>Loading…</div>

  <script type="module" src="app.js"></script>
  <script src="config.js"></script>
</body>
</html>
```

Note: `config.js` must load AFTER the module to avoid race conditions with `window.TASTE_API_BASE`. Move the config script tag after the module tag, OR set `window.TASTE_API_BASE` before the module imports it by putting `config.js` first and making `app.js` read it lazily. Simplest fix: keep `config.js` as a plain script that sets the global, and reference it in a regular `<script>` tag BEFORE the module. Update `app.js` to use `window.TASTE_API_BASE` (already does this).

Correct script order in `index.html`:
```html
  <script src="config.js"></script>
  <script type="module" src="app.js"></script>
```

- [ ] **Step 3: Manual smoke test**

Start a local server:
```bash
cd web && python3 -m http.server 5173
```

Open `http://localhost:5173` in a browser. Confirm:
- Login screen renders without console errors
- Topbar shows logo only (no student controls)
- CSS loads correctly (background is light grey, card is white)

(Full calendar test requires the worker — covered in verification Task 9.)

- [ ] **Step 4: Commit**

```bash
git add web/app.js web/index.html
git commit -m "feat: rewrite web app with week-nav state and shared render functions"
```

---

## Task 6: Extension styles

**Files:**
- Rewrite: `extension/src/styles.css`

Shadow-DOM scoped. Full-bleed host. Consumes token vars (injected into shadow root at runtime — not linked).

- [ ] **Step 1: Rewrite `extension/src/styles.css`**

```css
/* Extension shadow-DOM styles. Tokens are injected at runtime by content.js.
   All selectors are scoped to the shadow root automatically. */

/* Host container fills the full viewport */
:host {
  all: initial;
  display: block;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Outer wrapper: full height, flex column */
#ext-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-page-bg);
  overflow: hidden;
}

/* ── Topbar ── */
.topbar {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 0 16px; height: 52px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.topbar-logo { font-weight: 800; font-size: 17px; }
.topbar-right { display: flex; align-items: center; gap: 8px; font-size: 13px; }

/* ── Week nav ── */
.week-nav {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}
.week-nav h2 { font-size: 15px; font-weight: 700; flex: 1; }
.week-nav button {
  background: none; border: 1px solid var(--color-border); border-radius: 7px;
  width: 32px; height: 32px; font-size: 16px; cursor: pointer;
  color: var(--color-text-subtle);
  display: flex; align-items: center; justify-content: center;
}
.week-nav button:disabled { opacity: .35; cursor: default; }
.week-summary { font-size: 12px; color: var(--color-text-muted); }

/* ── Scrollable content area ── */
#days-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* ── Week grid (≥700px) ── */
.week-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--gap-grid);
}

/* ── Stack (<700px) ── */
.week-stack {
  display: flex; flex-direction: column; gap: var(--gap-grid);
}

/* ── Day card ── */
.day-col {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.day-col.ordered { border-color: var(--color-border-ordered); }
.day-col.closed  { border-color: var(--color-border-closed); }
.day-col.empty   { border-color: var(--color-border); }

.day-header { padding: 9px 10px 7px; border-bottom: 1px solid var(--color-item-border); }
.day-col.ordered .day-header { background: var(--color-selected-bg); }
.week-stack .day-header {
  display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;
}

.dow { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); }
.day-num { font-size: 15px; font-weight: 700; margin-top: 1px; }
.day-col.ordered .day-num { color: var(--color-selected-text); }
.week-stack .day-num { margin-top: 0; }

.ordered-badge, .past-badge {
  display: inline-flex; align-items: center;
  font-size: 9px; font-weight: 700; padding: 2px 7px;
  border-radius: var(--radius-badge); text-transform: uppercase; letter-spacing: .04em;
  margin-top: 4px;
}
.ordered-badge { background: var(--color-badge-ordered-bg); color: var(--color-badge-ordered-text); }
.past-badge    { background: var(--color-page-bg); color: var(--color-text-muted); }
.week-stack .ordered-badge, .week-stack .past-badge { margin-top: 0; }

/* ── Options ── */
.opt-item {
  padding: 8px 10px;
  border-top: 1px solid var(--color-item-border);
  transition: background .1s;
}
.opt-item:first-child { border-top: none; }
.opt-item.selected  { background: var(--color-selected-bg); }
.opt-item.faded     { opacity: var(--color-faded-opacity); }
.opt-item[data-clickable="true"] { cursor: pointer; }
.opt-item[data-clickable="true"]:hover:not(.selected) { background: var(--color-page-bg); }
.week-stack .opt-item { padding: 9px 12px; }

.opt-title {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--color-text-primary); line-height: 1.3;
}
.week-stack .opt-title { font-size: 13px; }
.opt-item.selected .opt-title { color: var(--color-selected-text); }

/* radio indicator */
.radio {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--color-border);
  flex-shrink: 0; position: relative; top: 1px;
}
.radio.on {
  border-color: var(--color-selected-ind);
  background: var(--color-selected-ind);
}
.radio.on::after {
  content: ''; position: absolute;
  width: 5px; height: 5px; background: white;
  border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%);
}

/* checkmark (not used in extension, but included for completeness) */
.check { font-size: 11px; font-weight: 700; color: var(--color-selected-ind); }

.opt-desc {
  font-size: 10px; color: var(--color-text-muted);
  margin-top: 2px; line-height: 1.4;
}
.week-stack .opt-desc { font-size: 12px; }
.opt-item.selected .opt-desc { color: var(--color-selected-desc); }

.veg {
  font-size: 9px; font-weight: 700;
  color: var(--color-veg-text); background: var(--color-veg-bg);
  padding: 1px 4px; border-radius: 3px; align-self: center;
}

.empty-day {
  padding: 12px 10px;
  font-size: 11px; color: var(--color-text-muted); font-style: italic;
}

/* ── Footer bar ── */
#footer-bar {
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-text-primary);
  color: white;
}
#footer-info { font-size: 13px; }
#footer-info strong { font-size: 15px; }
#footer-info .fee-note { font-size: 11px; color: var(--color-selected-desc); margin-left: 4px; }
#continue-btn {
  background: var(--color-selected-ind); color: white;
  border: none; border-radius: 8px;
  padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
}
#continue-btn:disabled { background: #475569; cursor: not-allowed; }
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/styles.css
git commit -m "feat: rewrite extension styles for full-bleed shadow DOM layout"
```

---

## Task 7: Extension UI

**Files:**
- Rewrite: `extension/src/ui.js`

Interactive week view with selection state, footer bar, week navigation.

- [ ] **Step 1: Rewrite `extension/src/ui.js`**

```js
// extension/src/ui.js — interactive week UI for the Taste+ extension.
// Mounts a full-bleed shadow-DOM panel that replaces Taste's school_menu.asp page.

import {
  renderDayCard,
  renderEmptyDayCard,
  getMondayOf,
  getWeekDates,
  formatWeekLabel,
} from '../shared/ui.js';

const LUNCH = 8.0;
const FEE_RATE = 0.05;
const BREAKPOINT = 700; // px

/**
 * Mount the full-bleed interactive UI.
 * Called from content.js after parsing the calendar.
 *
 * @param {{
 *   calendar: import('../shared/parse.js').Calendar,
 *   onSubmit: (selections: {menuId:string, foodId:string}[]) => void,
 *   shadowRoot: ShadowRoot,
 * }} opts
 */
export function mountUI({ calendar, onSubmit, shadowRoot }) {
  const selections = new Map(); // menuId → optionId (in-progress picks)

  let weekStart = getMondayOf(new Date());

  // Build skeleton
  shadowRoot.innerHTML = `
    <div id="ext-root">
      <header class="topbar">
        <span class="topbar-logo">🍱 Lunch</span>
        <div class="topbar-right">${calendar.studentName ? `<span>${calendar.studentName}</span>` : ''}</div>
      </header>
      <div class="week-nav">
        <button id="prev-week">‹</button>
        <h2 id="week-label"></h2>
        <span id="week-summary" class="week-summary"></span>
        <button id="next-week">›</button>
      </div>
      <div id="days-container"></div>
      <footer id="footer-bar">
        <div id="footer-info"><span id="footer-count"></span></div>
        <button id="continue-btn" disabled>Continue to payment →</button>
      </footer>
    </div>`;

  // Wire week nav
  shadowRoot.getElementById('prev-week').addEventListener('click', () => {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() - 7);
    renderWeek();
  });
  shadowRoot.getElementById('next-week').addEventListener('click', () => {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    renderWeek();
  });

  // Wire submit
  shadowRoot.getElementById('continue-btn').addEventListener('click', () => {
    const list = [...selections.entries()].map(([menuId, foodId]) => ({ menuId, foodId }));
    onSubmit(list);
  });

  renderWeek();

  // Re-render on resize (layout switch)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderWeek, 150);
  });

  function renderWeek() {
    const dayMap = new Map(calendar.days.map((d) => [d.date, d]));
    const weekDates = getWeekDates(weekStart);

    // Week nav controls
    const allDates = calendar.days.map((d) => d.date).sort();
    const firstWeek = allDates.length
      ? getMondayOf(new Date(allDates[0] + 'T00:00:00'))
      : weekStart;
    const lastWeek = allDates.length
      ? getMondayOf(new Date(allDates[allDates.length - 1] + 'T00:00:00'))
      : weekStart;

    shadowRoot.getElementById('week-label').textContent = formatWeekLabel(weekStart);
    shadowRoot.getElementById('prev-week').disabled = !(weekStart > firstWeek);
    shadowRoot.getElementById('next-week').disabled = !(weekStart < lastWeek);

    // Summary
    const ordered   = calendar.days.filter((d) => d.status === 'ordered').length;
    const orderable = calendar.days.filter((d) => d.orderable).length;
    shadowRoot.getElementById('week-summary').textContent =
      `${ordered} ordered · ${orderable} open`;

    // Day cards
    const useGrid = window.innerWidth >= BREAKPOINT;
    const containerClass = useGrid ? 'week-grid' : 'week-stack';
    const cardsHtml = weekDates
      .map((iso) => {
        const day = dayMap.get(iso);
        return day
          ? renderDayCard(day, { readonly: false, selectedOptionId: selections.get(day.menuId) ?? null })
          : renderEmptyDayCard(iso);
      })
      .join('');

    const container = shadowRoot.getElementById('days-container');
    container.innerHTML = `<div class="${containerClass}">${cardsHtml}</div>`;

    // Attach click handlers to all clickable options
    container.querySelectorAll('.opt-item[data-clickable="true"]').forEach((el) => {
      el.addEventListener('click', () => {
        const menuId   = el.closest('.day-col').dataset.menuId;
        const optionId = el.dataset.optionId;
        if (selections.get(menuId) === optionId) {
          selections.delete(menuId); // tap again = deselect
        } else {
          selections.set(menuId, optionId);
        }
        // Re-render just this day card
        const dayCol = el.closest('.day-col');
        const day    = dayMap.get(dayCol.dataset.date);
        if (day) {
          const newCardHtml = renderDayCard(day, {
            readonly: false,
            selectedOptionId: selections.get(day.menuId) ?? null,
          });
          dayCol.outerHTML = newCardHtml;
          // Re-attach click handlers for the replaced card
          container
            .querySelectorAll(`.day-col[data-menu-id="${day.menuId}"] .opt-item[data-clickable="true"]`)
            .forEach((newEl) => attachClickHandler(newEl, dayMap));
        }
        updateFooter();
      });
    });

    updateFooter();
  }

  function attachClickHandler(el, dayMap) {
    el.addEventListener('click', () => {
      const menuId   = el.closest('.day-col').dataset.menuId;
      const optionId = el.dataset.optionId;
      if (selections.get(menuId) === optionId) {
        selections.delete(menuId);
      } else {
        selections.set(menuId, optionId);
      }
      const dayCol = el.closest('.day-col');
      const day    = dayMap.get(dayCol.dataset.date);
      if (day) {
        const newCardHtml = renderDayCard(day, {
          readonly: false,
          selectedOptionId: selections.get(day.menuId) ?? null,
        });
        const container = shadowRoot.getElementById('days-container');
        dayCol.outerHTML = newCardHtml;
        container
          .querySelectorAll(`.day-col[data-menu-id="${day.menuId}"] .opt-item[data-clickable="true"]`)
          .forEach((newEl) => attachClickHandler(newEl, dayMap));
      }
      updateFooter();
    });
  }

  function updateFooter() {
    const n     = selections.size;
    const total = n * LUNCH * (1 + FEE_RATE);
    const info  = shadowRoot.getElementById('footer-info');
    info.innerHTML = n
      ? `<strong>${n} selected · $${total.toFixed(2)}</strong><span class="fee-note">incl. ~5% fee</span>`
      : '<span style="color:#94a3b8">No days selected</span>';
    shadowRoot.getElementById('continue-btn').disabled = n === 0;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/src/ui.js
git commit -m "feat: rewrite extension UI with week nav, inline options, interactive selection"
```

---

## Task 8: Extension content script

**Files:**
- Modify: `extension/src/content.js`

Add full-bleed takeover, token CSS injection into shadow root, and update `mountUI` call signature.

- [ ] **Step 1: Rewrite `extension/src/content.js`**

```js
// Content-script bootstrap for school_menu.asp.
// 1. Fetches raw menu HTML and parses it.
// 2. Injects tokens CSS into a new shadow root.
// 3. Hides Taste's page content (full-bleed takeover).
// 4. Mounts the interactive week UI.
(async () => {
  if (!document.querySelector('form[name="frm"]')) return;
  const studentId = document.querySelector('input[name="student_id"]')?.value;
  if (!studentId) {
    console.warn('[taste+] no student_id on page; aborting');
    return;
  }

  const { parseCalendar }    = await import(chrome.runtime.getURL('shared/parse.js'));
  const { mountUI }          = await import(chrome.runtime.getURL('src/ui.js'));
  const { assembleOrderFields } = await import(chrome.runtime.getURL('shared/order.js'));
  const { applyAndCheckout }    = await import(chrome.runtime.getURL('src/checkout.js'));

  // Fetch fresh menu HTML from Taste (same as existing behaviour).
  const raw = await fetch('/school_menu.asp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ mode: '', studentid: '', student_id: studentId }).toString(),
    credentials: 'include',
  }).then((r) => r.text());

  const calendar = parseCalendar(raw);
  console.log(`[taste+] parsed ${calendar.days.length} days`);

  // ── Full-bleed takeover ──────────────────────────────────────────
  // Hide Taste's page content. We append a style tag to <head> so it can be
  // removed on cleanup. Taste's own form (needed by checkout.js) is untouched.
  const hideStyle = document.createElement('style');
  hideStyle.id = 'taste-plus-hide';
  hideStyle.textContent = 'body > *:not(#taste-plus-host) { display: none !important; }';
  document.head.appendChild(hideStyle);

  // ── Shadow host ────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'taste-plus-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // ── Inject design tokens into shadow root ──────────────────────
  // tokens.css is synced into extension/shared/ by sync-shared.sh.
  const tokensUrl = chrome.runtime.getURL('shared/tokens.css');
  const tokensCss = await fetch(tokensUrl).then((r) => r.text());
  const tokenStyle = document.createElement('style');
  tokenStyle.textContent = tokensCss;
  shadow.appendChild(tokenStyle);

  // ── Inject component styles ────────────────────────────────────
  const compCss = await fetch(chrome.runtime.getURL('src/styles.css')).then((r) => r.text());
  const compStyle = document.createElement('style');
  compStyle.textContent = compCss;
  shadow.appendChild(compStyle);

  // ── Mount UI ───────────────────────────────────────────────────
  mountUI({
    calendar,
    shadowRoot: shadow,
    onSubmit: (selections) => {
      const writes = assembleOrderFields(calendar, selections);
      const n = selections.length;
      if (!confirm(`Continue to Taste's payment page for ${n} new lunch order${n === 1 ? '' : 's'}?`)) return;
      applyAndCheckout(writes);
    },
  });
})();
```

- [ ] **Step 2: Update `extension/manifest.json` — ensure `tokens.css` and `ui.js` are web-accessible**

Open `extension/manifest.json` and find the `web_accessible_resources` section. Add `"shared/tokens.css"` and `"shared/ui.js"` if they are not already covered by a glob. Example:

```json
"web_accessible_resources": [
  {
    "resources": [
      "shared/parse.js",
      "shared/order.js",
      "shared/ui.js",
      "shared/tokens.css",
      "src/ui.js",
      "src/styles.css",
      "src/checkout.js"
    ],
    "matches": ["https://www.tastenutrition.com/*"]
  }
]
```

- [ ] **Step 3: Commit**

```bash
git add extension/src/content.js extension/manifest.json
git commit -m "feat: full-bleed takeover + token injection in extension content script"
```

---

## Task 9: Sync shared files and verify

- [ ] **Step 1: Run sync-shared.sh**

```bash
cd extension && bash sync-shared.sh
```

Expected:
```
synced shared/ -> extension/shared/
```

Confirm that `extension/shared/` now contains: `parse.js`, `order.js`, `ui.js`, `tokens.css`.

- [ ] **Step 2: Run shared tests**

```bash
node shared/ui.test.js
```

Expected: all tests pass, 0 failed.

Also run existing parser and order tests:
```bash
node shared/parse.test.js
node shared/order.test.js
```

Expected: all pass (no regressions).

- [ ] **Step 3: Verify web app — login screen**

```bash
cd web && python3 -m http.server 5173
```

Open `http://localhost:5173`. Confirm:
- No console errors
- Login card visible, styled correctly, no overflow at 375px

- [ ] **Step 4: Verify web app — calendar (requires worker)**

```bash
cd worker && npx wrangler dev --port 8787 --local
```

In a second terminal, ensure `web/config.js` points to `http://localhost:8787`. Open `http://localhost:5173`, sign in. Confirm:
- Week grid renders at desktop width (5 columns Mon–Fri)
- Stack layout renders when browser is narrowed below 700px
- Ordered days show `✓ Ordered` badge with green header, checkmark on ordered option, siblings faded
- Available days show all options with descriptions
- Closed-window days show faded options and `Past` badge
- ‹ › week navigation works, prev button disabled on earliest week
- Read-only: clicking options does nothing

- [ ] **Step 5: Verify extension — load and takeover**

Per `extension/README.md`: load the unpacked extension in Chrome (`chrome://extensions`, Developer mode, Load unpacked, point to `extension/`). Log in to tastenutrition.com in that Chrome profile, navigate to the school_menu.asp page.

Confirm:
- Taste's page content is hidden, our UI fills the full browser window
- Week grid or stack renders based on window width
- Ordered days show faded radios (locked, no click response)
- Orderable days show empty radios; clicking selects (green), clicking again deselects
- Footer bar shows correct count and total; disabled until a selection is made
- ‹ › week navigation works
- `Continue to payment →` triggers the confirmation dialog (existing `checkout.js` flow unchanged)

- [ ] **Step 6: Verify extension — payment handoff**

Select at least one orderable day in the extension. Click `Continue to payment →`. Confirm the dialog. Confirm Taste's checkout page loads and shows the correct order (existing M2 verification — do NOT complete the payment unless intentional).

- [ ] **Step 7: Final commit**

```bash
git add extension/shared/
git commit -m "chore: sync shared/ into extension after UI rebuild"
```

---

## What this plan does NOT cover

- **Color/typography polish** — all values in `tokens.css` are temporary placeholders; a follow-on pass replaces them
- **Change/cancel orders** — deferred (M2 scope: new orders only; `checkout.js` throws on already-ordered days)
- **Multi-tenant / other parents** — P2+ (M4)
- **Error states, retry logic, offline** — stub only; production hardening is M3
