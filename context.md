# context.md
Last Updated: 2026-03-08 — Added settings cog custom speed menu (v10)

## Current State
- **v10.0** userscript in `script.js`
- Desktop keyboard shortcuts (`[`/`]`) for speed control
- Mobile Shorts long-press left side for 2x
- Speed persistence via GM_getValue/GM_setValue
- **Settings cog integration**: clicking "Playback speed" in YouTube's settings menu opens a custom speed panel with 0.25x–8x range (0.25 steps) instead of YouTube's limited built-in options
- Custom panel features: dark/light theming (via `ytp-dark` class detection), back button to return to top-level settings, keyboard navigation (arrows/enter/escape), outside-click dismissal
- Uses MutationObserver for video detection and settings menu interception
- Ad-aware, SPA-aware
- ~430 lines, no dependencies, no build step

## Open Work
- None — feature-complete per requirements

## Environment Notes
- Tampermonkey userscript — no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block
- Settings cog interception only runs on desktop YouTube (skipped on m.youtube.com)

## Active Branch
`claude/full-rewrite`
