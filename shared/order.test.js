// Validates assembleOrderFields against the real m0/school_menu capture.
// Fixture is gitignored (PII) — test skips cleanly if absent.
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCalendar } from './parse.js';
import { assembleOrderFields } from './order.js';

const fxPath = fileURLToPath(new URL('../m0/school_menu.network-response', import.meta.url));
if (!existsSync(fxPath)) {
  console.log('  (no m0/school_menu fixture — skipped). Nothing validated.');
  process.exit(0);
}
const cal = parseCalendar(readFileSync(fxPath, 'utf8'));

let passed = 0;
const check = (label, fn) => { fn(); passed++; console.log(`  ok  ${label}`); };

check('available day -> exactly one field write', () => {
  // 6/24 = menu 85537 (available); 2524 = Hot Dog (an option that day)
  const writes = assembleOrderFields(cal, [{ menuId: '85537', foodId: '2524' }]);
  assert.deepEqual(writes, [{ name: 'menu85537_days_choices', value: '2524' }]);
});

check('writes target only the requested day (no stray writes)', () => {
  const writes = assembleOrderFields(cal, [{ menuId: '85537', foodId: '2524' }]);
  const orderedMenuIds = cal.days.filter((d) => d.status === 'ordered').map((d) => d.menuId);
  assert.ok(orderedMenuIds.length >= 8, 'fixture has existing orders to protect');
  for (const mid of orderedMenuIds) {
    assert.ok(!writes.some((w) => w.name.includes(mid)), `no write touches ordered day ${mid}`);
  }
});

check('a batch mixing an ordered day with an available one is rejected (preserves existing)', () => {
  // The real preservation guard: if an already-ordered day slips into a batch,
  // the whole submit throws rather than risk re-charging it.
  assert.throws(
    () =>
      assembleOrderFields(cal, [
        { menuId: '85537', foodId: '2524' }, // available
        { menuId: '85531', foodId: '3893' }, // already ordered
      ]),
    /already ordered/,
  );
});

check('rejects ordering a day that already has an order', () => {
  // 85531 = 6/16, already ordered (Pesto 3893)
  assert.throws(
    () => assembleOrderFields(cal, [{ menuId: '85531', foodId: '3893' }]),
    /already ordered/,
  );
});

check('rejects an option not offered that day', () => {
  assert.throws(
    () => assembleOrderFields(cal, [{ menuId: '85537', foodId: '9999' }]),
    /not offered/,
  );
});

check('rejects an unknown menuId', () => {
  assert.throws(
    () => assembleOrderFields(cal, [{ menuId: '00000', foodId: '2524' }]),
    /Unknown menuId/,
  );
});

console.log(`\n${passed} order checks passed.`);
