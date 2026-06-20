# Backlog — Taste Nutrition front end

The living queue of work, in priority order. **Keep this up to date as you go:**
move items between sections, check them off, add new ones. Project overview,
architecture, and locked decisions live in `CLAUDE.md`; the full M2 rationale is
in `docs/superpowers/`. This file is just the actionable list.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Now / next up

- [x] **M2 UI rebuild — fully verified live 2026-06-19.** Full-bleed shadow-DOM
  extension UI (shared `ui.js`/`tokens.css`/`components.css`, week-grid layout,
  interactive option cards, footer bar). All items verified:
  - [x] May data visible — ‹ reaches Apr 27–May 1; disabled at boundary.
  - [x] Week-nav default start — lands on Jun 22 (first open week).
  - [x] Ordered-day states — ✓ ORDERED badges, faded siblings, no click handlers.
  - [x] Payment hand-off — selected Baked Chicken Strips Jun 22, tapped Continue,
    Taste's `school_menu_checkout.asp` loaded with Felix / $8.40 USD. Card-free. ✓
  - [x] Web app parity — shared `components.css`; web viewer verified at 1728px.
  - [ ] **Color / typography pass** — deferred; placeholder token values in
    `shared/tokens.css`. Do after M3 deploy.

## Backlog (prioritized)

- [ ] **Organic milk add-on (M2 fast-follow).** Optional $0.90 add-on per day.
  Needs a live look at `school_menu_choices.asp`'s `chk` field to confirm the
  milk field, then extend `assembleOrderFields` + the UI (see plan Task 7).
- [ ] **M4 — multi-tenant.** App-level login so other parents use their own Taste
  credentials with isolated, session-only data.
- [ ] **Change / cancel existing orders.** Deferred from M2: changing a *paid*
  order's charge/refund behavior is unknown and money-sensitive — measure it
  safely (no real charge) before building.

## Known issues / tails

- [ ] Worker `tsc` has one pre-existing error: `getSetCookie` not on `Headers`
  type (from M1; harmless at runtime). Clean up when convenient.
- [ ] Session TTL still unmeasured — size re-login frequency once it matters.

## Done

- [x] **M0 — discovery.** Reverse-engineered Taste's contract (`m0/FINDINGS.md`).
- [x] **M1 — read-only viewer.** Worker JSON API (login/students/calendar) + web
  UI (calendar overview + day option browser). Verified live.
- [x] **M2 — ordering UI + mechanism (new orders only).** Laptop Chrome
  extension: full-bleed shadow-DOM UI (week grid, interactive option cards,
  footer bar) + pick days → write Taste's order form → hand off to Taste's
  payment page, **card-free** and money-safe. All verified live 2026-06-19.
- [x] **M3 — hardening & deploy. Verified live 2026-06-19.** Session-expiry UX
  (friendly message on auto-logout), mobile responsive polish (375px stack
  layout, topbar constrained), Cloudflare edge caching (5 min, per-user keyed).
  Worker: `tastenutrition-worker.dtkahn.workers.dev`. Web:
  `https://dtkahn.github.io/tastenutrition/web/`. Both verified live.
