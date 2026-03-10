# context.md
Last Updated: 2026-03-10 — Post-merge cleanup: PRs merged, code quality pass

## Current State
- **v11.0** userscript in `script.js`
- Desktop keyboard shortcuts (`[`/`]`) for speed control
- **Mobile Shorts tap-to-toggle**: single tap on left half toggles 2x speed ON/OFF (replaces hold-to-activate from v10)
  - 200ms tap threshold, 10px movement threshold, 250ms double-tap guard to avoid collision with YouTube gestures
  - Persistent overlay with blue accent border when boost is active
  - Auto-resets on `yt-navigate-finish` to prevent state leaking across Shorts
  - `SHORTS_SPEED_MODE` config constant allows switching back to `'hold'` if needed
- Speed persistence via GM_getValue/GM_setValue
- **Settings cog integration**: custom speed panel with 0.25x–8x range (unchanged from v10)
- Uses MutationObserver for video detection and settings menu interception
- Ad-aware, SPA-aware
- ~800 lines, no dependencies, no build step

## Open Work
- Manual testing on mobile Chrome (m.youtube.com Shorts) recommended — no automated test coverage
- Monitor for YouTube native gesture collisions (double-tap-to-like/seek) — the 250ms debounce mitigates but YouTube can change handlers

## Environment Notes
- Tampermonkey userscript — no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block
- Settings cog interception only runs on desktop YouTube (skipped on m.youtube.com)

## Active Branch
`main` — all PRs merged, cleanup complete
