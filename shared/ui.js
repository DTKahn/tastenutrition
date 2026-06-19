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
 *   selected: boolean,
 *   readonly: boolean,
 *   orderable: boolean,
 *   isOrderedDay: boolean,
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
  } else {
    const clickable = orderable && !isOrderedDay;
    dataAttrs += ` data-clickable="${clickable ? 'true' : 'false'}"`;

    if (selected) {
      classes += ' selected';
      indicator = '<span class="radio on"></span> ';
    } else if (isOrderedDay) {
      classes += ' faded';
      indicator = '<span class="radio"></span> ';
    } else if (!orderable) {
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
 * @param {{ readonly: boolean, selectedOptionId?: string|null }} opts
 * @returns {string}
 */
export function renderDayCard(day, { readonly, selectedOptionId = null }) {
  const isOrderedDay = day.status === 'ordered';
  const isClosed = !day.orderable && !isOrderedDay;

  const effectiveSelectedId = isOrderedDay ? day.orderedOptionId : selectedOptionId;

  const date = new Date(`${day.date}T00:00:00`);
  const dowShort = date.toLocaleDateString('en-US', { weekday: 'short' });
  const dayNum = date.getDate();

  let headerExtra = '';
  if (isOrderedDay) {
    headerExtra = '<div class="ordered-badge">✓ Ordered</div>';
  } else if (isClosed) {
    headerExtra = '<div class="past-badge">Past</div>';
  }

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
 * Render a placeholder card for a weekday with no school.
 * @param {string} isoDate
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
 * Sunday → previous Monday.
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
  const startLabel = weekStart.toLocaleDateString('en-US', opts);
  const endLabel =
    weekStart.getMonth() === fri.getMonth()
      ? fri.getDate().toString()
      : fri.toLocaleDateString('en-US', opts);
  return `${startLabel} – ${endLabel}`;
}
