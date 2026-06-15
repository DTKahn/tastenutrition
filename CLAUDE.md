# CLAUDE.md

A friendlier front end over the legacy **tastenutrition.com** school hot-lunch
site (a parent ordering portal). Goal: see which days are ordered and browse/
pick each day's options in a good UI, treating Taste as a headless backend.

## Read these first
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
- `worker/src/taste.ts` — Taste client (login, students, calendar). Imports the
  parser from `../../shared/parse.js`.
- `worker/src/index.ts` — routes: `POST /api/auth/login`, `GET /api/students`,
  `GET /api/calendar?student=`.
- `web/{index.html,app.js,styles.css,config.js}` — read-only viewer UI (phone +
  laptop). `config.js` sets the API base URL.
- `extension/` — laptop Chrome MV3 extension (M2 ordering). `src/content.js`
  (bootstrap: fetch raw menu → parse → mount), `src/ui.js` (shadow-DOM picker),
  `src/checkout.js` (clear stale `_days_choices`, write picks, top-level submit to
  Taste's payment page). Shares `shared/*.js` via `sync-shared.sh` (no bundler).
  Manifest matches `school_menu.asp`. See `extension/README.md`.

## Run locally
```bash
cd worker && npm install
# local secret (gitignored): wrangler dev reads .dev.vars, NOT `wrangler secret put`
printf 'APP_SECRET=%s\n' "$(openssl rand -base64 32)" > .dev.vars
npx wrangler dev --port 8787 --local        # API at :8787
cd ../web && python3 -m http.server 5173     # UI at :5173, sign in with Taste creds
cd worker && npm run test:parse              # parser checks, no login needed
node shared/order.test.js                    # order-assembly checks
```
The parser + order tests are plain JS ES modules (`shared/*.test.js`), run with
plain `node` (no `--experimental-strip-types`). To run/test the extension, see
`extension/README.md` (and the chrome-devtools-mcp caveat in memory:
the MCP-driven Chrome disables extensions — load Taste+ in your own Chrome).

## Status / next
- **M0 done**, **M1 done & verified live** (read-only viewer).
- **M2 ordering MECHANISM done & verified live (new orders); UI NOT yet to spec.**
  Laptop Chrome extension (`extension/`) runs inside tastenutrition.com, picks
  days, writes Taste's order form, and hands off to Taste's payment page;
  **card-free**, money-safe (verified live). ⚠️ **But the UI is a placeholder:**
  what shipped is a minimal right-side **overlay list**. The approved design
  (design doc §5) called for a **polished calendar that looks like the M1 viewer
  and REPLACES Taste's page** — that was silently narrowed in the plan and is the
  **top next task** (below). Design + plan + the pivotal discovery
  spike are in `docs/superpowers/specs/2026-06-14-m2-ordering-design.md` and
  `docs/superpowers/plans/2026-06-14-m2-ordering.md`. **Why the device split:**
  SPEC §4a's cross-origin "POST the order to checkout from our page" can't work
  card-free (session cookie is `SameSite=Lax` → blocks the cross-site POST; the
  order lives in Taste's server-side session; reads vs payment use different Taste
  sessions). So phone = read-only viewer, laptop = extension. M2 = **new orders
  only**; change/cancel deferred. M0 tails resolved: cutoff = Taste only renders
  in-window days (it omits past-cutoff days); checkout charges only for non-empty
  `_days_choices` (existing orders in `_days_choices_previous` are preserved).
- **Next — TOP PRIORITY: rebuild the laptop ordering UI to the agreed bar.**
  Port the M1 viewer's calendar + day-detail (month grid; day → options with
  **descriptions + dietary tags**, which the parser already returns; reuse
  `web/styles.css`'s look) into `extension/` (`src/ui.js` + a stylesheet), and
  make it **take over** `school_menu.asp` — hide Taste's markup, render full-bleed
  — instead of overlaying a minimal list. The ordering mechanism + payment hand-off
  underneath already work and shouldn't change; this is front-end work on a solid
  base, reusing the shared parser. Also fix the misleading "reuses web/app.js"
  comment in `extension/src/ui.js`. Bar: "laptop ordering looks like the M1 viewer
  and replaces Taste's page."
- **Then:** milk add-on fast-follow (needs a live look at
  `school_menu_choices.asp` `chk` field), M3 (deploy), M4 (multi-tenant), and
  change/cancel (needs the edit-charge behavior measured safely).

## Gotchas learned
- `[hidden] { display:none !important }` is required — class rules like `.modal`/
  `.login` set `display` and otherwise override the `hidden` attribute.
- Taste option markup is irregular: tooltip attributes embed `>` and `</div>`;
  options may be plain text, `<span>`, or bold `<strong><font>` when chosen;
  ordered days use `class="menucell2"`, available days `class="menucell"`.
- `student_id` is an opaque numeric id (e.g. `37708`). Picker date arg format is `D-M-YYYY`.
- The browser session can be driven for debugging via the **chrome-devtools-mcp**
  tools (how M0 and the live M1 test were done).
