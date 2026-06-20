# Taste+ extension (laptop ordering)

Personal Chrome/Edge extension that turns tastenutrition.com's ordering page
into a clean UI and hands off to Taste's own payment page. Never touches cards.

## Load it
1. Run `./sync-shared.sh` (copies the shared parser/order modules in).
2. Chrome → `chrome://extensions` → enable Developer mode → "Load unpacked" →
   select this `extension/` folder.
3. Go to tastenutrition.com, log in, open a student's Menu/Orders.

Re-run `./sync-shared.sh` and click the extension's reload icon after changing
anything under the repo-root `shared/`.