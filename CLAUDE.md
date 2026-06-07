# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

This is a desktop Pomodoro timer with two deployment targets:

- **`pomodoro.html`** — Primary deliverable. Self-contained HTML/CSS/JS app with zero dependencies. Uses localStorage for persistence, Web Audio API for sound, and the Web Notification API for alerts. Open directly in a browser or via `start.sh`.

- **Electron version** (`main.js`, `index.html`, `renderer.js`) — Secondary target for native desktop features (tray, frameless window, system notifications). Currently blocked: Electron binary (~150MB) can't download from GitHub on this machine. Use the mirror env var if re-attempting: `ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`.

## Running the app

```bash
# Best desktop experience (Chrome app mode, no Chrome UI)
./start.sh

# Or just double-click / open in any browser
open pomodoro.html
```

## Key implementation notes

- Timer state machine: WORK → (SHORT_BREAK | LONG_BREAK) → WORK, cycling every 4 sessions for long break.
- Ring progress is an SVG circle with `stroke-dasharray` / `stroke-dashoffset` driven by `remaining/total` ratio.
- Settings persisted to `localStorage` key `pomodoro-state`.
- Audio uses per-note `AudioContext` instances to support iOS/Safari which aggressively tear down contexts.
- Keyboard shortcuts: Space (start/pause), → (skip), R (reset), Esc (settings). Input focus in settings fields suppresses shortcuts.

## Additional instruction

-当你需要对前端视觉进行修改的时候去参考品牌视觉规范文件里的内容
-当你要写产品文字的时候，参考语言规范文件里的内容