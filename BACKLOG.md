# Backlog — Taste Nutrition front end

The living queue of work, in priority order. **Keep this up to date as you go:**
move items between sections, check them off, add new ones. Project overview,
architecture, and locked decisions live in `CLAUDE.md`; the full M2 rationale is
in `docs/superpowers/`. This file is just the actionable list.

Status key: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Now / next up

- [ ] **Rebuild the laptop ordering UI to the agreed bar.** What shipped in M2 is
  a minimal right-side **overlay list**; the approved design (design doc §5)
  called for a polished UI that **looks like the M1 viewer and replaces Taste's
  page**. Scope:
  - Port the M1 viewer's **calendar grid + day-detail** into `extension/`
    (`src/ui.js` + a stylesheet), reusing `web/styles.css`'s look.
  - Show option **descriptions + dietary tags** (the parser already returns
    these — they're just not displayed yet).
  - **Take over** `school_menu.asp`: hide Taste's markup and render full-bleed,
    instead of overlaying a panel.
  - Fix the misleading "reuses web/app.js" comment in `extension/src/ui.js`.
  - **Don't change** the ordering mechanism / payment hand-off underneath — it's
    done and money-safe. This is front-end work on a solid base.
  - **Bar:** "laptop ordering looks like the M1 viewer and replaces Taste's page."
  - Start with a quick design pass (lock look + behavior visibly) before building.

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
