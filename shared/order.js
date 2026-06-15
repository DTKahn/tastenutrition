// Pure logic: turn the user's NEW-order selections into the exact set of Taste
// `frm` form-field writes. M2 is new-orders-only by design — selecting a day
// that already has an order throws, and untouched days are never written, so
// existing orders are preserved by construction. See order.test.js.

/**
 * @typedef {import('./parse.js').Calendar} Calendar
 * @typedef {{ menuId: string, foodId: string }} Selection
 * @typedef {{ name: string, value: string }} FieldWrite
 */

/**
 * @param {Calendar} calendar
 * @param {Selection[]} selections
 * @returns {FieldWrite[]}
 */
export function assembleOrderFields(calendar, selections) {
  const byMenuId = new Map(calendar.days.map((d) => [d.menuId, d]));
  const writes = [];
  for (const sel of selections) {
    const day = byMenuId.get(sel.menuId);
    if (!day) throw new Error(`Unknown menuId ${sel.menuId}`);
    if (day.status === 'ordered') {
      throw new Error(
        `Day ${day.date} already ordered; changing an order is out of scope for M2`,
      );
    }
    if (!day.options.some((o) => o.id === sel.foodId)) {
      throw new Error(`Option ${sel.foodId} not offered on ${day.date}`);
    }
    writes.push({ name: `menu${sel.menuId}_days_choices`, value: sel.foodId });
  }
  return writes;
}
