# youtubeSpeedSetAndRemember

Tampermonkey userscript: floating speed toggle + keyboard shortcuts for YouTube (desktop + mobile, watch + Shorts + fullscreen).

## Architecture

Single file (`script.js`), ~800 lines, no dependencies, no build step. Uses Tampermonkey GM_getValue/GM_setValue for speed persistence. MutationObserver for video detection in YouTube's SPA.

## Operational Rules

1. **YouTube DOM changes frequently.** Never rely on custom attributes (like `[is-active]`) or specific tag names as sole selectors. Use stable container IDs (`#shorts-player`, `#player-container-id`, `#movie_player`) with class-based fallbacks.
2. **Use visibility checks** (`offsetHeight > 0`, `getComputedStyle`) instead of attribute or inline style checks. Invisible elements can return stale references (e.g., `#movie_player` on Shorts pages).
3. **Test desktop and mobile independently.** YouTube can change `www.youtube.com` and `m.youtube.com` DOM at different times. Mobile containers (`ytm-player`, `ytm-shorts-player-renderer`) have been removed before.
4. **MutationObservers need `subtree: true`** for Shorts swipe navigation detection. YouTube swaps deep subtrees on SPA transitions.
5. **Debounce MutationObservers** (250ms) when observing Shorts containers. Swipes trigger many rapid mutations; without debouncing, observers thrash and cause race conditions.
6. **Session-scoped state via module variables.** Use module-level variables (e.g., `sessionSpeed`) for state that should persist across SPA navigation (Shorts swipes) but reset on page leave. GM_setValue is for persistent cross-session storage only.
7. **Bump major version** when adapting to YouTube DOM changes (affects multiple code paths).
8. **Detect navigation via video src change, not container observers.** For Shorts swipe detection, track `video.src || video.currentSrc` changes in the body-level MutationObserver instead of watching for platform-specific container mutations. This works identically on desktop (`ytd-*`) and mobile (`ytm-*`) regardless of DOM structure differences. Debounce (300ms) and compare against a `lastVideoSrc` variable to avoid redundant re-injection.
9. **Update `context.md`** after every significant change. Next agent depends on it.
10. **No build step.** Install directly from GitHub raw URL or paste into Tampermonkey.

## Commands

- Lint: `npm run lint` (ESLint v9 flat config in `eslint.config.js`)
- Tests: `npm test` (Vitest)
- CI: GitHub Actions (`.github/workflows/ci.yml`) runs lint + tests on push/PR to `main` (Node 22)

## Key Files

- `script.js` — The userscript (single file, all logic)
- `context.md` — Current state, open work, environment notes
- `progress.md` — Commit-level change log
