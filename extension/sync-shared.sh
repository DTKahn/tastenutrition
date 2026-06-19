#!/usr/bin/env bash
# Copy shared modules into the extension package so Chrome can load them as
# web-accessible resources. Run after editing anything in shared/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$here/shared"
cp "$here/../shared/parse.js" "$here/../shared/order.js" \
   "$here/../shared/ui.js" "$here/../shared/tokens.css" \
   "$here/shared/"
echo "synced shared/ -> extension/shared/"
