# context.md
Last Updated: 2026-03-17 — extracted all YouTube DOM selectors into centralized SELECTORS config object

## Current State
- **v13.0** userscript in `script.js`
- Desktop keyboard shortcuts (`[`/`]`) for speed control
- **Mobile speed boost (all videos)**: long press on video area toggles 2x on/off
- **Mobile Shorts speed boost**: tap left half to activate 2x, tap or long press to deactivate
  - `getActiveVideo()` targets the correct video element (handles Shorts multi-video DOM and regular player)
  - 300ms tap threshold, 10px movement threshold, 250ms double-tap guard
  - Long press (400ms) toggles boost; `gestureConsumed` flag prevents tap-on-release
  - MutationObserver on Shorts container detects swipe navigation and resets boost state
  - Updated `isExcludedTarget` selectors for both desktop and mobile YouTube DOM
  - Persistent overlay with blue accent border when boost is active
  - Auto-resets on `yt-navigate-finish` and on swipe between Shorts
- **Settings cog integration**: custom speed panel with 0.25x-8x range, works on both desktop and mobile
  - Desktop: intercepts `.ytp-settings-menu` click on "Playback speed"
  - Mobile: intercepts bottom sheet menu items, renders as full-width bottom sheet panel
- Speed persistence via GM_getValue/GM_setValue
- Uses MutationObserver for video detection and settings menu interception
- Ad-aware, SPA-aware
- All YouTube DOM selectors centralized in `SELECTORS` config object at top of file, grouped by: player, ads, settingsMenu, mobile, shorts, videoPlayer, touchExcluded
- ~1020 lines, no dependencies, no build step

## Open Work
- Manual testing on mobile Chrome (m.youtube.com) for settings cog bottom sheet interception — YouTube's mobile DOM changes frequently
- Mobile bottom sheet selectors (`ytm-bottom-sheet-renderer`, `ytm-menu-service-item-renderer`) should be verified against live site
- Regular video long-press: verify it doesn't conflict with YouTube's native long-press (preview/scrub)

## Environment Notes
- Tampermonkey userscript, no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block

## Active Branch
`claude/extract-selectors`
