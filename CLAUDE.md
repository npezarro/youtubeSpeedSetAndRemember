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

## Tampermonkey Standards

- **Auto-update headers required:** `script.js` must include `@updateURL` and `@downloadURL` pointing at the hosted copy. Without these, Tampermonkey cannot detect updates.
- **Ship with debug/verbose logging disabled.** Use boolean constants (e.g., `const DEBUG = false`) and gate console output behind them. Never commit with debug flags enabled.
- **Install page:** When updating this script, update the entry in `~/repos/browser-agent/tm-scripts/index.html` and the source mapping in `sync-tm-scripts.sh`, then run `sync-tm-scripts.sh` to deploy.

## Cross-Cutting Rules (added 2026-05-30)

The rules below were synced from `~/repos/agentGuidance/guidance/tampermonkey.md` for cross-cutting Tampermonkey concerns that weren't already covered above. The YouTube-specific resilience patterns in "Operational Rules" already cover most of `tampermonkey.md` § "YouTube DOM Resilience".

### Platform & Performance

- **For new browser automation scripts, default to Chrome Automation Hub** (`~/repos/chrome-automation`) rather than Tampermonkey. This existing YouTube script stays on Tampermonkey because it predates the hub and the userscript surface works fine here, but any NEW scripts should be ported/written to the hub unless they need `GM_xmlhttpRequest` for CORS bypass, mobile Firefox automation, or a remote-agent orchestration pattern. See `chrome-automation/CLAUDE.md`.
- **Per-tab sandbox CPU overhead:** Tampermonkey's per-tab sandbox is the reason this script feels heavier than a native extension would. If the script ever expands to match more than YouTube (`*://*/*`) or gains frequent timers, evaluate migrating to an MV3 Chrome extension. In `browser-logs` (April 2026), TM's per-tab overhead accumulated ~14 hours of CPU with only 6 tabs open. The MV3 pattern proved out there: `content.js` (MAIN world) patches page APIs and posts data via `postMessage`; `bridge.js` (ISOLATED world) forwards via `chrome.runtime.sendMessage`; `background.js` is a single service worker with shared timers. Today, YouTube-only matching keeps the cost bounded — but don't broaden the `@match` without considering this.

### Mobile Firefox Compatibility

This script matches `m.youtube.com` and is used on mobile Firefox. The following constraints apply on top of the existing "Operational Rules":

- **IntersectionObserver is unreliable on mobile Firefox for viewport exits.** It doesn't always fire callbacks when elements scroll out of view. If a future feature needs viewport-exit detection (currently the script only relies on navigation via `video.src` change, which is fine), pair the observer with a scroll listener that checks `getBoundingClientRect()` directly.
- **CSP blocks inline `<script>` injection.** Firefox Android enforces stricter CSP in Tampermonkey contexts. If you need to patch page-level APIs (e.g., intercept `fetch()`), use `unsafeWindow` patching instead of injecting `<script>` tags.
- **Auth tokens / page globals may not appear passively.** Unlike desktop, mobile browsers may not make authenticated API calls during passive browsing. If a future feature needs YouTube auth state, extract proactively from page globals (e.g., `window.ytInitialPlayerResponse`) or inline script tag contents rather than waiting for network interception.

### Testing & CI

- **Pin Node.js to 22 in CI** (current LTS). Don't use `node-version: 'lts/*'` — it can shift unexpectedly. Node 20 reached EOL on 2026-04-30.
- **`package-lock.json` must be committed** for `npm ci` + `cache: npm` to work in GitHub Actions.
- **Test glob quoting on GHA:** Single-quoted globs like `'test/**/*.test.js'` do NOT expand on GitHub Actions because `globstar` is off by default. Use a flat glob or let Vitest find tests via config.
- **Mock at boundaries** (DOM APIs, MutationObserver, GM_* storage, timers) — not the unit under test. Reset mocks with `beforeEach(() => vi.clearAllMocks())`.
