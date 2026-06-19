// web/app.js — Taste+ viewer (read-only). Talks to our Worker's JSON API.
// Renders a week-at-a-glance grid (Mon–Fri) or stacked cards below 700px.

import {
  renderDayCard,
  renderEmptyDayCard,
  getMondayOf,
  getWeekDates,
  formatWeekLabel,
} from '../shared/ui.js';

const API = window.TASTE_API_BASE;
const $ = (id) => document.getElementById(id);
const BREAKPOINT = 700; // px — below = stack, at or above = week grid

const state = {
  token:     localStorage.getItem('taste_token') || null,
  students:  [],
  studentId: null,
  calendar:  null, // { studentName, days: CalendarDay[] }
  weekStart: null, // Date (always a Monday)
};

// ── API ──────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (opts.body)   headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || 'Please sign in again.'); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

const showLoading = (on) => $('loading').toggleAttribute('hidden', !on);

// ── Auth ─────────────────────────────────────────────────────────
async function onLogin(e) {
  e.preventDefault();
  const err = $('loginError');
  err.hidden = true;
  $('loginBtn').disabled = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email:    $('email').value.trim(),
        password: $('password').value,
      }),
    });
    state.token = data.token;
    localStorage.setItem('taste_token', data.token);
    $('password').value = '';
    setStudents(data.students || []);
    renderShell();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    $('loginBtn').disabled = false;
  }
}

function logout() {
  state.token = null;
  state.calendar = null;
  state.students = [];
  state.weekStart = null;
  localStorage.removeItem('taste_token');
  renderShell();
}

function setStudents(students) {
  state.students = students;
  state.studentId = students[0]?.id || null;
  const sel = $('studentSelect');
  sel.innerHTML = '';
  for (const s of students) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.school ? `${s.name} — ${s.school}` : s.name;
    sel.appendChild(o);
  }
}

// ── Data ─────────────────────────────────────────────────────────
async function loadCalendar() {
  if (!state.studentId) return;
  showLoading(true);
  try {
    state.calendar = await api(`/api/calendar?student=${encodeURIComponent(state.studentId)}`);
    state.weekStart = getMondayOf(new Date());
    renderWeek();
  } catch (ex) {
    $('calendarContainer').innerHTML = `<p style="padding:16px;color:#dc2626">${ex.message}</p>`;
  } finally {
    showLoading(false);
  }
}

// ── Rendering ────────────────────────────────────────────────────

/** Show/hide login vs calendar views. */
function renderShell() {
  const authed = !!state.token;
  $('loginView').toggleAttribute('hidden', authed);
  $('calendarView').toggleAttribute('hidden', !authed);
  $('topbarRight').toggleAttribute('hidden', !authed);
  if (authed && !state.calendar) loadCalendar();
}

/** Render the current week into #calendarContainer. */
function renderWeek() {
  const cal = state.calendar;
  const weekStart = state.weekStart;
  if (!cal || !weekStart) return;

  const weekDates = getWeekDates(weekStart);
  const dayMap = new Map(cal.days.map((d) => [d.date, d]));

  // Week nav label and prev/next availability
  const label = formatWeekLabel(weekStart);
  const allDates = cal.days.map((d) => d.date).sort();
  const firstWeek = allDates.length ? getMondayOf(new Date(allDates[0] + 'T00:00:00')) : weekStart;
  const lastWeek  = allDates.length ? getMondayOf(new Date(allDates[allDates.length - 1] + 'T00:00:00')) : weekStart;
  const hasPrev = weekStart > firstWeek;
  const hasNext = weekStart < lastWeek;

  // Summary
  const ordered  = cal.days.filter((d) => d.status === 'ordered').length;
  const orderable = cal.days.filter((d) => d.orderable).length;
  const summaryHtml = `<span class="week-summary">${ordered} ordered · ${orderable} open</span>`;

  // Build day cards
  const useGrid = window.innerWidth >= BREAKPOINT;
  const containerClass = useGrid ? 'week-grid' : 'week-stack';
  const cardsHtml = weekDates
    .map((iso) => {
      const day = dayMap.get(iso);
      return day ? renderDayCard(day, { readonly: true }) : renderEmptyDayCard(iso);
    })
    .join('');

  $('calendarContainer').innerHTML =
    `<div class="week-nav">` +
    `<button id="prevWeek" ${hasPrev ? '' : 'disabled'}>‹</button>` +
    `<h2>${label}</h2>` +
    summaryHtml +
    `<button id="nextWeek" ${hasNext ? '' : 'disabled'}>›</button>` +
    `</div>` +
    `<div class="${containerClass}">${cardsHtml}</div>`;

  $('prevWeek').addEventListener('click', () => {
    state.weekStart = new Date(weekStart);
    state.weekStart.setDate(state.weekStart.getDate() - 7);
    renderWeek();
  });
  $('nextWeek').addEventListener('click', () => {
    state.weekStart = new Date(weekStart);
    state.weekStart.setDate(state.weekStart.getDate() + 7);
    renderWeek();
  });
}

// ── Wire up ──────────────────────────────────────────────────────
$('loginForm').addEventListener('submit', onLogin);
$('logoutBtn').addEventListener('click', logout);
$('studentSelect').addEventListener('change', (e) => {
  state.studentId = e.target.value;
  state.calendar = null;
  loadCalendar();
});

// Re-render on resize (layout switch)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderWeek, 150);
});

renderShell();
