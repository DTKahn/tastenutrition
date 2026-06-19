// extension/src/ui.js — interactive week UI for the Taste+ extension.
// Mounts a full-bleed shadow-DOM panel that replaces Taste's school_menu.asp page.

import {
  renderDayCard,
  renderEmptyDayCard,
  getMondayOf,
  getWeekDates,
  formatWeekLabel,
} from '../shared/ui.js';

const LUNCH = 8.0;
const FEE_RATE = 0.05;
const BREAKPOINT = 700; // px

/**
 * Mount the full-bleed interactive UI.
 * Called from content.js after parsing the calendar.
 *
 * @param {{
 *   calendar: import('../shared/parse.js').Calendar,
 *   onSubmit: (selections: {menuId:string, foodId:string}[]) => void,
 *   shadowRoot: ShadowRoot,
 * }} opts
 */
export function mountUI({ calendar, onSubmit, shadowRoot }) {
  const selections = new Map(); // menuId → optionId (in-progress picks)

  let weekStart = getMondayOf(new Date());

  // Build skeleton
  shadowRoot.innerHTML = `
    <div id="ext-root">
      <header class="topbar">
        <span class="topbar-logo">🍱 Lunch</span>
        <div class="topbar-right">${calendar.studentName ? `<span>${calendar.studentName}</span>` : ''}</div>
      </header>
      <div class="week-nav">
        <button id="prev-week">‹</button>
        <h2 id="week-label"></h2>
        <span id="week-summary" class="week-summary"></span>
        <button id="next-week">›</button>
      </div>
      <div id="days-container"></div>
      <footer id="footer-bar">
        <div id="footer-info"><span id="footer-count"></span></div>
        <button id="continue-btn" disabled>Continue to payment →</button>
      </footer>
    </div>`;

  // Wire week nav
  shadowRoot.getElementById('prev-week').addEventListener('click', () => {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() - 7);
    renderWeek();
  });
  shadowRoot.getElementById('next-week').addEventListener('click', () => {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    renderWeek();
  });

  // Wire submit
  shadowRoot.getElementById('continue-btn').addEventListener('click', () => {
    const list = [...selections.entries()].map(([menuId, foodId]) => ({ menuId, foodId }));
    onSubmit(list);
  });

  renderWeek();

  // Re-render on resize (layout switch)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderWeek, 150);
  });

  function renderWeek() {
    const dayMap = new Map(calendar.days.map((d) => [d.date, d]));
    const weekDates = getWeekDates(weekStart);

    // Week nav controls
    const allDates = calendar.days.map((d) => d.date).sort();
    const firstWeek = allDates.length
      ? getMondayOf(new Date(allDates[0] + 'T00:00:00'))
      : weekStart;
    const lastWeek = allDates.length
      ? getMondayOf(new Date(allDates[allDates.length - 1] + 'T00:00:00'))
      : weekStart;

    shadowRoot.getElementById('week-label').textContent = formatWeekLabel(weekStart);
    shadowRoot.getElementById('prev-week').disabled = !(weekStart > firstWeek);
    shadowRoot.getElementById('next-week').disabled = !(weekStart < lastWeek);

    // Summary
    const ordered   = calendar.days.filter((d) => d.status === 'ordered').length;
    const orderable = calendar.days.filter((d) => d.orderable).length;
    shadowRoot.getElementById('week-summary').textContent =
      `${ordered} ordered · ${orderable} open`;

    // Day cards
    const useGrid = window.innerWidth >= BREAKPOINT;
    const containerClass = useGrid ? 'week-grid' : 'week-stack';
    const cardsHtml = weekDates
      .map((iso) => {
        const day = dayMap.get(iso);
        return day
          ? renderDayCard(day, { readonly: false, selectedOptionId: selections.get(day.menuId) ?? null })
          : renderEmptyDayCard(iso);
      })
      .join('');

    const container = shadowRoot.getElementById('days-container');
    container.innerHTML = `<div class="${containerClass}">${cardsHtml}</div>`;

    // Attach click handlers to all clickable options
    container.querySelectorAll('.opt-item[data-clickable="true"]').forEach((el) => {
      el.addEventListener('click', () => handleOptionClick(el, dayMap));
    });

    updateFooter();
  }

  function handleOptionClick(el, dayMap) {
    const dayCol  = el.closest('.day-col');
    const menuId  = dayCol.dataset.menuId;
    const optionId = el.dataset.optionId;

    if (selections.get(menuId) === optionId) {
      selections.delete(menuId); // tap again = deselect
    } else {
      selections.set(menuId, optionId);
    }

    const day = dayMap.get(dayCol.dataset.date);
    if (day) {
      const newCardHtml = renderDayCard(day, {
        readonly: false,
        selectedOptionId: selections.get(day.menuId) ?? null,
      });
      const container = shadowRoot.getElementById('days-container');
      const temp = document.createElement('div');
      temp.innerHTML = newCardHtml;
      const newCard = temp.firstElementChild;
      dayCol.replaceWith(newCard);
      newCard.querySelectorAll('.opt-item[data-clickable="true"]').forEach((newEl) => {
        newEl.addEventListener('click', () => handleOptionClick(newEl, dayMap));
      });
    }

    updateFooter();
  }

  function updateFooter() {
    const n     = selections.size;
    const total = n * LUNCH * (1 + FEE_RATE);
    const info  = shadowRoot.getElementById('footer-info');
    info.innerHTML = n
      ? `<strong>${n} selected · $${total.toFixed(2)}</strong><span class="fee-note">incl. ~5% fee</span>`
      : '<span style="color:#94a3b8">No days selected</span>';
    shadowRoot.getElementById('continue-btn').disabled = n === 0;
  }
}
