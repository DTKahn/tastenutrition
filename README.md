# Taste Nutrition — friendlier front end

A clean front end over the legacy [tastenutrition.com](https://www.tastenutrition.com)
hot-lunch portal: see at a glance which days you've ordered, and browse each
day's options in a good UI. Built as a static web app talking to a small
serverless proxy. Full rationale and decisions in [`SPEC.md`](SPEC.md); the
reverse-engineered Taste contract is in [`m0/FINDINGS.md`](m0/FINDINGS.md).

## Layout

```
web/      Static UI (deploys to GitHub Pages). Plain HTML/CSS/JS, no build.
worker/   Cloudflare Worker: logs into Taste, scrapes HTML, serves clean JSON.
m0/       Discovery captures + findings (gitignored: contains real PII).
SPEC.md   The spec.
```

## How it works

The browser never talks to tastenutrition.com directly (cookies are
origin-bound and CORS blocks it). Instead:

```
browser (web/)  ──JSON──>  Worker (worker/)  ──form POSTs/HTML──>  tastenutrition.com
```

The Worker is the only thing that understands Taste's 1990s ASP markup. It logs
in, parses the menu calendar (including which days are already ordered), and
returns tidy JSON. **No passwords are stored**: the Worker forwards the login to
Taste, keeps only the session cookie, and encrypts that cookie into the app
token it hands back (see `worker/src/session.ts`) — it stays stateless.

**M1 is read-only** (view ordered days + browse options). Placing orders means a
payment hand-off to Taste's own card page; that's M2 (see SPEC §4a).

## Run it locally

### 1. Worker
```bash
cd worker
npm install
npx wrangler secret put APP_SECRET   # paste a long random string (openssl rand -base64 32)
npm run dev                          # serves http://localhost:8787
```

### 2. Web UI
`web/config.js` already points at `http://localhost:8787`. Serve the folder:
```bash
cd web
python3 -m http.server 5173
```
Open <http://localhost:5173>, sign in with your Taste email/password.

### Validate the HTML parsers (no login needed)
```bash
cd worker
npm run test:parse   # runs against the real captures in ../m0 (if present)
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
- [ ] **M2** — select + payment hand-off; resolve cutoff/session-TTL tails.
- [ ] **M3** — hardening, polish, deploy.
- [ ] **M4** — multi-tenant for other parents.
