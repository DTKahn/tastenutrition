# Taste Nutrition — friendlier front end

A clean front end over the legacy [tastenutrition.com](https://www.tastenutrition.com)
hot-lunch portal: see at a glance which days you've ordered, browse each day's
options in a good UI, and place new orders — handing off to Taste's own payment
page so **card data never touches our code**. Full rationale and decisions in
[`SPEC.md`](SPEC.md); the reverse-engineered Taste contract is in
[`m0/FINDINGS.md`](m0/FINDINGS.md); the M2 ordering design + the discovery spike
that shaped it are in [`docs/superpowers/`](docs/superpowers/).

## Layout

```
web/        Static read-only viewer (GitHub Pages). Plain HTML/CSS/JS, no build.
worker/     Cloudflare Worker: logs into Taste, scrapes HTML, serves clean JSON.
shared/     HTML parser + order-assembly logic. Single source for worker + extension.
extension/  Chrome MV3 extension: the laptop ordering UI (runs inside Taste).
m0/         Discovery captures + findings (gitignored: contains real PII).
SPEC.md     The spec.
```

## How it works

**Viewing** (any device) goes through the Worker. The browser never talks to
tastenutrition.com directly — cookies are origin-bound and CORS blocks it:

```
browser (web/)  ──JSON──>  Worker (worker/)  ──form POSTs/HTML──>  tastenutrition.com
```

The Worker is the only thing that understands Taste's 1990s ASP markup. It logs
in, parses the menu calendar (including which days are already ordered), and
returns tidy JSON. **No passwords are stored**: the Worker forwards the login to
Taste, keeps only the session cookie, and encrypts that cookie into the app
token it hands back (see `worker/src/session.ts`) — it stays stateless.

**Ordering** can't go through that path card-free: Taste's session cookie is
`SameSite=Lax` (so a cross-origin POST from our page loses it), and the order
lives in Taste's server-side session, not the request. So ordering is **split by
device**:

- **Phone — read-only viewer.** Browse and see what's ordered; to order from a
  phone, use Taste's own site.
- **Laptop — `extension/`.** A Chrome extension runs *inside* tastenutrition.com
  (same-origin, your own login), renders a clean picker, writes your choices into
  Taste's order form, and hands you to Taste's real payment page. We never see or
  transmit card data. See [`extension/README.md`](extension/README.md).

**Status: M0/M1 (viewer) and M2 (new-order extension) are done & verified live.**
Changing/cancelling existing orders is deferred. Why the device split (and why
SPEC §4a's original hand-off couldn't work card-free) is documented in
[`docs/superpowers/specs/2026-06-14-m2-ordering-design.md`](docs/superpowers/specs/2026-06-14-m2-ordering-design.md).

## Run it locally

### 1. Worker
```bash
cd worker
npm install
# Local dev reads .dev.vars (gitignored) — NOT `wrangler secret put`:
printf 'APP_SECRET=%s\n' "$(openssl rand -base64 32)" > .dev.vars
npm run dev                          # serves http://localhost:8787
```

### 2. Web UI
`web/config.js` already points at `http://localhost:8787`. Serve the folder:
```bash
cd web
python3 -m http.server 5173
```
Open <http://localhost:5173>, sign in with your Taste email/password.

### 3. Laptop ordering extension
See [`extension/README.md`](extension/README.md): run `./sync-shared.sh`, then
load `extension/` unpacked in Chrome (`chrome://extensions` → Developer mode →
Load unpacked), and open a student's Menu/Orders on tastenutrition.com.

### Validate the parser + order logic (no login needed)
```bash
node shared/parse.test.js   # parser checks against ../m0 captures (if present)
node shared/order.test.js   # order-assembly checks
# (cd worker && npm run test:parse) runs the parser test via the worker script
```

## Deploy (later)

- **Worker:** `cd worker && npm run deploy`. Set `APP_SECRET` as a secret and
  `ALLOWED_ORIGIN` (in `wrangler.toml`) to your Pages origin.
- **UI:** push `web/` to GitHub Pages; set `web/config.js` to the Worker URL.

## Status

- [x] **M0** — discovery (GO). Contract mapped; ordering = payment.
- [x] **M1** — read-only MVP: Worker JSON API (login/students/calendar) + UI
      (calendar overview + day option browser). Parsers verified against
      fixtures.
- [x] **M2** — new-order ordering via the laptop extension (select → hand off to
      Taste's payment page, card-free); verified live. Fast-follow: organic-milk
      add-on. Deferred: changing/cancelling existing orders.
- [ ] **M3** — hardening, polish, deploy (Worker + GitHub Pages).
- [ ] **M4** — multi-tenant for other parents.
