# M2 — Ordering: design

Status: Approved (design) · Date: 2026-06-14 · Owner: Daniel Kahn

Supersedes the *mechanism* described in SPEC §4a (the "POST the assembled form to
Taste's checkout from the parent's browser" handoff). The **goals** of §4a are
unchanged — build the order in a good UI, never touch card data — but the
discovery spike below proved that specific mechanism cannot work from a separate
origin. This doc records why, and the device-split design we adopted instead.

---

## 1. Goal (unchanged)

Let a parent place a hot-lunch order through a good UI instead of Taste's clunky
page, while **we never see or transmit card data** (SPEC §3, §4a, §9 — locked).

## 2. The pivotal discovery spike (2026-06-14)

Driven live with chrome-devtools-mcp against a logged-in session (student 37708,
read-only — `get_payment.asp` never touched, no order committed).

**Session cookie `ASPSESSIONIDSGBDCSRB`:** `SameSite=Lax`, `Secure`, **not
HttpOnly**, session-scoped, `path=/`, host-only.

Three findings, each confirmed live, kill the original cross-origin handoff:

1. **SameSite=Lax blocks the cross-origin order POST.** §4a planned to POST the
   assembled `frm` to `school_menu_checkout.asp` from our `github.io` page — a
   cross-site POST. Lax sends the session cookie only on **top-level GET
   navigations**, never on cross-site POST, so that request arrives
   unauthenticated and fails.
2. **The order lives in server-side session state, not in the request.** GETting
   `school_menu_checkout.asp` with 0, 1, and 2 days of selections in the query
   string rendered the card page with **$8.40 every time, unchanged**. Checkout
   reads a pending cart from the Taste session; query params do not drive it. So
   we cannot craft a handoff URL that carries the selection — the cart must be
   written by a prior **same-site, authenticated** request.
3. **Session split is fatal to a foreign-origin handoff.** Reads must go through
   the Worker (CORS) → that uses the *Worker's* Taste session. Payment happens in
   the *browser*, which would have a *different* Taste session (or none). Only a
   same-site request from a Taste-origin page can write the cart into the
   browser's session, and we can't host on Taste's origin.

We also evaluated, and rejected, a **full reverse-proxy** (route everything,
including payment, through the Worker on one shared session): it works
technically but **card data would transit our Worker = PCI scope + liability**,
directly violating the locked no-card-data decision.

**Conclusion:** §4a's seamless, card-free, pre-filled handoff is **not
achievable while our ordering UI runs on a separate origin.** The fix is to run
the ordering UI *inside Taste's own origin*, where same-site rules apply — i.e.
a browser extension.

## 3. The decision: split by device

| | Phone | Laptop |
|---|---|---|
| See what's ordered / browse options | ✓ web app (built, M1) | ✓ web app |
| Place a new order in a good UI | go to Taste's own site | ✓ **extension (new, M2)** |
| Touches the card | never | never |

- **Phone = read-only viewer.** Existing web app + Worker. To order from a phone,
  the parent uses Taste's own site (accepted as the rare case).
- **Laptop = nice ordering UI**, delivered by a **browser extension** that runs on
  `tastenutrition.com`. Because the extension's code executes in Taste's own
  origin with the parent's own logged-in session, it can legitimately read the
  menu, fill Taste's order form **same-site**, and hand off to Taste's real
  payment page — all card-free.

This was chosen over the reverse-proxy (PCI risk) and over a pure assisted
deep-link (which would force re-picking on Taste's clunky UI — the very thing we
want to avoid).

## 4. Architecture & repo structure

```
web/      static viewer SPA (GitHub Pages)  ─┐ read-only, phone + laptop
worker/   Cloudflare Worker proxy           ─┘ (unchanged from M1)

extension/  NEW — Chrome/Edge MV3 extension, runs on tastenutrition.com
  - content script injects the ordering UI onto school_menu.asp
  - fills Taste's real `frm` form and submits → Taste payment page

shared/   NEW — the HTML parser (today worker/src/parse.ts), extracted so both
          the Worker and the extension parse Taste pages with one codebase.
```

- **Target:** Chrome/Edge (Manifest V3). Firefox is possible later; Safari is out.
- **Distribution:** loaded unpacked / self-hosted for the household (no Web Store
  needed for P1). Each laptop installs once; the parent logs into Taste in that
  browser once.
- **Code reuse:** extract the parser into `shared/` and import it from both
  `worker/` and `extension/`. Keep the M1 parser tests green against `m0/`
  fixtures after the move.

## 5. Extension UX flow

1. Parent opens `tastenutrition.com` on the laptop and logs in (their own Taste
   session, in their own browser).
2. On the menu page, the content script **renders our clean calendar + day
   picker** over Taste's markup (same visual design as the M1 viewer).
3. Parent selects, per day, an entrée and optional milk add-on, across multiple
   days, with a **running total** ($8.00/lunch + $0.90 milk + ~5% fee).
4. **"Continue to payment"** writes the selections into Taste's real `frm` hidden
   fields (`menu<id>_days_choices`, `_days_choices_entrees`, etc. per
   `m0/FINDINGS.md`) and triggers Taste's own submit to
   `school_menu_checkout.asp`.
5. The parent lands on **Taste's real payment page**, enters their card, and
   confirms. The extension's job ends before any card field; **we never see card
   data.**

Principles carried from SPEC §8: mobile-not-required here (laptop only), few taps
to select, honest error states, never silently drop a selection, make the payment
handoff explicit.

## 6. Scope

**In scope (M2):**
- Extension ordering UI on the laptop for **placing new orders on open days the
  student has not ordered yet.**
- Reuse the parser; extract it to `shared/`.
- Resolve the open questions in §7 (no real charges).

**Out of scope (M2) — deferred to a later milestone:**
- **Changing or cancelling an order already placed.** On Taste, ordering is a
  payment, and the charge/refund behavior of editing a *paid* order is unknown
  and money-sensitive. It must be investigated safely (§7) before we build it.
- Phone-side ordering UI (phone stays read-only; order on Taste directly).
- Anything touching `get_payment.asp` / card data.

## 7. Open questions to resolve during build (no real charges)

1. **Editable-window / cutoff rules.** Which future days are still orderable and
   the deadline logic. ("Change Order" marks the 20 *ordered* days, not an
   editable-window signal — confirmed in the spike; the real cutoff is still
   unmeasured.) The UI must disable days past the cutoff.
2. **Multi-day submit safety.** Confirm that submitting N new days preserves the
   student's existing orders (SPEC risk: untouched days are carried via
   `*_days_choices_previous`). Verify carefully *before* any real money moves.
3. **Change/cancel payment behavior.** Investigate what Taste charges/refunds when
   an existing order is edited. Gating question for the future change/cancel
   milestone; explicitly NOT exercised in M2 (would risk a real charge).
4. **Session TTL** (minor) — measure Taste's idle timeout so the extension can
   prompt re-login gracefully.

## 8. Risks

- **Scraping/markup brittleness** — Taste HTML changes can break the parser or
  the field-fill. Isolated in `shared/` (parse) and the content script.
- **Mis-order risk at submit** — the assembled `frm` must arrive intact;
  mitigated by §7.2 testing before enabling real orders.
- **Extension maintenance** — MV3, manual install per laptop; acceptable for a
  household.
- **Session expiry mid-flow** — handle gracefully (re-login prompt).

## 9. Future (noted, not now)

- **Change/cancel** existing orders, once §7.3 is understood.
- **Phone "plan, finish on laptop"** — phone builds a selection, a button opens
  Taste on the laptop where the extension picks it up. Door left open by sharing
  the parser/design; not built in M2.
