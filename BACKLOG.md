# Backlog — Taste Nutrition front end

The living queue of work, in priority order. **Keep this up to date as you go:**
move items between sections, check them off, add new ones. Project overview,
architecture, and locked decisions live in `CLAUDE.md`; the full M2 rationale is
in `docs/superpowers/`. This file is just the actionable list.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Now / next up

- [~] **M2 UI rebuild — live & mostly working; open polish items below.** The
  full-bleed shadow-DOM extension UI was rebuilt (shared `ui.js`/`tokens.css`,
  week-grid layout, interactive option cards, footer bar). Verified live
  Jun 19 2026. Remaining known issues:
  - [ ] **Verify May data is now visible** after the `outerHTML` fix (parse
    existing page DOM instead of re-fetching; pushed 2026-06-19 but not yet
    tested by user). Expected: ‹ nav now reaches May.
  - [ ] **Verify week-nav default start** (Jun 22 fix) works end-to-end after
    the outerHTML change.
  - [ ] **Ordered-day states on extension** — confirm locked options + faded
    siblings render correctly when navigating to an already-ordered week.
  - [ ] **Payment hand-off smoke test** — select ≥1 new day, tap Continue;
    confirm Taste's checkout page loads with correct total (existing M2 test).
  - [ ] **Color / typography pass** — placeholder token values; refine
    `shared/tokens.css` once layout is confirmed solid.
  - [ ] **Web app parity** — `web/` side of the redesign (same shared components)
    needs end-to-end smoke test on mobile (375 px) and desktop (1280 px).

## Backlog (prioritized)

- [ ] **Organic milk add-on (M2 fast-follow).** Optional $0.90 add-on per day.
  Needs a live look at `school_menu_choices.asp`'s `chk` field to confirm the
  milk field, then extend `assembleOrderFields` + the UI (see plan Task 7).
- [ ] **M3 — hardening & deploy.** Caching, error/session-expiry UX, responsive
  polish; deploy `web/` to GitHub Pages + `worker/` to Cloudflare.
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
- [x] **M2 — ordering mechanism (new orders only).** Laptop Chrome extension:
  pick days → write Taste's order form → hand off to Taste's payment page,
  **card-free** and money-safe (clears stale selections; never re-charges existing
  orders). Merged & verified live. **NOTE:** UI is a placeholder — see "Now / next
  up" for the real UI rebuild.
