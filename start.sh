#!/bin/bash
# Pomodoro Timer Launcher
# Opens the pomodoro.html as a standalone desktop-like window

DIR="$(cd "$(dirname "$0")" && pwd)"
HTML_FILE="$DIR/pomodoro.html"

# Try Chrome app mode first (best standalone experience)
if command -v "Google Chrome" &>/dev/null || [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" --args --app="file://$HTML_FILE" --window-size=440,680 &
  echo "🍅  Pomodoro Timer launched in Chrome app mode!"
  exit 0
fi

# Try Microsoft Edge app mode
if command -v "Microsoft Edge" &>/dev/null || [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "Microsoft Edge" --args --app="file://$HTML_FILE" --window-size=440,680 &
  echo "🍅  Pomodoro Timer launched in Edge app mode!"
  exit 0
fi

# Fallback: open in default browser
open "$HTML_FILE"
echo "🍅  Pomodoro Timer opened in browser. For best experience, open with Chrome/Edge app mode."
