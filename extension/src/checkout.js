// Apply new-order selections to Taste's real `frm` form and hand off to Taste's
// payment page. CRITICAL safety step (verified live): Taste's menu page can
// render with stale `_days_choices` values left in the server session from
// earlier activity — a leftover selection made checkout charge for an extra day.
// So we first CLEAR every `_days_choices` / `_days_choices_entrees` field, then
// set ONLY our selections — guaranteeing checkout charges for exactly the days
// the parent picked. We never touch `_days_choices_previous` (the existing
// orders), so those are preserved.

/**
 * @param {{ name: string, value: string }[]} fieldWrites
 */
export function applyAndCheckout(fieldWrites) {
  const frm = document.querySelector('form[name="frm"]');
  if (!frm) throw new Error('Taste order form not found');

  // 1. Neutralize any stale/pre-filled selections from the session.
  for (const el of frm.elements) {
    if (/_days_choices$/.test(el.name) || /_days_choices_entrees$/.test(el.name)) {
      el.value = '';
    }
  }

  // 2. Apply exactly our chosen days.
  for (const { name, value } of fieldWrites) {
    let input = frm.querySelector(`[name="${CSS.escape(name)}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      frm.appendChild(input);
    }
    input.value = value;
  }

  // 3. Hand off to Taste's real payment page as a top-level navigation (Taste's
  //    own flow opens an iframe modal; we go full-page). Action confirmed live.
  frm.removeAttribute('target');
  frm.setAttribute('action', '/school_menu_checkout.asp');
  frm.submit();
}
