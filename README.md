# YouTube Speed Controller

A lightweight Tampermonkey userscript that remembers your YouTube playback speed across sessions, adds keyboard shortcuts on desktop, and provides a long-press 2x boost for Shorts on mobile.

## Features

- **Speed persistence** — Your chosen speed is saved and automatically applied to every video, across tabs and sessions. Uses Tampermonkey's `GM_setValue`/`GM_getValue` (no localStorage).
- **Desktop keyboard shortcuts** — `[` decreases speed by 0.25x, `]` increases by 0.25x. Works on any YouTube page. Won't fire when typing in search or comments.
- **Shorts long-press 2x** — On mobile (touch devices), long-press the **left half** of the screen during a Short to temporarily boost to 2x. Release to return to your saved speed. Right side is untouched — YouTube's native behavior works normally.
- **Ad-aware** — Doesn't fight YouTube's ad playback rate. Re-applies your speed when the ad ends.
- **SPA-aware** — Handles YouTube's single-page navigation (no page reloads between videos) via `yt-navigate-finish` event and MutationObserver.
- **Speed range** — 0.25x to 4.0x in 0.25x increments.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge) or [Firefox for Android](https://addons.mozilla.org/en-US/android/addon/tampermonkey/) for mobile.
2. **[Click here to install the script](https://raw.githubusercontent.com/npezarro/youtubeSpeedSetAndRemember/main/script.js)** — Tampermonkey will prompt you to install it.
3. Or: open Tampermonkey → Create new script → paste the contents of `script.js` → save.

The script auto-updates from this repo via `@updateURL`.

## Usage

### Desktop
- **`]`** — increase speed by 0.25x
- **`[`** — decrease speed by 0.25x
- A brief overlay shows the current speed when you change it.
- Your speed persists across videos and sessions.

### Mobile (Shorts)
- **Long-press left side** (400ms) — temporarily plays at 2x with a small "2x" indicator.
- **Release** — returns to your saved speed.
- Moving your finger more than 15px cancels the long-press (so scrolling still works).
- Right side of the screen uses YouTube's native long-press behavior.

### All platforms
- Speed is applied automatically when a new video loads.
- Changing speed via YouTube's native menu also gets persisted.

## How It Works

- **MutationObserver** on `document.body` watches for new `<video>` elements (YouTube swaps them during SPA navigation and Shorts swiping).
- **`ratechange` listener** (debounced 150ms) persists speed changes, with guards to skip ad-triggered rate changes and prevent feedback loops.
- **`yt-navigate-finish`** event listener handles YouTube's SPA page transitions.
- **WeakSet** tracks processed video elements to avoid duplicate listener attachment — no cleanup needed since listeners are GC'd with the element.

## Compatibility

| Platform | Browser | Status |
|----------|---------|--------|
| Desktop | Chrome + Tampermonkey | Full support |
| Desktop | Firefox + Tampermonkey | Full support |
| Android | Firefox + Tampermonkey | Full support |
| iOS | Safari + Userscripts | Not supported (different API) |

## License

MIT
