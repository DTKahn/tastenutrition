// Validates the parsers against the real M0 captures in ../../m0/.
// Those fixtures are gitignored (they contain PII), so this test runs only when
// they're present locally. Run: node shared/parse.test.js
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseStudents, parseCalendar, looksLoggedIn } from './parse.js';

const m0 = (name) =>
  fileURLToPath(new URL(`../m0/${name}.network-response`, import.meta.url));

function fixture(name) {
  const p = m0(name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

let passed = 0;
const check = (label, fn) => {
  fn();
  passed++;
  console.log(`  ok  ${label}`);
};

const profile = fixture('user_profile');
if (profile) {
  const students = parseStudents(profile);
  check('parseStudents finds Felix', () => {
    assert.equal(students.length >= 1, true);
    const felix = students.find((s) => s.id === '37708');
    assert.ok(felix, 'student 37708 present');
    assert.match(felix.name, /Felix/);
    assert.match(felix.school, /Action Day/);
  });
  check('looksLoggedIn true for dashboard', () =>
    assert.equal(looksLoggedIn(profile), true),
  );
}

const signin = fixture('user_sign_in');
if (signin) {
  check('looksLoggedIn false for sign-in page', () =>
    assert.equal(looksLoggedIn(signin), false),
  );
}

const menu = fixture('school_menu');
if (menu) {
  const cal = parseCalendar(menu);
  check('parseCalendar studentName = Felix', () =>
    assert.match(cal.studentName ?? '', /Felix/),
  );
  check('parseCalendar finds many days', () =>
    assert.equal(cal.days.length > 20, true),
  );
  check('June 16 (menu 85531) is ordered = Pesto (3893)', () => {
    const d = cal.days.find((x) => x.date === '2026-06-16');
    assert.ok(d, '6/16 present');
    assert.equal(d.menuId, '85531');
    assert.equal(d.status, 'ordered');
    assert.equal(d.orderedOptionId, '3893');
    assert.ok(
      d.options.some((o) => o.id === '3893' && /Pesto/.test(o.name)),
      '3893 is Pesto in the options',
    );
  });
  check('June 24 (menu 85537) is available, has options + tooltips', () => {
    const d = cal.days.find((x) => x.date === '2026-06-24');
    assert.ok(d, '6/24 present');
    assert.equal(d.menuId, '85537');
    assert.equal(d.status, 'available');
    assert.equal(d.orderedOptionId, null);
    assert.equal(d.options.length >= 6, true);
    const hotdog = d.options.find((o) => o.id === '2524');
    assert.match(hotdog.name, /Hot Dog/);
    assert.match(hotdog.description, /Niman Ranch/);
    const veggie = d.options.find((o) => /\(v\)/.test(o.name));
    assert.equal(veggie.vegetarian, true);
  });
  check('ordered days are internally consistent', () => {
    const orderedDays = cal.days.filter((d) => d.status === 'ordered');
    assert.equal(orderedDays.length, 8); // ordered days in this snapshot's window
    // every ordered day's chosen option must appear in that day's option list
    for (const d of orderedDays) {
      assert.ok(
        d.options.some((o) => o.id === d.orderedOptionId),
        `ordered option ${d.orderedOptionId} present on ${d.date}`,
      );
      assert.equal(d.hasChangeOrder, true);
    }
  });
}

if (passed === 0) {
  console.log('  (no fixtures found in ../m0 — skipped). Nothing validated.');
  process.exit(0);
}
console.log(`\n${passed} parser checks passed.`);
