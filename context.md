# context.md
Last Updated: 2026-04-05 — v18.3: mobile Shorts fix, action bar injection

## Current State
- **v18.3** userscript in `script.js`
- Desktop keyboard shortcuts (`[`/`]`) for speed control
- **Floating speed toggle** on all video types (watch, Shorts, fullscreen)
  - Tap to expand drag slider (1-8x range, 0.25 step snapping)
  - Quick-select preset chips: 1.25x, 1.5x, 2x, 2.5x, 3x, 4x
  - Auto-collapses after 3s idle
- **Shorts toggle injected into action bar** (above like button)
  - Desktop: `ytd-reel-player-overlay-renderer #actions` — first child
  - Mobile: `.reel-player-overlay-actions` — first child
  - Styled as 48px circle to match YouTube action button aesthetic
  - Slider panel opens to the left of action bar
- **Mobile support** (`m.youtube.com`):
  - `isMobile()` detects via hostname + `ytm-app` element
  - Shorts container: `#player-shorts-container` / `#player-container-id`
  - Watch container: `#player-container-id` / `.player-container`
  - Old selectors (`ytm-player`, `ytm-shorts-player-renderer`) removed — no longer in YouTube DOM
- **Desktop support** (`www.youtube.com`):
  - Shorts container: `#shorts-player` (YouTube removed `[is-active]` from `ytd-reel-video-renderer` in 2026-04)
  - Watch container: `#movie_player` (with `offsetHeight > 0` guard — invisible on Shorts pages)
- **Fullscreen support**: re-injects toggle into fullscreen element on enter/exit
- Speed persistence via GM_getValue/GM_setValue
- Uses MutationObserver for video detection
- Ad-aware, SPA-aware
- ~835 lines, no dependencies, no build step

## Key Decisions (2026-04-05)
- **Action bar injection** over corner overlay: feels native, stacks with like/dislike/share
- **Separate desktop/mobile code paths**: DOM structures are fundamentally different (`ytd-*` vs `ytm-*`)
- **Playwright for mobile testing**: iPhone 13 emulation with GM_* stubs at `/tmp/pw-test/`
- Full session closeout: see privateContext/deliverables/closeouts/

## Open Work
- Fullscreen toggle on mobile (not tested)
- Shorts swipe navigation (observer exists, not end-to-end tested)
- Consider adding Playwright tests to repo as regression suite

## Environment Notes
- Tampermonkey userscript, no server, no build, no deploy
- Install directly from GitHub raw URL or paste into Tampermonkey
- Auto-updates via `@updateURL` / `@downloadURL` in metadata block

## Active Branch
`main`
