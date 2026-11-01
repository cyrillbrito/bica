#!/usr/bin/env bash
# Screenshots of the dev app on test data, for the docs. Needs the dev server
# (`bun run dev`, port 3142) and the global `agent-browser` CLI.
#
#   site/scripts/screens.sh                         every shot in screens.txt
#   site/scripts/screens.sh <name> <path> [desktop|phone] [light|dark] [js]
#
# The optional js runs in the page just before the shot, to open a drawer,
# a menu, or the palette, or to scroll.
#
# Saves site/src/assets/screens/<name>-<device>-<theme>.png at 2x.
# Paths must carry `?data=` (test data) or be the /ui playground, so a shot
# never shows real sessions. Test data holds back every command, so clicking
# around while shooting can't reach the server.
set -euo pipefail

BASE="${BICA_URL:-http://localhost:3142}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/../src/assets/screens"
export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-bica-docs-screens}"
mkdir -p "$OUT"

shot() {
  local name="$1" path="$2" device="${3:-desktop}" theme="${4:-light}" js="${5:-}"
  case "$path" in
    *data=* | /ui*) ;;
    *) echo "refusing $path: add ?data=demo so it shows test data" >&2; return 1 ;;
  esac
  case "$device" in
    desktop) agent-browser set viewport 1280 800 2 >/dev/null ;;
    phone) agent-browser set viewport 390 844 2 >/dev/null ;;
    *) echo "unknown device $device" >&2; return 1 ;;
  esac
  agent-browser open "$BASE$path" >/dev/null
  # The app reads its theme from localStorage before first paint (ui/theme.ts).
  agent-browser eval "localStorage.setItem('bica.theme', '$theme')" >/dev/null
  agent-browser reload >/dev/null
  agent-browser wait 2000 >/dev/null
  # Hide the test data switch ("–"), which stays on until a reload.
  agent-browser eval "document.querySelector('[title^=\"Hide this until a reload\"]')?.click()" >/dev/null
  agent-browser wait 300 >/dev/null
  if [ -n "$js" ]; then
    agent-browser eval "$js" >/dev/null
    agent-browser wait 800 >/dev/null
  fi
  local file="$OUT/$name-$device-$theme.png"
  agent-browser screenshot "$file" >/dev/null
  echo "$file"
}

if [ $# -gt 0 ]; then
  shot "$@"
else
  # name path device theme [js], one shot per line; # starts a comment.
  while read -r name path device theme js <&3; do
    shot "$name" "$path" "$device" "$theme" "$js"
  done 3< <(grep -Ev '^[[:space:]]*(#|$)' "$DIR/screens.txt")
fi
agent-browser close >/dev/null
