// Content-script bootstrap for school_menu.asp.
// 1. Fetches raw menu HTML and parses it.
// 2. Creates shadow host + shadow root.
// 3. Injects tokens CSS + component styles into shadow root.
// 4. Hides Taste's page content (full-bleed takeover).
// 5. Mounts the interactive week UI.
(async () => {
  if (!document.querySelector('form[name="frm"]')) return;
  const studentId = document.querySelector('input[name="student_id"]')?.value;
  if (!studentId) {
    console.warn('[taste+] no student_id on page; aborting');
    return;
  }

  const { parseCalendar }       = await import(chrome.runtime.getURL('shared/parse.js'));
  const { mountUI }             = await import(chrome.runtime.getURL('src/ui.js'));
  const { assembleOrderFields } = await import(chrome.runtime.getURL('shared/order.js'));
  const { applyAndCheckout }    = await import(chrome.runtime.getURL('src/checkout.js'));

  // Fetch fresh menu HTML from Taste.
  const raw = await fetch('/school_menu.asp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ mode: '', studentid: '', student_id: studentId }).toString(),
    credentials: 'include',
  }).then((r) => r.text());

  const calendar = parseCalendar(raw);
  console.log(`[taste+] parsed ${calendar.days.length} days`);

  // ── Full-bleed takeover ──────────────────────────────────────────
  // Hide Taste's page content while keeping the form (needed by checkout.js).
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
  // `:root` in shadow DOM stylesheets refers to the light-DOM document root, not
  // the shadow tree — so custom properties defined on `:root` won't inherit to
  // shadow elements. Rewrite to `:host` so vars are defined on the shadow host.
  const tokensUrl = chrome.runtime.getURL('shared/tokens.css');
  const tokensCss = await fetch(tokensUrl).then((r) => r.text());
  const tokenStyle = document.createElement('style');
  tokenStyle.textContent = tokensCss.replace(':root', ':host');
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
