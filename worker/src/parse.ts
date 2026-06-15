// HTML parsers for the legacy tastenutrition.com ASP pages.
//
// This is the "anti-corruption layer": all the ugly knowledge about Taste's
// markup lives here and nowhere else. If Taste changes its HTML, only this file
// (and its fixtures in test/) should need to change. Parsing strategy and field
// names are documented in ../../m0/FINDINGS.md.

export interface Student {
  id: string; // student_id, e.g. "37708"
  name: string; // e.g. "Felix Kahn"
  school: string; // e.g. "Action Day - Primary Plus Preschool - Room 1"
}

export interface MenuOption {
  id: string; // food id, e.g. "6891"
  name: string; // e.g. "Simple Quiche (v)"
  description: string; // from the hover tooltip
  vegetarian: boolean; // name contains "(v)"
}

export interface CalendarDay {
  date: string; // ISO "2026-06-24"
  menuId: string; // e.g. "85537"
  status: 'ordered' | 'available';
  orderedOptionId: string | null; // food id currently ordered, if any
  hasChangeOrder: boolean; // Taste showed a "Change Order" link (editable)
  options: MenuOption[];
}

export interface Calendar {
  studentName: string | null;
  days: CalendarDay[];
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** D-M-YYYY (e.g. "24-6-2026") -> ISO "2026-06-24". */
function toIso(dmy: string): string {
  const [d, m, y] = dmy.split('-');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Parse the dashboard (user_profile.asp) into the student list. */
export function parseStudents(html: string): Student[] {
  const students: Student[] = [];
  const seen = new Set<string>();
  // Each student row has a "Menu/Orders" button: onClick="school_menu(37708)".
  const re = /school_menu\((\d+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);

    // Name + school are the last two text segments before the button cluster.
    // Split on tag boundaries (turn tags into line breaks) so the two stay
    // separate — stripTags() alone would collapse them into one line.
    const before = html
      .slice(0, match.index)
      .replace(/<[^>]+>/g, '\n')
      .split('\n')
      .map((s) => stripTags(s))
      .filter((s) => /[A-Za-z]/.test(s)) // drops "", "-->", punctuation-only
      .filter(
        (s) =>
          !/Edit Student Profile|Menu\/Orders|Remove|Add Student|Refund Request|Student Information|Parent Information/i.test(
            s,
          ),
      );
    const name = before[before.length - 2] ?? `Student ${id}`;
    const school = before[before.length - 1] ?? '';
    students.push({ id, name, school });
  }
  return students;
}

/** Parse the menu page (school_menu.asp) into a calendar with current orders. */
export function parseCalendar(html: string): Calendar {
  // Current orders are embedded as hidden fields, one per ordered day:
  //   menu<menuId>_days_choices_previous = "<foodId>;"
  const ordered = new Map<string, string>();
  const ordRe = /name="menu(\d+)_days_choices_previous"\s+value="([^"]+)"/g;
  let o: RegExpExecArray | null;
  while ((o = ordRe.exec(html))) {
    const optId = o[2].replace(/;.*$/, '').trim();
    if (optId) ordered.set(o[1], optId);
  }

  // Heading is: <h3>Meals for <input ...name="student_id"> Felix </h3>
  const studentName =
    stripTags(
      /Meals for[\s\S]{0,200}?name="student_id">\s*([A-Za-z][^<\n]*)/i.exec(
        html,
      )?.[1] ?? '',
    ) || null;

  // Split into day cells. Available days are class="menucell"; days that already
  // have an order are class="menucell2". Split on the shared prefix.
  const days: CalendarDay[] = [];
  const cells = html.split(/class="menucell\d*"/i).slice(1);
  for (const cell of cells) {
    // Both cell types carry a menuprompt('D-M-YYYY') (wrapper or Change Order).
    const dateMatch = /menuprompt\('(\d{1,2}-\d{1,2}-\d{4})'\)/.exec(cell);
    if (!dateMatch) continue;
    const date = toIso(dateMatch[1]);

    // Each option is `<div id="menuId^optId" name=...>LABEL</div>` inside its own
    // `<td class="lucida10">`. LABEL is either plain text, a `<span>` with a
    // hover tooltip, or (when chosen) `<strong><font color=green>…[X]</font>`.
    // The tooltip attribute embeds '>' and '</div>', so:
    //   1) grab descriptions first, bounded by </td> (tooltips never contain it);
    //   2) strip on*="…" handlers, then read the visible label safely.
    const descById = new Map<string, string>();
    const descRe = /id="\d+\^(\d+)"([\s\S]*?)<\/td>/g;
    let q: RegExpExecArray | null;
    while ((q = descRe.exec(cell))) {
      const tip = /fixedtooltip\('([\s\S]*?)',\s*this/.exec(q[2]);
      if (tip) descById.set(q[1], stripTags(tip[1]));
    }

    const options: MenuOption[] = [];
    let menuId = '';
    const clean = cell.replace(/\son\w+="[^"]*"/g, '');
    const optRe = /id="(\d+)\^(\d+)"[^>]*>([\s\S]*?)<\/td>/g;
    let p: RegExpExecArray | null;
    while ((p = optRe.exec(clean))) {
      menuId = p[1];
      const optId = p[2];
      const name = stripTags(p[3]).replace(/\s*\[X\]\s*/i, '').trim();
      if (!name) continue;
      options.push({
        id: optId,
        name,
        description: descById.get(optId) ?? '',
        vegetarian: /\(v\)/i.test(name),
      });
    }
    if (!menuId) continue;

    const orderedOptionId = ordered.get(menuId) ?? null;
    days.push({
      date,
      menuId,
      status: orderedOptionId ? 'ordered' : 'available',
      orderedOptionId,
      hasChangeOrder: /Change Order/i.test(cell),
      options,
    });
  }

  days.sort((a, b) => a.date.localeCompare(b.date));
  return { studentName, days };
}

/** Heuristic login-success check: profile page shows the dashboard, not a login form. */
export function looksLoggedIn(html: string): boolean {
  return (
    /Account Dashboard|school_menu\(\d+\)|Menu\/Orders/i.test(html) &&
    !/name="password"/i.test(html)
  );
}
