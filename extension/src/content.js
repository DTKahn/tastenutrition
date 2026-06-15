// Content-script bootstrap: only on the menu page. Fetch the RAW menu HTML
// (matches what the parser was tested against — not the browser-serialized DOM),
// parse it, and mount the selection UI. Submission is wired in Task 5.
(async () => {
  if (!document.querySelector('form[name="frm"]')) return;
  const studentId = document.querySelector('input[name="student_id"]')?.value;
  if (!studentId) {
    console.warn('[taste+] no student_id on page; aborting');
    return;
  }

  const { parseCalendar } = await import(chrome.runtime.getURL('shared/parse.js'));
  const { mountUI } = await import(chrome.runtime.getURL('src/ui.js'));
  const { assembleOrderFields } = await import(chrome.runtime.getURL('shared/order.js'));
  const { applyAndCheckout } = await import(chrome.runtime.getURL('src/checkout.js'));

  const raw = await fetch('/school_menu.asp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ mode: '', studentid: '', student_id: studentId }).toString(),
    credentials: 'include',
  }).then((r) => r.text());

  const calendar = parseCalendar(raw);
  console.log(`[taste+] parsed ${calendar.days.length} days`);

  mountUI({
    calendar,
    onSubmit: (selections) => {
      const writes = assembleOrderFields(calendar, selections); // throws if any day is already ordered
      const n = selections.length;
      if (!confirm(`Continue to Taste's payment page for ${n} new lunch order${n === 1 ? '' : 's'}?`)) return;
      applyAndCheckout(writes);
    },
  });
})();
