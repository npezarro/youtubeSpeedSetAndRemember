# context.md
Last Updated: 2026-03-13 — v12: fixed Shorts video targeting, hybrid tap/long-press deactivation

## Current State
- **v12.0** userscript in `script.js`
- Desktop keyboard shortcuts (`[`/`]`) for speed control
- **Mobile Shorts speed boost**: tap left half to activate 2x, tap or long press to deactivate
  - `getActiveShortsVideo()` targets the correct video element (handles YouTube's multi-video Shorts DOM)
  - 300ms tap threshold, 10px movement threshold, 250ms double-tap guard
  - Long press (400ms) while boosted deactivates without triggering a tap on release (`gestureConsumed` flag)
  - MutationObserver on Shorts container detects swipe navigation and resets boost state
  - Updated `isExcludedTarget` selectors for current YouTube Shorts DOM overlays
  - Persistent overlay with blue accent border when boost is active
  - Auto-resets on `yt-navigate-finish` and on swipe between Shorts
- Speed persistence via GM_getValue/GM_setValue
- **Settings cog integration**: custom speed panel with 0.25x-8x range (unchanged from v10)
- Uses MutationObserver for video detection and settings menu interception
- Ad-aware, SPA-aware
- ~870 lines, no dependencies, no build step

## Open Work
- Manual testing on mobile Chrome (m.youtube.com Shorts) recommended
- YouTube DOM selectors may change; `getActiveShortsVideo()` falls back to `document.querySelector('video')` if specific selectors break

## Environment Notes
- Tampermonkey userscript, no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block
- Settings cog interception only runs on desktop YouTube (skipped on m.youtube.com)

## Active Branch
`claude/shorts-fix` (PR pending into main)
