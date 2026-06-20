# CLAUDE.md

A friendlier front end over the legacy **tastenutrition.com** school hot-lunch
site (a parent ordering portal). Goal: see which days are ordered and browse/
pick each day's options in a good UI, treating Taste as a headless backend.

## Read these first
- **`BACKLOG.md`** — the living, prioritized queue of what's next. Keep it current.
- **`SPEC.md`** — goals, decisions, scope, architecture.
- **`m0/FINDINGS.md`** — the reverse-engineered Taste contract (endpoints, form
  fields, data model). `m0/` also has raw HTML captures. **`m0/` is gitignored —
  it contains real account/billing PII. Never commit it.**

## Architecture (don't relitigate)
`web/` (static UI, GitHub Pages) → `worker/` (Cloudflare Worker proxy) → tastenutrition.com.
Browser can't hit Taste directly (origin-bound cookies + CORS); the Worker is
the only thing that speaks Taste's 1990s ASP (session cookie + form POSTs + HTML
scraping) and exposes clean JSON.

### Locked decisions
- **No stored passwords.** Worker forwards the login to Taste, keeps only the
  session cookie, encrypts it into the app token (`worker/src/session.ts`).
  Stateless — no DB.
- **Ordering = payment.** Committing an order is a credit-card payment on Taste's
  page (`school_menu_checkout.asp` → `get_payment.asp`). So we **select-then-hand-
  off**: build the order in our UI, then drop the parent on Taste's payment page.
  **We never touch card data.** (SPEC §4a.)
- Taste has **no API, no CSRF tokens, no anti-automation** (confirmed M0).
- Multi-tenant-ready (per-user logins); P1 is just me + partner.

## Code map
- `shared/parse.js` — HTML → JSON (students, calendar w/ current orders, per-day
  options, `orderable` flag). The fiddly part; quirks documented inline. **Single
  source** imported by both `worker/` and `extension/`. Tested by
  `shared/parse.test.js` against `m0/` fixtures: `npm run test:parse` (from worker)
  or `node shared/parse.test.js`.
- `shared/order.js` — `assembleOrderFields(calendar, selections)`: pure logic that
  turns new-order picks into Taste `frm` field writes; new-orders-only (throws on
  already-ordered days). Tested by `shared/order.test.js`.
- `shared/ui.js` — render functions (`renderDayCard`, `renderEmptyDayCard`,
  `renderWeekNav`, etc.) returning HTML strings. Used by both `web/app.js` and
  `extension/src/ui.js`. Read-only vs interactive mode set by the `readonly` flag.
- `shared/tokens.css` — CSS custom properties (colors, radii, gaps). Imported by
  `web/styles.css`; injected into the shadow root by `extension/src/content.js`
  with `:root` → `:host` rewrite so vars cascade into the shadow tree.
- `shared/components.css` — shared component styles (day cards, option items,
  week grid, badges, topbar base, week-nav base). Imported by `web/styles.css`;
  injected into the shadow root by `extension/src/content.js`. **Edit here, not
  in the surface files**, to avoid drift between web and extension.
- `worker/src/taste.ts` — Taste client (login, students, calendar). Imports the
  parser from `../../shared/parse.js`.
- `worker/src/index.ts` — routes: `POST /api/auth/login`, `GET /api/students`,
  `GET /api/calendar?student=`.
- `web/{index.html,app.js,styles.css,config.js}` — read-only viewer UI (phone +
  laptop). `styles.css` imports tokens + components then adds web-only rules
  (login card, sticky topbar, calendar-wrap). `config.js` sets the API base URL.
- `extension/` — laptop Chrome MV3 extension (M2 ordering). `src/content.js`
  (bootstrap: reads page DOM, injects tokens + components + surface styles into
  shadow root, mounts UI), `src/ui.js` (shadow-DOM week picker, interactive),
  `src/styles.css` (surface-only: `:host`, footer bar, radio buttons, scrollable
  content area), `src/checkout.js` (clear stale `_days_choices`, write picks,
  hand off to Taste's payment page). Shares `shared/*.js` and `shared/*.css` via
  `sync-shared.sh` (no bundler — run after editing anything in `shared/`).
  Manifest matches `school_menu.asp`. See `extension/README.md`.

## Testing

### Unit tests (no browser needed)
```bash
cd worker && npm run test:parse   # parser checks against m0/ fixtures
node shared/order.test.js         # order-assembly checks
```
Both are plain ES modules — run with plain `node`, no flags.

### Run locally
```bash
cd worker && npm install
# local secret (gitignored): wrangler dev reads .dev.vars, NOT `wrangler secret put`
printf 'APP_SECRET=%s\n' "$(openssl rand -base64 32)" > .dev.vars
npx wrangler dev --port 8787 --local        # API at :8787
# Serve from repo root so web/styles.css can reach ../shared/tokens.css
python3 -m http.server 5173                 # UI at http://localhost:5173/web/
```

### Live browser testing via chrome-devtools-mcp
`.mcp.json` (repo root, gitignored) uses `--autoConnect` to attach to your
existing Chrome — Taste+ loads from your real profile, no flags needed.

**Required setup — do this before starting Claude Code each session:**
1. Open Chrome with Taste+ loaded and logged into Taste
2. Open `chrome://inspect/#remote-debugging` and check **"Allow remote
   debugging for this browser instance"** — confirm it says
   "Server running at: 127.0.0.1:9222". Leave this tab open.
3. Navigate to `school_menu.asp` in another tab
4. Start (or restart) Claude Code

**Why the order matters:** the MCP connects at Claude Code startup. If port
9222 isn't open yet, the connection fails — it won't retry. Restart Claude Code
after enabling remote debugging if you got the order wrong.

**Chrome permission dialog:** when `--autoConnect` first connects, Chrome shows
a permission dialog. Accept it — if you miss it the connection fails with
"socket hang up". Check behind other windows.

**Two MCP servers run simultaneously** — the installed plugin
(`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`) always launches a blank
Chrome and should be ignored. Use only the project server
(`mcp__chrome-devtools-ext__*`) which uses `--autoConnect` from `.mcp.json`.

Claude uses `list_pages` → `select_page` to target the existing tab.
**Never use `navigate_page` or `new_page`** — those open new tabs in your real
Chrome window.

## Status
- **M0 / M1 / M2 done & verified live.** M2 = laptop Chrome extension: full-bleed
  shadow-DOM UI (week grid, interactive option cards, footer bar) + ordering
  mechanism (picks days → writes Taste's order form → hands off to Taste's payment
  page, **card-free** and money-safe). Both the web viewer and extension share
  `shared/ui.js`, `shared/tokens.css`, and `shared/components.css` for consistent
  rendering. Open polish items are in BACKLOG.
- **Why the device split (don't relitigate):** SPEC §4a's cross-origin "POST the
  order from our page" can't work card-free — session cookie is `SameSite=Lax`
  (blocks the cross-site POST), the order lives in Taste's server-side session,
  and reads vs payment use different Taste sessions. So **phone = read-only
  viewer, laptop = extension.** M0 tails resolved: cutoff = Taste only renders
  in-window days; checkout charges only for non-empty `_days_choices` (existing
  orders in `_days_choices_previous` are preserved). Full rationale + the discovery
  spike: `docs/superpowers/specs/2026-06-14-m2-ordering-design.md`.

## What's next
**The actionable, prioritized queue lives in [`BACKLOG.md`](BACKLOG.md)** — keep
it up to date as work lands. Top item right now: rebuild the laptop ordering UI to
look like the M1 viewer and replace Taste's page (the M2 mechanism underneath is
done; this is front-end work).

## Gotchas learned
- `[hidden] { display:none !important }` is required — class rules like `.modal`/
  `.login` set `display` and otherwise override the `hidden` attribute.
- Taste option markup is irregular: tooltip attributes embed `>` and `</div>`;
  options may be plain text, `<span>`, or bold `<strong><font>` when chosen;
  ordered days use `class="menucell2"`, available days `class="menucell"`.
- `student_id` is an opaque numeric id (e.g. `37708`). Picker date arg format is `D-M-YYYY`.
- **Taste's pages are Windows-1252**, not UTF-8. `fetch().text()` defaults to
  UTF-8 and produces replacement chars (U+FFFD) for smart quotes etc. The worker
  uses `new TextDecoder('windows-1252').decode(await res.arrayBuffer())`, but
  Miniflare maps the 0x80–0x9F range as Latin-1 (C1 control chars) rather than
  the Windows-1252 printable chars. Fix is in `stripTags` in `shared/parse.js`:
  remaps U+0091/92/93/94/96/97 → curly quotes and dashes before tag-stripping.
- **`shared/components.css` must be listed in `extension/manifest.json`** under
  `web_accessible_resources`, and synced via `sync-shared.sh`, before the
  extension can fetch it into the shadow root.
