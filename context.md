# context.md
Last Updated: 2026-04-01 — v17.1: mobile positioning swap (shorts top-right, watch top-left)

## Current State
- **v17.1** userscript in `script.js`
- Desktop keyboard shortcuts (`[`/`]`) for speed control
- **Floating speed toggle** on all video types (watch, Shorts, fullscreen)
  - Tap to expand drag slider (1-8x range, 0.25 step snapping)
  - Quick-select preset chips: 1.25x, 1.5x, 2x, 2.5x, 3x, 4x
  - Auto-collapses after 3s idle
  - Works on Shorts (slider replaces old simple 1x/2x toggle)
- **Mobile support**: matches both `www.youtube.com` and `m.youtube.com`
  - **Shorts**: toggle top-right, slider panel drops down from right
  - **Watch/longform**: toggle top-left, slider panel drops down from left
  - Larger touch targets (22px thumb, 16px font)
  - Mobile container detection: `ytm-player`, `ytm-shorts-player-renderer`
- **Fullscreen support**: re-injects toggle into fullscreen element on enter/exit
  - Max z-index (2147483647) ensures visibility over all YouTube overlays
- Speed persistence via GM_getValue/GM_setValue
- Uses MutationObserver for video detection
- Ad-aware, SPA-aware
- ~790 lines, no dependencies, no build step

## Open Work
- Manual testing on mobile Chrome (m.youtube.com) for slider interaction
- Verify Shorts slider doesn't conflict with swipe navigation
- Test fullscreen slider on both desktop and mobile browsers

## Environment Notes
- Tampermonkey userscript, no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block

## Active Branch
`main`
