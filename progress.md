# Progress Log

| Date | Type | Description |
|------|------|-------------|
| 2026-03-13 | feat | v12: fixed Shorts by replacing document.querySelector('video') with getActiveShortsVideo() that targets ytd-reel-video-renderer[is-active], added hybrid tap/long-press deactivation, updated isExcludedTarget for current YouTube DOM, added MutationObserver for swipe navigation detection |
| 2026-03-10 | refactor | Post-merge cleanup: extracted 7 timing magic numbers into named constants, grouped GM_addStyle by component, added console.warn for selector miss detection |
| 2026-03-10 | PR #2+#3 | Squash-merged PR #2 (v10 settings cog) and PR #3 (v11 tap-to-toggle) into main after rebasing stacked branches |
| 2026-03-10 | feat | Shorts tap-to-toggle (v10→v11): replaced hold-to-activate with tap-to-toggle 2x speed on left side, added double-tap debounce guard, persistent overlay with active indicator, nav reset to prevent state leakage, configurable mode switch |
| 2026-03-08 | feat | Settings cog speed menu (v9→v10): intercepts YouTube's playback speed menu item, replaces with custom panel offering 0.25x–8x, dark/light theming, keyboard nav, back button, outside-click dismiss |
| 2026-03-08 | feat | Complete rewrite (v8→v9): MutationObserver, GM storage, desktop keyboard shortcuts, Shorts long-press 2x, ad/SPA awareness |
