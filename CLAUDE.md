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
- `worker/src/parse.ts` — HTML → JSON (students, calendar w/ current orders,
  per-day options). The fiddly part; quirks documented inline. **Tested** by
  `worker/test/parse.test.ts` against `m0/` fixtures: `npm run test:parse`.
- `worker/src/taste.ts` — Taste client (login, students, calendar).
- `worker/src/index.ts` — routes: `POST /api/auth/login`, `GET /api/students`,
  `GET /api/calendar?student=`.
- `web/{index.html,app.js,styles.css,config.js}` — UI. `config.js` sets the API
  base URL.

## Run locally
```bash
cd worker && npm install
# local secret (gitignored): wrangler dev reads .dev.vars, NOT `wrangler secret put`
printf 'APP_SECRET=%s\n' "$(openssl rand -base64 32)" > .dev.vars
npx wrangler dev --port 8787 --local        # API at :8787
cd ../web && python3 -m http.server 5173     # UI at :5173, sign in with Taste creds
cd worker && npm run test:parse              # parser checks, no login needed
```
Node 23 runs the `.ts` test via `--experimental-strip-types`.

## Status / next
- **M0 done**, **M1 done & verified live** (read-only: calendar overview + day
  option browser; login round-trip works).
- **Next = M2**: select-and-hand-off ordering (assemble the menu form, POST to
  `school_menu_checkout.asp` in the browser to land on Taste's payment page).
  Also resolve M0 tails: order cutoff/lead-time rules, session TTL, account-credit.
- Then M3 (deploy: Worker + GitHub Pages), M4 (multi-tenant).

## Gotchas learned
- `[hidden] { display:none !important }` is required — class rules like `.modal`/
  `.login` set `display` and otherwise override the `hidden` attribute.
- Taste option markup is irregular: tooltip attributes embed `>` and `</div>`;
  options may be plain text, `<span>`, or bold `<strong><font>` when chosen;
  ordered days use `class="menucell2"`, available days `class="menucell"`.
- `student_id` is an opaque numeric id (e.g. `37708`). Picker date arg format is `D-M-YYYY`.
- The browser session can be driven for debugging via the **chrome-devtools-mcp**
  tools (how M0 and the live M1 test were done).
