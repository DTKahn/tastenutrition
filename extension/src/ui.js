// Shadow-DOM selection UI. Reuses the visual language of web/app.js but is a
// self-contained list (one section per available day). No framework.
const LUNCH = 8.0;
const FEE_RATE = 0.05; // ~5% Taste fee observed at checkout (m0/FINDINGS.md)

function fmtDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * @param {{ calendar: import('../shared/parse.js').Calendar,
 *           onSubmit: (selections: {menuId:string,foodId:string}[]) => void }} opts
 */
export function mountUI({ calendar, onSubmit }) {
  const host = document.createElement('div');
  host.id = 'taste-plus-root';
  const shadow = host.attachShadow({ mode: 'open' });
  document.documentElement.appendChild(host);

  fetch(chrome.runtime.getURL('src/styles.css'))
    .then((r) => r.text())
    .then((css) => {
      const style = document.createElement('style');
      style.textContent = css;
      shadow.appendChild(style);
      render(shadow, calendar, onSubmit);
    });
}

function render(shadow, calendar, onSubmit) {
  const selections = new Map(); // menuId -> foodId

  // --- panel skeleton (all static, no data) ---
  const panel = document.createElement('div');
  panel.id = 'panel';

  const headerEl = document.createElement('header');
  headerEl.textContent = calendar.studentName
    ? `Order lunch — ${calendar.studentName}`
    : 'Order lunch';
  panel.appendChild(headerEl);

  const daysEl = document.createElement('div');
  daysEl.id = 'days';
  panel.appendChild(daysEl);

  const footerEl = document.createElement('footer');
  const totalEl = document.createElement('div');
  totalEl.id = 'total';
  const btn = document.createElement('button');
  btn.id = 'continue';
  btn.textContent = 'Continue to payment';
  btn.disabled = true;
  footerEl.appendChild(totalEl);
  footerEl.appendChild(btn);
  panel.appendChild(footerEl);

  shadow.appendChild(panel);

  // --- available days ---
  const available = calendar.days.filter((d) => d.orderable);
  if (!available.length) {
    const msg = document.createElement('p');
    msg.className = 'muted';
    msg.textContent = 'No open days to order right now.';
    daysEl.appendChild(msg);
  }

  for (const day of available) {
    const wrap = document.createElement('div');
    wrap.className = 'day';

    const h4 = document.createElement('h4');
    h4.textContent = fmtDate(day.date);
    wrap.appendChild(h4);

    for (const opt of day.options) {
      const inputId = `m${day.menuId}_${opt.id}`;

      const row = document.createElement('label');
      row.className = 'opt';
      row.htmlFor = inputId;

      const input = document.createElement('input');
      input.type = 'radio';
      input.id = inputId;
      input.name = `m${day.menuId}`;
      input.value = opt.id;
      input.addEventListener('change', (e) => {
        selections.set(day.menuId, e.target.value);
        updateTotal();
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = opt.name;

      row.appendChild(input);
      row.appendChild(nameSpan);

      if (opt.vegetarian) {
        const veg = document.createElement('span');
        veg.className = 'veg';
        veg.textContent = 'VEG';
        row.appendChild(veg);
      }

      wrap.appendChild(row);
    }
    daysEl.appendChild(wrap);
  }

  // --- total / submit ---
  function updateTotal() {
    const n = selections.size;
    const total = n * LUNCH * (1 + FEE_RATE);
    totalEl.textContent = n
      ? `${n} lunch${n === 1 ? '' : 'es'} — $${total.toFixed(2)} (incl. ~5% fee)`
      : '';
    btn.disabled = n === 0;
  }

  btn.addEventListener('click', () => {
    const list = [...selections.entries()].map(([menuId, foodId]) => ({ menuId, foodId }));
    onSubmit(list);
  });

  updateTotal();
}
