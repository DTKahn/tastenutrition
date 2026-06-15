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
      // Task 5 replaces this with the real apply + handoff.
      console.log('[taste+] selections', selections);
    },
  });
})();
