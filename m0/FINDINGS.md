# M0 Discovery — tastenutrition.com reverse-engineering

Date: 2026-06-14 · Method: Chrome DevTools MCP against a live logged-in session
(one test student, student_id 37708).
**No test orders were placed. No password was handled** (login form read in a
cookie-less isolated context).

Raw captures saved alongside this file:
`user_sign_in`, `school_menu`, `school_menu_choices`, `view_order_details`
(`.html` + `.network-response`).

## Verdict: GO

The site is fully drivable as a headless backend. It's classic server-rendered
ASP with a session cookie, **no CSRF tokens, no anti-automation, no JSON**.
Everything the app needs (students, menus, current orders, place/change/cancel)
is reachable by replaying form POSTs and parsing HTML.

## Platform
- `X-Powered-By: ASP.NET` on `PleskWin`. Classic `.asp` pages.
- Session: single cookie **`ASPSESSIONIDSGBDCSRB`** (`secure; path=/`), set on
  first GET of any page. Standard in-memory ASP session — server-side state,
  no token in the body. **No CSRF token anywhere.** No persistent "remember me"
  cookie observed (session is the only auth artifact).
- Charset `iso-8859-1` (watch for `&#39;` etc. when parsing).

## Endpoint map

| Step | Request | Notes |
|---|---|---|
| **Login** | `POST /user_sign_indb.asp` | Form `frm` on `/user_sign_in.asp`; fields `email`, `password`, `B1=" Continue "`. On success → 302 to `/user_profile.asp`. |
| **Dashboard / students** | `GET /user_profile.asp` | Lists students; each has a `student_id` (example `37708`) and a "Menu/Orders" button. Multi-student via `changeStudent()` / `Add Student`. |
| **Menu + current orders** | `POST /school_menu.asp` body `mode=&studentid=&student_id=37708` | THE core page. Returns the full multi-month calendar with every day's options **and the student's existing orders** (see data model). |
| **Per-day picker** | `GET /school_menu_choices.asp?thedate=D-M-YYYY` | e.g. `?thedate=16-6-2026`. Returns one day's selectable options. Used as a modal iframe by the menu page. |
| **Order → payment page** | `POST /school_menu_checkout.asp` | The menu form (`frm`) submits all `menu<id>_*` fields here. Renders a **credit-card payment page** (form `chkout`). Does **not** commit the order. |
| **Commit + charge** | `POST /get_payment.asp` (form `chkout`) | Captures card + billing and **charges to place the order**. This is the real commit. NOT exercised (would charge a real card). |
| **Order history** | `GET /view_orders.asp` → 302 `/view_order_details.asp` | Has a student dropdown; showed "No Order History Found" with no student POSTed. Lower-priority — current orders are better read from `school_menu.asp` (below). |
| **Logout** | `GET /logout.asp` | |

## Data model (from `school_menu.asp`)

The menu form `name="frm"` (POST → `school_menu_checkout.asp`) contains, **per
calendar day**, a numeric `menu_id` (e.g. `85531` = Tue 6/16/2026) and these
hidden fields:

| Field | Meaning |
|---|---|
| `menu<id>_days_choices` | chosen food id(s) for this submit (`;`-separated) |
| `menu<id>_days_choices_entrees` | chosen extra-entrée/milk add-on id(s) |
| `menu<id>_note` | optional note to student |
| `menu<id>_days_choices_previous` | **the EXISTING order** for this day, e.g. `3893;` |
| `menu<id>_previous_order_choices` | prior-order tracking |

- **"Which days have I ordered" (goal #1)** = days whose
  `menu<id>_days_choices_previous` is non-empty. Confirmed: many populated
  (e.g. `menu85531_days_choices_previous="3893;"` → 6/16 ordered Pesto Pasta).
  These also render bold-green with `[X]` in the calendar.
- **Options per day (goal #2)**: elements `id="<menu_id>^<optid>"` carry each
  option's name (e.g. `84954^2516`). Day → date mapping comes from the
  `menuprompt('D-M-YYYY')` onclick args, which also key the picker URL.
- **"Change Order" link** appears on days that are still within the editable
  window (future, before the per-date cutoff). Cutoff rules: TBD.

### Per-day picker (`school_menu_choices.asp`)
One radio group `opt` (the entrée; value = food id, `""` = "No Lunch") + a
paired checkbox `chk` (the $0.90 milk add-on, value = same food id). `menu_id`
hidden field identifies the day. On save, JS writes the selected
`opt`→`menu<id>_days_choices` and `chk`→`menu<id>_days_choices_entrees` back to
the parent menu form. Example for 6/16 (`menu_id=85531`):
`2527` Fish & Chips · `2510` Mac & Cheese (v) · `3893` Pesto Pasta w/ Chicken ·
`5307` Cheese Tortellini (v) · `2514` Soynut Butter & Jelly (v) · `5849` Drink
Only · `""` No Lunch.

### Pricing
Menu header: **Lunch $8.00**, **Organic milk add-on $0.90** (these are the live
values; the `view_order_details.asp` page quoted stale $4.00 figures).

## How the proxy will work (confirmed feasible)
1. `POST /user_sign_indb.asp` with the user's email+password → capture
   `ASPSESSIONIDSGBDCSRB`.
2. `GET /user_profile.asp` → parse student list + ids.
3. `POST /school_menu.asp` (student_id) → parse calendar: per-day options,
   existing orders (`*_days_choices_previous`), editable flag.
4. To order: rebuild the `frm` field set with `menu<id>_days_choices` /
   `_days_choices_entrees` set, `POST /school_menu_checkout.asp`, then complete
   whatever confirm step it returns.

## ⚠️ Ordering requires payment (pivotal — tested on June 24)

Controlled test 2026-06-14: set only `menu85537_days_choices=6891` (Simple
Quiche, 6/24) and submitted the menu form. Result captured in
`checkout_resp.network-response`:

- `school_menu_checkout.asp` returns a **credit-card payment page** (form
  `chkout` → `POST /get_payment.asp`), not a review/confirm.
- **Order Total: $8.40** for the one lunch ($8.00 + ~5% = $0.40 fee).
- Fields: `card_type, card_number, exp_month, exp_year, security_code,
  code_present` + billing (`billingfirst_name…billingzip`, pre-filled from the
  account), `total_amount=8.4`, `account_credit_total=0`, `chksave` (save card).
- **No saved card auto-applied** here; card entry is required (unless
  `account_credit` covers it — concept exists, was 0). Verified afterward that
  **no order was committed** (6/24 still empty; still exactly 20 ordered days).

**Implication:** "place an order" = **a payment transaction** (PCI-scoped card
handling), commit endpoint `get_payment.asp`. This materially changes the
"place/modify orders through our UI" goal — see SPEC §scope decision needed.
The `get_payment.asp` commit step remains untraced by design (would charge a
real card). Open: does the account ever carry `account_credit` that lets an
order commit without a card? Is there a saved-card/token path for repeat orders?

> **PII note:** the `m0/` captures contain the account holder's real billing
> address, email, and phone. Keep `m0/` out of any public repo (gitignore) or
> scrub before committing.

## Remaining unknowns (small)
1. **Order cutoff / lead-time rules** — which future days are editable and the
   deadline logic (drives the "Change Order" availability).
2. **Exact session timeout** — standard ASP session; measure idle TTL so we know
   how often the proxy must re-login.
3. **Multi-student switching** — `changeStudent()` path not traced (single
   student on this account); confirm it's just a different `student_id` POST.
4. **Account credit / saved card** — whether repeat ordering can avoid
   re-entering a card (see payment section above).
