# Taste Nutrition — Better Front End

**A friendlier ordering experience layered on top of the tastenutrition.com hot-lunch portal.**

Status: Draft spec v1 · Date: 2026-06-14 · Owner: Daniel Kahn

---

## 1. Goal

tastenutrition.com is the only way parents can order school hot lunch, and its
interface is hard to use. The goal is to put a clean, modern front end in front
of the existing system — treating the legacy site as a **headless backend** —
so a parent can:

- **See at a glance which days they have ordered hot lunch** (a clear calendar
  view of ordered / available / closed days).
- **Browse and compare the meal options for any given day** in a good UI.
- **Place, change, and cancel orders** without touching the original site.

The original site keeps doing the real work (accounts, billing, fulfillment);
we provide the surface parents actually interact with.

## 2. Users

| Phase | Users | Login model |
|-------|-------|-------------|
| **P1 (MVP)** | Me + my partner | Each signs in with their own Taste login (a shared household credential is fine). |
| **P2+ (stretch)** | Other parents, possibly different schools/kids | **Multi-tenant**: each parent brings *their own* Taste login; data is isolated per user. |

Devices: **phone and laptop**, browser-based, responsive. No native app.

Design implication: even though P1 is two people, build the session/data model
**per-user from day one** so opening it to other parents later is an auth/deploy
change, not a rewrite.

## 3. Credential principle (non-negotiable)

**We never store passwords.** The owner does not want responsibility for
password management. The app uses a **session-only** model:

1. The parent enters their Taste login in our UI (same as logging into the real
   site).
2. Our proxy forwards it straight to tastenutrition.com, receives the **Taste
   session cookie**, and **immediately discards the password** — it is never
   written to disk, never logged, never stored.
3. Only the short-lived Taste session is held server-side (tied to our app
   token) for the duration of use. When it expires, the parent logs in again.

There is **no password database** — nothing to leak. We pass a login through;
we do not manage credentials. (This is the chosen tradeoff for keeping a
phone-friendly hosted app; see Section 5 for why a true "never see the password"
approach was set aside.)

## 4. Scope

### In scope
- Authenticate to tastenutrition.com on the user's behalf (session-only) and
  hold the session.
- Read: the user's **students**, their **current orders**, and the **available
  menu/options per date** (all parsed from `school_menu.asp`).
- Build a day-by-day **selection** in our UI, then **hand off to Taste's own
  payment page** to commit. We assemble the order and drop the parent on
  `school_menu_checkout.asp` (Taste's card page) to finish. See §4a.
- A responsive web UI: calendar overview + per-day option browser + selection.

### 4a. Ordering = select-then-handoff (payment stays with Taste)
M0 found that committing an order is a **credit-card payment** (the menu form
POSTs to `school_menu_checkout.asp`, a card page, which commits via
`get_payment.asp`; order total e.g. $8.40 = $8.00 + ~5% fee). To avoid PCI
scope and card-data liability — **decided: we never touch card data** — our app
goes right up to payment and then hands off:
- We build the menu form fields for the chosen day(s) and POST to
  `school_menu_checkout.asp` *in the parent's browser*, landing them on Taste's
  real payment page to enter their card and confirm.
- Nothing commits until the parent pays on Taste's page. "Change/cancel" follow
  the same path (re-selection → Taste checkout); cancel-without-payment behavior
  is an open question (§12).

### Out of scope (v1)
- **Collecting or transmitting card data** — payment happens on Taste's page.
- Storing passwords or building our own account system that holds Taste secrets.
- Account creation / school-passcode signup — users must already have a Taste
  account.
- Notifications, reminders, nutrition analytics (candidate P3).
- Any school-admin features (the `/admin/` area is off-limits).

## 5. Backend we're integrating with (findings)

From investigation of tastenutrition.com (no credentialed access yet):

- **Legacy ASP site**, server-rendered `.asp` pages. **No JSON/REST API.**
- Auth is **form-based with a session cookie**: `POST /user_sign_in.asp`.
- Ordering flow (per Taste's own description): select a **student** from a
  dropdown → pick meals from the **menu** for **calendar dates** → selections
  appear on a calendar with totals → **View Order History** shows what's ordered.
- Known pages: `/user_sign_in.asp`, `/online-ordering.asp`,
  `/onsite_cafeteria_programs.asp`, `/new_user_sign_up_code.asp`.

**Therefore integration = "drive the forms + parse the HTML":** log in to get a
session cookie, request order/menu pages, parse the rendered HTML into clean
data, and submit orders by replaying the site's form POSTs.

### Why a hosted proxy (and why not a browser extension)
A browser on `*.github.io` cannot log into or read tastenutrition.com directly —
cookies are origin-bound and CORS blocks cross-origin reads. Two shapes were
considered:

- A **browser extension** running on the real Taste page could reuse an existing
  login and *never see a password*, but it is desktop-only in practice and can't
  deliver the phone experience. **Set aside.**
- A **session-only hosted app + proxy** keeps phone + multi-tenant and never
  *stores* a password. **Chosen** (Section 3).

> ✅ **Milestone 0 (discovery) is essentially done — verdict: GO.** Mapped live
> via Chrome DevTools. See [`m0/FINDINGS.md`](m0/FINDINGS.md) for the full
> contract. Headlines: classic ASP, single session cookie
> `ASPSESSIONIDSGBDCSRB`, **no CSRF tokens, no anti-automation, no JSON**.
> Login `POST /user_sign_indb.asp` (`email`,`password`). Menu+current-orders
> `POST /school_menu.asp` (`student_id`). Per-day options
> `GET /school_menu_choices.asp?thedate=D-M-YYYY`. **Existing orders are embedded
> in the menu page** (`menu<id>_days_choices_previous`), so goal #1 is a straight
> parse. **Ordering = payment:** the menu form POSTs to
> `school_menu_checkout.asp` (a credit-card page) which commits via
> `get_payment.asp` — so we select-then-hand-off (§4a). Small remaining
> unknowns: order cutoff rules, exact session TTL, account-credit/saved-card.

## 6. Architecture

**Static UI on GitHub Pages + a serverless proxy on Cloudflare Workers.**

```
  Phone / Laptop browser
        │  (HTTPS, JSON; app session token)
        ▼
  [ UI ]  ── static SPA, hosted free on GitHub Pages
        │
        ▼
  [ Proxy / "adapter" ]  ── Cloudflare Worker (free tier)
        │   • app auth (which parent, isolated)
        │   • holds the Taste *session cookie* per user (never the password)
        │   • logs in, scrapes, parses HTML → clean JSON
        │   • builds the order form, hands off to Taste's payment page (no cards)
        ▼
  tastenutrition.com  (legacy ASP, unchanged)
```

The Worker is the **anti-corruption layer**: it turns the messy ASP site into a
small clean JSON API (Section 7). If Taste's HTML changes, only the Worker
changes.

- **UI (GitHub Pages):** all presentation; knows nothing about ASP/HTML; talks
  only to our JSON API. Lightweight SPA (framework TBD — Open Questions).
- **Proxy (Cloudflare Worker):** app auth, per-user session-only credential
  handling, scraping, HTML→JSON parsing, order-form assembly + payment handoff,
  light menu caching. **Never handles card data.**

## 7. Target internal API (Worker ↔ UI)

Confirmed against M0 findings. JSON over HTTPS, app token required.

| Method & path | Purpose | Maps to Taste |
|---|---|---|
| `POST /auth/login` | Take Taste creds, establish session, **discard password**, return app token. | `POST /user_sign_indb.asp` |
| `POST /auth/logout` | Drop the session. | `GET /logout.asp` |
| `GET /students` | List students (for the dropdown). | parse `user_profile.asp` |
| `GET /calendar?student=` | Per-day options **and** current orders for the student. | `POST /school_menu.asp` |
| `GET /menu?student=&date=` | One day's selectable options. | `GET /school_menu_choices.asp?thedate=` |
| `POST /order/prepare` | Build the menu-form payload for `{student, dates→selection}` and return a **handoff** (form fields + `school_menu_checkout.asp` target) the browser submits to land on Taste's payment page. | assembles `frm` → `school_menu_checkout.asp` |

There is intentionally **no** `POST /orders` that commits, and **no** card
endpoint — commit + payment happen on Taste's page (§4a).

### Core data shapes (confirmed)
```
Student   { id, name, school }                       // id = student_id, e.g. "37708"
Day       { date, menuId, status: "ordered"|"available"|"closed",
            order?: { optionId, optionName }, options: MenuOption[] }
MenuOption{ id, name, vegetarian, milkAddOnId? }     // id = food id, e.g. "6891"
            // ordered day → menu<menuId>_days_choices_previous = "<optionId>;"
```

## 8. Features / UX

1. **Calendar overview (primary screen).** Month/week calendar per student.
   Each day clearly shows **ordered** (with what) vs **available, not ordered**
   vs **closed/no service** — directly answering "what days have I ordered hot
   lunch?" Student switcher for multi-kid accounts.
2. **Day detail / option browser.** Tap a day → clean list of that day's options
   with name, description, price, dietary tags; readable on a phone. Far better
   than the original picker.
3. **Select & hand off to pay.** From the day detail, pick/change the entrée
   (and optional milk). Build up a selection across days, then a clear
   **"Continue to payment on Taste"** step submits the assembled order to Taste's
   checkout page, where the parent enters their card and confirms (§4a). We show
   the running total ($8.00/lunch + ~5% fee) before handoff; we never take cards.
4. **At-a-glance summary.** Upcoming ordered days and running cost for the period
   (parsed from the menu page's current-order data).

Principles: mobile-first, few taps to select, honest loading/error states
(scraping can fail), never silently drop a selection, and always make the
payment handoff explicit so the parent knows where they're paying.

## 9. Security

- **No stored passwords** (Section 3). Session-only; re-prompt on expiry.
- **Per-user isolation** — one parent can never see another's students/orders.
- Secrets/session data never shipped to the browser or committed to the repo.
- All traffic HTTPS. App-level auth gate in front of the proxy so it isn't an
  open relay to Taste.
- Polite client: realistic request volume, cache menus, don't hammer the ASP
  site. Confirm programmatic use is acceptable per Taste's terms (Open Q).

## 10. Milestones

- **M0 — Discovery spike. ✅ DONE (GO).** Login, menu, per-day picker, current
  orders, checkout flow all mapped live (incl. the June-24 test that revealed
  checkout = card payment → handoff design); contract in
  [`m0/FINDINGS.md`](m0/FINDINGS.md). No CSRF/anti-automation. Remaining tails:
  order-cutoff rules, measured session TTL, account-credit path — fold into M2.
- **M1 — Read-only MVP.** Worker: login + students + calendar (options + current
  orders) as the JSON API. UI: calendar overview + day option browser. *(Hits
  the two original goals.)* For me + partner.
- **M2 — Select & payment handoff.** Build day selections in the UI; assemble the
  Taste order form and hand off to Taste's payment page. Resolve the M0 tails.
- **M3 — Hardening & polish.** Caching, error handling, session-expiry UX,
  responsive polish; deploy UI to GitHub Pages + Worker to Cloudflare.
- **M4 — Multi-tenant (stretch).** App-level login so other parents use their
  own Taste credentials with isolated, session-only data.

## 11. Risks

- **Scraping is brittle** — Taste HTML changes can break us; isolated in the
  Worker to limit blast radius. *(Primary risk; feasibility otherwise confirmed
  at M0 — no anti-automation/CSRF.)*
- **Terms of use / acceptable-use** — automating a third-party site we don't own
  needs a sanity check, especially before exposing it to other parents.
- **Payment handoff seams** — the order assembled in our UI must arrive intact on
  Taste's payment page; a mismatch could mis-order or clobber other days. M0
  showed untouched days are preserved via `_days_choices_previous`, but this
  needs careful testing before real money moves.
- **Session-expiry UX** — exact ASP session TTL still unmeasured; if short,
  re-login friction may push us to longer-lived server sessions.
- **Cloudflare free-tier limits** — fine for a household; re-evaluate at M4.

## 12. Open questions

1. **UI stack:** plain TS + small framework vs React/Svelte; lean minimal for a
   static SPA. *(Decide at M1.)*
2. **Terms of use:** is programmatic access acceptable for personal use, and for
   other parents later?
3. **Order deadlines / lead time:** does Taste enforce per-date cutoffs? Which
   future days are editable (drives "Change Order" availability)? The UI must
   reflect them.
4. **Account credit / saved card:** the payment page exposes `account_credit_total`
   and a save-card option. If an account can carry prepaid credit, some orders
   may commit without a card — could enable richer in-app ordering later without
   PCI scope.
5. **Change/cancel without payment:** can an existing order be removed without
   going through the card page? (The picker can't select "No Lunch" to zero out.)
6. **Session TTL:** measure idle timeout to size re-login frequency.

---

### Decisions locked (from interview + M0)
- **View + select-then-handoff**: our UI builds the order; **payment happens on
  Taste's page** — we never touch card data (M0 found ordering = card payment).
- **No stored passwords** — session-only; the proxy passes the login to Taste
  and keeps only the temporary session.
- **Multi-tenant-ready**, per-user logins; P1 is me + partner.
- **GitHub Pages UI + Cloudflare Worker proxy**; always-on, phone + laptop.
- Integration is **scrape/drive the ASP forms** (no API, no CSRF, confirmed M0).
