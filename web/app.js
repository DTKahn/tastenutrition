// Frontend for the Taste Nutrition front-end. Talks only to our Worker's JSON
// API (config.js -> window.TASTE_API_BASE). Read-only in M1: view ordered days
// and browse each day's options. Ordering + payment hand-off arrive in M2.

const API = window.TASTE_API_BASE;
const $ = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem('taste_token') || null,
  students: [],
  studentId: null,
  calendar: null,
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// --- API helpers ---------------------------------------------------------
async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logout();
    throw new Error(data.error || 'Please sign in again.');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

const showLoading = (on) => $('loading').toggleAttribute('hidden', !on);

// --- Auth ----------------------------------------------------------------
async function onLogin(e) {
  e.preventDefault();
  const err = $('loginError');
  err.hidden = true;
  $('loginBtn').disabled = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('email').value.trim(),
        password: $('password').value,
      }),
    });
    state.token = data.token;
    localStorage.setItem('taste_token', data.token);
    $('password').value = '';
    setStudents(data.students || []);
    render();
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
  localStorage.removeItem('taste_token');
  render();
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

// --- Data ----------------------------------------------------------------
async function loadCalendar() {
  if (!state.studentId) return;
  showLoading(true);
  try {
    state.calendar = await api(
      `/api/calendar?student=${encodeURIComponent(state.studentId)}`,
    );
    renderCalendar();
  } catch (ex) {
    $('calendar').innerHTML = `<p class="error">${ex.message}</p>`;
  } finally {
    showLoading(false);
  }
}

// --- Rendering -----------------------------------------------------------
function render() {
  const authed = !!state.token;
  $('loginView').toggleAttribute('hidden', authed);
  $('calendarView').toggleAttribute('hidden', !authed);
  $('who').toggleAttribute('hidden', !authed);
  if (authed && !state.calendar) loadCalendar();
}

function renderCalendar() {
  const cal = state.calendar;
  const days = cal.days || [];
  const ordered = days.filter((d) => d.status === 'ordered');
  $('summary').innerHTML = days.length
    ? `<strong>${ordered.length}</strong> ordered day${ordered.length === 1 ? '' : 's'} · ` +
      `<strong>${days.length - ordered.length}</strong> still open${
        cal.studentName ? ` · ${escapeHtml(cal.studentName)}` : ''
      }`
    : 'No upcoming menu days found.';

  // Group days by month.
  const byMonth = new Map();
  for (const d of days) {
    const key = d.date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  }

  const root = $('calendar');
  root.innerHTML = '';
  for (const [key, monthDays] of byMonth) {
    const [y, m] = key.split('-').map(Number);
    const section = document.createElement('div');
    section.className = 'month';
    section.innerHTML = `<h3>${MONTHS[m - 1]} ${y}</h3>`;

    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const name of DOW) {
      const h = document.createElement('div');
      h.className = 'dow';
      h.textContent = name;
      grid.appendChild(h);
    }

    // Leading blanks so the 1st-of-data lands on the right weekday.
    const first = new Date(`${monthDays[0].date}T00:00:00`);
    for (let i = 0; i < first.getDay(); i++) {
      const blank = document.createElement('div');
      blank.className = 'day empty';
      grid.appendChild(blank);
    }

    const byDate = new Map(monthDays.map((d) => [d.date, d]));
    const last = new Date(`${monthDays[monthDays.length - 1].date}T00:00:00`);
    for (let day = first.getDate(); day <= last.getDate(); day++) {
      const iso = `${key}-${String(day).padStart(2, '0')}`;
      const d = byDate.get(iso);
      if (!d) {
        const blank = document.createElement('div');
        blank.className = 'day empty';
        grid.appendChild(blank);
        continue;
      }
      grid.appendChild(dayCell(d, day));
    }
    section.appendChild(grid);
    root.appendChild(section);
  }
}

function dayCell(d, dayNum) {
  const cell = document.createElement('button');
  cell.className = 'day' + (d.status === 'ordered' ? ' ordered' : '');
  cell.innerHTML = `<span class="num">${dayNum}</span>`;
  if (d.status === 'ordered') {
    const opt = d.options.find((o) => o.id === d.orderedOptionId);
    cell.innerHTML += `<span class="pill">ORDERED</span>` +
      `<span class="chosen">${escapeHtml(opt ? opt.name : 'Ordered')}</span>`;
  } else {
    cell.innerHTML += `<span class="avail">${d.options.length} options</span>`;
  }
  cell.addEventListener('click', () => openDay(d));
  return cell;
}

function openDay(d) {
  const date = new Date(`${d.date}T00:00:00`);
  $('dayTitle').textContent = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  $('dayStatus').textContent =
    d.status === 'ordered' ? 'You have an order for this day.' : 'No order yet.';

  const ul = $('dayOptions');
  ul.innerHTML = '';
  for (const o of d.options) {
    const li = document.createElement('li');
    if (o.id === d.orderedOptionId) li.className = 'is-ordered';
    li.innerHTML =
      `<div class="opt-name">${escapeHtml(o.name)}${
        o.vegetarian ? '<span class="veg">VEG</span>' : ''
      }</div>` +
      (o.description ? `<div class="opt-desc">${escapeHtml(o.description)}</div>` : '') +
      (o.id === d.orderedOptionId ? `<div class="opt-tag">✓ Your order</div>` : '');
    ul.appendChild(li);
  }
  $('dayModal').hidden = false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

// --- Wire up -------------------------------------------------------------
$('loginForm').addEventListener('submit', onLogin);
$('logoutBtn').addEventListener('click', logout);
$('studentSelect').addEventListener('change', (e) => {
  state.studentId = e.target.value;
  state.calendar = null;
  loadCalendar();
});
$('dayClose').addEventListener('click', () => ($('dayModal').hidden = true));
$('dayModal').addEventListener('click', (e) => {
  if (e.target.id === 'dayModal') $('dayModal').hidden = true;
});

render();
