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

## Testing it under chrome-devtools-mcp

The Chrome that chrome-devtools-mcp drives launches in automation mode with
extensions disabled, so "Load unpacked" silently does nothing there. To let the
MCP drive a Chrome that has Taste+ loaded, give the MCP server these flags (it's
the gitignored project `.mcp.json`, since the paths are machine-specific — adjust
the absolute paths for your machine):

```jsonc
// .mcp.json (repo root, gitignored)
{
  "mcpServers": {
    "chrome-devtools-ext": {
      "command": "npx",
      "args": [
        "-y", "chrome-devtools-mcp@latest",
        "--userDataDir=/ABSOLUTE/PATH/.cache/taste-mcp-chrome",
        "--chromeArg=--load-extension=/ABSOLUTE/PATH/tastenutrition/extension",
        "--chromeArg=--disable-extensions-except=/ABSOLUTE/PATH/tastenutrition/extension"
      ]
    }
  }
}
```

Notes:
- Run `./sync-shared.sh` **before** the MCP launches Chrome (the loaded folder
  must contain `extension/shared/*.js`).
- `--userDataDir` is a persistent profile so the Taste login survives between
  sessions — log into Taste once in it.
- If extensions still don't load, add
  `"--ignoreDefaultChromeArg=--disable-extensions"`.
- Avoid running two chrome-devtools MCP servers at once (this one and any
  plugin-provided one) — enable just one to prevent duplicate browsers/tools.
- Alternative: start your own Chrome with `--remote-debugging-port=9222`
  (extension loaded, logged in) and run the MCP with
  `--browserUrl=http://127.0.0.1:9222`.
