# context.md
Last Updated: 2026-03-08 — Complete rewrite of userscript (v8 → v9)

## Current State
- **v9.0** userscript in `script.js` — complete rewrite from the old menu-hijacking v8
- Desktop keyboard shortcuts (`[`/`]`), mobile Shorts long-press 2x, speed persistence via GM storage
- Uses MutationObserver instead of setInterval polling
- Ad-aware, SPA-aware, no DOM injection into YouTube menus
- ~300 lines, no dependencies, no build step

## Open Work
- None — feature-complete per requirements

## Environment Notes
- Tampermonkey userscript — no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block

## Active Branch
`claude/full-rewrite`
