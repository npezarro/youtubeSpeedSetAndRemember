# youtubeSpeedSetAndRemember

Tampermonkey userscript: floating speed toggle + keyboard shortcuts for YouTube (desktop + mobile, watch + Shorts + fullscreen).

## Architecture

Single file (`script.js`), ~800 lines, no dependencies, no build step. Uses Tampermonkey GM_getValue/GM_setValue for speed persistence. MutationObserver for video detection in YouTube's SPA.

## Operational Rules

1. **YouTube DOM changes frequently.** Never rely on custom attributes (like `[is-active]`) or specific tag names as sole selectors. Use stable container IDs (`#shorts-player`, `#player-container-id`, `#movie_player`) with class-based fallbacks.
2. **Use visibility checks** (`offsetHeight > 0`, `getComputedStyle`) instead of attribute or inline style checks. Invisible elements can return stale references (e.g., `#movie_player` on Shorts pages).
3. **Test desktop and mobile independently.** YouTube can change `www.youtube.com` and `m.youtube.com` DOM at different times. Mobile containers (`ytm-player`, `ytm-shorts-player-renderer`) have been removed before.
4. **MutationObservers need `subtree: true`** for Shorts swipe navigation detection. YouTube swaps deep subtrees on SPA transitions.
5. **Bump major version** when adapting to YouTube DOM changes (affects multiple code paths).
6. **Update `context.md`** after every significant change. Next agent depends on it.
7. **No build step.** Install directly from GitHub raw URL or paste into Tampermonkey.

## Commands

No build/test commands. Manual testing via browser.

## Key Files

- `script.js` — The userscript (single file, all logic)
- `context.md` — Current state, open work, environment notes
- `progress.md` — Commit-level change log
