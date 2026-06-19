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
