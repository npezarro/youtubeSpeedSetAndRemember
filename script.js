// ==UserScript==
// @name         YouTube Speed Controller
// @namespace    https://github.com/npezarro/youtubeSpeedSetAndRemember
// @version      13.0
// @description  Persists playback speed across sessions. Desktop keyboard shortcuts ([ / ]). Mobile: long-press toggles 2x on any video, tap left side on Shorts. Settings cog custom speed menu (0.25x–8x) on desktop and mobile.
// @author       npezarro
// @match        *://www.youtube.com/*
// @match        *://m.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/npezarro/youtubeSpeedSetAndRemember/main/script.js
// @downloadURL  https://raw.githubusercontent.com/npezarro/youtubeSpeedSetAndRemember/main/script.js
// ==/UserScript==

(function () {
    'use strict';

    // --- Config ---
    const SPEED_KEY = 'yt_speed';
    const DEFAULT_SPEED = 1.0;
    const MIN_SPEED = 0.25;
    const MAX_SPEED = 8.0;
    const SPEED_STEP = 0.25;

    // --- DOM Selectors ---
    // Centralized YouTube DOM selectors. YouTube changes these periodically;
    // update here when they break. Last verified: 2026-03-17.
    const SELECTORS = {
        // Player container elements
        player: {
            // Main desktop player wrapper (has classList, theme info, etc.)
            container: '#movie_player, .html5-video-player',
            // All video elements on page
            video: 'video',
            // Light theme class on the player element (checked via classList.contains)
            lightThemeClass: 'ytp-light',
        },

        // Ad detection overlays applied to the player
        ads: {
            // Class added when a video ad is playing
            showing: '.ad-showing',
            // Class added when an ad interrupts playback
            interrupting: '.ad-interrupting',
        },

        // Desktop settings cog menu
        settingsMenu: {
            // The popup container for the settings gear menu
            menu: '.ytp-settings-menu',
            // Individual menu rows inside the settings popup
            menuItem: '.ytp-menuitem',
            // All menu items scoped under the settings menu
            menuItems: '.ytp-settings-menu .ytp-menuitem',
            // Label text element within each menu row
            menuItemLabel: '.ytp-menuitem-label',
            // The gear/cog button that opens the settings popup
            button: '.ytp-settings-button',
        },

        // Mobile bottom sheet and menu elements (m.youtube.com)
        mobile: {
            // Bottom sheet container variants (YouTube changes these across updates)
            bottomSheet: 'ytm-bottom-sheet-renderer, ytm-menu-renderer, .bottom-sheet',
            // Clickable menu items inside the bottom sheet
            bottomSheetItems: 'ytm-menu-service-item-renderer, ytm-menu-item, [class*="menu-item"], button',
            // Close/dismiss buttons within the bottom sheet
            bottomSheetClose: 'ytm-bottom-sheet-renderer button.close-button, ytm-bottom-sheet-renderer [aria-label="Close"], .bottom-sheet-header button',
            // Scrim overlay behind the bottom sheet (click to dismiss)
            bottomSheetScrim: '.bottom-sheet-scrim, .scrim',
            // Buttons that open the player settings on mobile
            settingsButton: 'button.player-settings-icon, ytm-menu-renderer button, .player-controls-top button[aria-label]',
        },

        // Shorts-specific selectors
        shorts: {
            // The currently visible Shorts video element
            activeVideo: 'ytd-reel-video-renderer[is-active] video, ytd-shorts video',
            // Shorts container parent (used for MutationObserver on swipe nav)
            container: 'ytd-shorts, ytd-reel-video-renderer',
        },

        // Regular video player selectors (desktop and mobile)
        videoPlayer: {
            // Video element inside the main player area (tried in priority order)
            video: '#movie_player video, .html5-video-player video, ytm-player video, .player-container video',
        },

        // Elements excluded from touch gesture handling (compound selector)
        touchExcluded: [
            // Standard interactive elements
            'button', 'a', 'input', 'textarea', 'select',
            // ARIA role interactive elements
            '[role="button"]', '[role="slider"]', '[role="menu"]', '[role="menuitem"]',
            // YouTube desktop action renderers
            'ytd-menu-renderer', 'ytd-toggle-button-renderer',
            'ytd-like-button-renderer', 'ytd-button-renderer',
            // Engagement panel (comments, description, etc.)
            '.ytd-engagement-panel-section-list-renderer',
            // Desktop action bar buttons
            '#comments-button', '#menu', '#actions',
            // Mobile owner/channel info bar
            'ytm-slim-owner-renderer', '.slim-owner',
            // Shorts overlay action buttons (like, comment, share column)
            '.reel-player-overlay-actions', '.overlay-action-bar',
            'ytd-reel-player-overlay-renderer [id*="action"]',
            '.ytd-reel-multi-format-link-renderer',
            // Mobile-specific exclusions
            'ytm-bottom-sheet-renderer', '.bottom-sheet',
            // Our own speed panel
            '.yts-speed-panel',
            // Mobile player control bars
            '.player-controls-top', '.player-controls-bottom',
            // Mobile comment section
            'ytm-comment-section-renderer',
        ].join(', '),
    };
    // Timing constants (ms)
    const APPLY_SPEED_GUARD_MS = 50;     // guard window after programmatic speed change
    const RATE_CHANGE_DEBOUNCE_MS = 150; // debounce for user-initiated rate changes
    const SPA_NAV_RESCAN_MS = 300;       // delay before rescanning videos after SPA nav
    const SPEED_INDICATOR_MS = 700;      // how long the speed indicator stays visible
    const LONG_PRESS_MS = 400;           // hold duration for Shorts hold-mode
    const MOVE_THRESHOLD = 15;           // movement threshold for hold-mode cancel

    // Shorts speed boost config
    const SHORTS_TAP_MAX_MS  = 300;      // max touch duration to count as tap
    const SHORTS_MOVE_PX     = 10;       // max movement to count as tap
    const SHORTS_BOOST_SPEED = 2.0;      // speed when boost is active
    const DOUBLETAP_GUARD_MS = 250;      // debounce window for double-tap conflict
    const SHORTS_NAV_RESET_OVERLAY_MS = 500; // overlay fade-out after deactivation

    // --- Storage ---
    function getSpeed() {
        const val = parseFloat(GM_getValue(SPEED_KEY, DEFAULT_SPEED));
        if (isNaN(val)) return DEFAULT_SPEED;
        return Math.min(MAX_SPEED, Math.max(MIN_SPEED, val));
    }

    function setSpeed(rate) {
        const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, rate));
        GM_setValue(SPEED_KEY, clamped);
        return clamped;
    }

    // --- Apply speed to all videos ---
    function applySpeedToAll(speed) {
        document.querySelectorAll(SELECTORS.player.video).forEach((v) => {
            isApplyingSpeed = true;
            v.playbackRate = speed;
            setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
        });
    }

    // --- Ad detection ---
    function isAdPlaying() {
        return !!(document.querySelector(SELECTORS.ads.showing) || document.querySelector(SELECTORS.ads.interrupting));
    }

    // --- Video lifecycle ---
    const trackedVideos = new WeakSet();
    let isApplyingSpeed = false;
    let debounceTimer = null;

    function applySpeed(video) {
        const speed = getSpeed();
        if (Math.abs(video.playbackRate - speed) > 0.01) {
            isApplyingSpeed = true;
            video.playbackRate = speed;
            setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
        }
    }

    function onRateChange(video) {
        if (isApplyingSpeed) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (isAdPlaying()) return;
            const current = video.playbackRate;
            if (current >= MIN_SPEED && current <= MAX_SPEED) {
                setSpeed(current);
            }
        }, RATE_CHANGE_DEBOUNCE_MS);
    }

    function trackVideo(video) {
        if (trackedVideos.has(video)) return;
        trackedVideos.add(video);
        video.addEventListener('ratechange', () => onRateChange(video));
        if (!isAdPlaying()) {
            applySpeed(video);
        }
    }

    // --- MutationObserver: watch for new <video> elements ---
    function scanForVideos(root) {
        if (root.nodeName === 'VIDEO') {
            trackVideo(root);
        }
        if (root.querySelectorAll) {
            root.querySelectorAll(SELECTORS.player.video).forEach(trackVideo);
        }
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    scanForVideos(node);
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll(SELECTORS.player.video).forEach(trackVideo);

    // --- SPA navigation ---
    document.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            document.querySelectorAll(SELECTORS.player.video).forEach(trackVideo);
        }, SPA_NAV_RESCAN_MS);
    });

    // --- Desktop keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
            return;
        }

        let delta = 0;
        if (e.key === '[') delta = -SPEED_STEP;
        else if (e.key === ']') delta = SPEED_STEP;
        else return;

        e.preventDefault();
        e.stopPropagation();

        const newSpeed = setSpeed(getSpeed() + delta);
        applySpeedToAll(newSpeed);
        showSpeedIndicator(newSpeed);
    });

    // --- Styles ---
    GM_addStyle(`
        /* ---- Speed indicator (keyboard shortcut overlay) ---- */
        .yt-speed-indicator {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.75);
            color: #fff;
            font-family: YouTube Noto, Roboto, Arial, sans-serif;
            font-size: 28px;
            font-weight: 500;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 999999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
        }
        .yt-speed-indicator.visible {
            opacity: 1;
        }
        /* ---- Shorts speed boost overlay ---- */
        .yt-speed-longpress {
            position: fixed;
            top: 12px;
            left: 12px;
            background: rgba(0, 0, 0, 0.6);
            color: #fff;
            font-family: YouTube Noto, Roboto, Arial, sans-serif;
            font-size: 16px;
            font-weight: 500;
            padding: 4px 10px;
            border-radius: 4px;
            z-index: 999999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
        }
        .yt-speed-longpress.visible {
            opacity: 1;
        }
        .yt-speed-longpress.yt-speed-boost-active {
            border-left: 3px solid #3ea6ff;
            opacity: 1;
            transition: none;
        }

        /* --- Settings cog custom speed panel --- */
        .yts-speed-panel {
            position: absolute;
            bottom: 0;
            right: 0;
            font-family: YouTube Noto, Roboto, Arial, sans-serif;
            font-size: 13px;
            border-radius: 12px;
            overflow: hidden;
            z-index: 999999;
            min-width: 200px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
        }
        .yts-speed-panel.yts-dark {
            background: #282828;
            color: #e8e8e8;
        }
        .yts-speed-panel.yts-light {
            background: #f2f2f2;
            color: #030303;
        }
        .yts-speed-header {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            cursor: pointer;
            font-weight: 500;
            font-size: 14px;
            gap: 8px;
            border-bottom: 1px solid rgba(128, 128, 128, 0.2);
            user-select: none;
        }
        .yts-speed-header:hover {
            background: rgba(128, 128, 128, 0.15);
        }
        .yts-speed-header svg {
            width: 20px;
            height: 20px;
            flex-shrink: 0;
        }
        .yts-dark .yts-speed-header svg { fill: #e8e8e8; }
        .yts-light .yts-speed-header svg { fill: #030303; }
        .yts-speed-list {
            max-height: 300px;
            overflow-y: auto;
            padding: 4px 0;
            scrollbar-width: thin;
        }
        .yts-speed-item {
            display: flex;
            align-items: center;
            padding: 6px 16px 6px 12px;
            cursor: pointer;
            user-select: none;
            gap: 8px;
            min-height: 32px;
        }
        .yts-speed-item:hover,
        .yts-speed-item.yts-focused {
            background: rgba(128, 128, 128, 0.15);
        }
        .yts-speed-item.yts-active {
            font-weight: 600;
        }
        .yts-speed-check {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .yts-dark .yts-speed-check svg { fill: #e8e8e8; }
        .yts-light .yts-speed-check svg { fill: #030303; }
        .yts-speed-label {
            flex: 1;
        }
    `);

    // --- Speed indicator ---
    let indicatorEl = null;
    let indicatorTimeout = null;

    function showSpeedIndicator(speed) {
        if (!indicatorEl) {
            indicatorEl = document.createElement('div');
            indicatorEl.className = 'yt-speed-indicator';
            document.body.appendChild(indicatorEl);
        }
        indicatorEl.textContent = speed.toFixed(2) + 'x';
        indicatorEl.classList.add('visible');
        clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
            indicatorEl.classList.remove('visible');
        }, SPEED_INDICATOR_MS);
    }

    // =========================================================================
    // --- Settings Cog Speed Menu Interceptor ---
    // =========================================================================
    // Intercepts click on YouTube's "Playback speed" menu item in the settings
    // cog and replaces YouTube's speed submenu with a custom panel offering
    // 0.25x to 8x in 0.25 steps. Degrades gracefully if selectors break.
    // =========================================================================

    (function initSettingsInterceptor() {
        const isMobile = location.hostname === 'm.youtube.com';

        let panelEl = null;
        let focusIndex = -1;
        let speedItems = [];

        // Generate speed values from 0.25 to 8.0
        function getSpeedValues() {
            const values = [];
            for (let s = MIN_SPEED; s <= MAX_SPEED; s = Math.round((s + SPEED_STEP) * 100) / 100) {
                values.push(s);
            }
            return values;
        }

        // Detect dark/light theme from the player
        function isDarkTheme() {
            const player = document.querySelector(SELECTORS.player.container);
            if (!player) return true; // default dark
            return !player.classList.contains(SELECTORS.player.lightThemeClass);
        }

        // Find the "Playback speed" menu item in YouTube's settings panel
        function findSpeedMenuItem() {
            if (isMobile) {
                return findMobileSpeedMenuItem();
            }
            const menuItems = document.querySelectorAll(SELECTORS.settingsMenu.menuItems);
            for (const item of menuItems) {
                const label = item.querySelector(SELECTORS.settingsMenu.menuItemLabel);
                if (label) {
                    const text = label.textContent.trim().toLowerCase();
                    if (text.includes('playback speed') || text.includes('speed') || text.includes('vitesse')) {
                        return item;
                    }
                }
            }
            if (menuItems.length > 0) {
                console.warn('[YT-Speed] Settings menu has', menuItems.length, 'items but none matched speed selector — YouTube may have changed their UI');
            }
            return null;
        }

        // Mobile: find speed item inside the bottom sheet
        function findMobileSpeedMenuItem() {
            const sheet = document.querySelector(SELECTORS.mobile.bottomSheet);
            if (!sheet) return null;
            const items = sheet.querySelectorAll(SELECTORS.mobile.bottomSheetItems);
            for (const item of items) {
                const text = item.textContent.trim().toLowerCase();
                if (text.includes('playback speed') || text.includes('speed') || text.includes('vitesse')) {
                    return item;
                }
            }
            return null;
        }

        // Close and remove our custom panel
        function closePanel() {
            if (panelEl) {
                panelEl.remove();
                panelEl = null;
            }
            focusIndex = -1;
            speedItems = [];
        }

        // Format speed for display
        function formatSpeed(val) {
            if (val === 1.0) return 'Normal';
            // Show clean numbers: 0.25, 0.5, 1.5, 2, etc.
            return val % 1 === 0 ? val.toString() + 'x' : val.toFixed(2).replace(/0$/, '') + 'x';
        }

        // Select a speed from the panel
        function selectSpeed(speed) {
            const newSpeed = setSpeed(speed);
            applySpeedToAll(newSpeed);
            showSpeedIndicator(newSpeed);
            closePanel();
            if (!isMobile) {
                // Also close YouTube's settings popup on desktop
                const settingsBtn = document.querySelector(SELECTORS.settingsMenu.button);
                if (settingsBtn) settingsBtn.click();
            }
        }

        // Go back to YouTube's top-level settings menu
        function goBack() {
            closePanel();
            if (isMobile) {
                // On mobile, re-open the player settings via the 3-dot menu
                const menuBtn = document.querySelector(SELECTORS.mobile.settingsButton);
                if (menuBtn) setTimeout(() => menuBtn.click(), 50);
            } else {
                const settingsBtn = document.querySelector(SELECTORS.settingsMenu.button);
                if (settingsBtn) {
                    settingsBtn.click();
                    setTimeout(() => settingsBtn.click(), 50);
                }
            }
        }

        // Build and display the custom speed panel
        function showPanel() {
            closePanel(); // clear any existing

            const dark = isDarkTheme();
            const currentSpeed = getSpeed();
            const speeds = getSpeedValues();

            panelEl = document.createElement('div');
            panelEl.className = 'yts-speed-panel ' + (dark ? 'yts-dark' : 'yts-light');

            // Back button header
            const header = document.createElement('div');
            header.className = 'yts-speed-header';
            header.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                <span>Playback speed</span>
            `;
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                goBack();
            });
            panelEl.appendChild(header);

            // Speed list
            const list = document.createElement('div');
            list.className = 'yts-speed-list';

            speedItems = [];
            let activeIndex = -1;

            speeds.forEach((speed, i) => {
                const item = document.createElement('div');
                item.className = 'yts-speed-item';
                item.setAttribute('data-speed', speed);

                const isActive = Math.abs(speed - currentSpeed) < 0.01;
                if (isActive) {
                    item.classList.add('yts-active');
                    activeIndex = i;
                }

                const checkDiv = document.createElement('div');
                checkDiv.className = 'yts-speed-check';
                if (isActive) {
                    checkDiv.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
                }

                const labelDiv = document.createElement('div');
                labelDiv.className = 'yts-speed-label';
                labelDiv.textContent = formatSpeed(speed);

                item.appendChild(checkDiv);
                item.appendChild(labelDiv);

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectSpeed(speed);
                });

                list.appendChild(item);
                speedItems.push(item);
            });

            panelEl.appendChild(list);

            // Position: anchor to settings menu location within the player
            if (isMobile) {
                // On mobile, position as a full-width bottom sheet
                panelEl.style.position = 'fixed';
                panelEl.style.bottom = '0';
                panelEl.style.left = '0';
                panelEl.style.right = '0';
                panelEl.style.borderRadius = '12px 12px 0 0';
                panelEl.style.minWidth = '100%';
                panelEl.style.maxHeight = '60vh';
                panelEl.style.overflowY = 'auto';
                document.body.appendChild(panelEl);
            } else {
                const player = document.querySelector(SELECTORS.player.container);
                if (player) {
                    player.appendChild(panelEl);
                } else {
                    document.body.appendChild(panelEl);
                }
            }

            // Scroll the active item into view
            if (activeIndex >= 0 && speedItems[activeIndex]) {
                setTimeout(() => {
                    speedItems[activeIndex].scrollIntoView({ block: 'center', behavior: 'instant' });
                }, 0);
            }

            // Set up outside-click dismissal
            setTimeout(() => {
                document.addEventListener('click', onOutsideClick, { capture: true });
            }, 0);
        }

        // --- Panel lifecycle ---
        function onOutsideClick(e) {
            if (panelEl && !panelEl.contains(e.target)) {
                closePanel();
                document.removeEventListener('click', onOutsideClick, { capture: true });
            }
        }

        // Keyboard navigation within the panel
        function onPanelKeydown(e) {
            if (!panelEl) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                goBack();
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();

                // Remove old focus
                if (focusIndex >= 0 && speedItems[focusIndex]) {
                    speedItems[focusIndex].classList.remove('yts-focused');
                }

                if (e.key === 'ArrowDown') {
                    focusIndex = focusIndex < speedItems.length - 1 ? focusIndex + 1 : 0;
                } else {
                    focusIndex = focusIndex > 0 ? focusIndex - 1 : speedItems.length - 1;
                }

                speedItems[focusIndex].classList.add('yts-focused');
                speedItems[focusIndex].scrollIntoView({ block: 'nearest', behavior: 'instant' });
                return;
            }

            if (e.key === 'Enter' && focusIndex >= 0 && speedItems[focusIndex]) {
                e.preventDefault();
                e.stopPropagation();
                const speed = parseFloat(speedItems[focusIndex].getAttribute('data-speed'));
                selectSpeed(speed);
            }
        }

        document.addEventListener('keydown', onPanelKeydown, { capture: true });

        // --- Interception logic ---
        // Watch for the settings menu to appear, then intercept the speed item click

        function isSpeedText(text) {
            const t = text.trim().toLowerCase();
            return t.includes('playback speed') || t.includes('speed') || t.includes('vitesse');
        }

        // Desktop interception
        function interceptSpeedClick(e) {
            const menuItem = e.target.closest(SELECTORS.settingsMenu.menuItem);
            if (!menuItem) return;

            const label = menuItem.querySelector(SELECTORS.settingsMenu.menuItemLabel);
            if (!label) return;
            if (!isSpeedText(label.textContent)) return;

            e.stopPropagation();
            e.preventDefault();

            const settingsBtn = document.querySelector(SELECTORS.settingsMenu.button);
            if (settingsBtn) settingsBtn.click();

            setTimeout(() => showPanel(), 50);
        }

        // Mobile interception: intercept clicks in the bottom sheet
        function interceptMobileSpeedClick(e) {
            // Walk up from clicked element looking for a menu item containing "speed"
            let el = e.target;
            for (let i = 0; i < 6 && el; i++) {
                if (isSpeedText(el.textContent || '')) {
                    // Make sure this is a menu item, not the whole sheet
                    const tag = el.tagName?.toLowerCase() || '';
                    if (tag.includes('renderer') || tag === 'button' || tag === 'div' ||
                        el.getAttribute('role') === 'option' || el.getAttribute('role') === 'menuitem' ||
                        el.classList?.contains('menu-item-button')) {
                        e.stopPropagation();
                        e.preventDefault();

                        // Close the bottom sheet
                        const closeBtn = document.querySelector(SELECTORS.mobile.bottomSheetClose);
                        if (closeBtn) closeBtn.click();
                        // Also try clicking outside the sheet to dismiss
                        const scrim = document.querySelector(SELECTORS.mobile.bottomSheetScrim);
                        if (scrim) scrim.click();

                        setTimeout(() => showPanel(), 100);
                        return;
                    }
                }
                el = el.parentElement;
            }
        }

        // Attach interceptors to the appropriate menu container
        function attachInterceptor() {
            if (isMobile) {
                attachMobileInterceptor();
            } else {
                const settingsMenu = document.querySelector(SELECTORS.settingsMenu.menu);
                if (settingsMenu && !settingsMenu._ytsIntercepted) {
                    settingsMenu._ytsIntercepted = true;
                    settingsMenu.addEventListener('click', interceptSpeedClick, { capture: true });
                }
            }
        }

        function attachMobileInterceptor() {
            const sheet = document.querySelector(SELECTORS.mobile.bottomSheet);
            if (sheet && !sheet._ytsIntercepted) {
                sheet._ytsIntercepted = true;
                sheet.addEventListener('click', interceptMobileSpeedClick, { capture: true });
                sheet.addEventListener('touchend', interceptMobileSpeedClick, { capture: true });
            }
        }

        // Watch for settings menu / bottom sheet appearing
        const settingsObserver = new MutationObserver(() => {
            attachInterceptor();
        });

        function startObserving() {
            if (isMobile) {
                // On mobile, observe body for bottom sheet appearance
                settingsObserver.observe(document.body, { childList: true, subtree: true });
                attachInterceptor();
            } else {
                const player = document.querySelector(SELECTORS.player.container);
                const target = player || document.body;
                settingsObserver.observe(target, { childList: true, subtree: true });
                attachInterceptor();
            }
        }

        // Wait for player or start immediately on mobile
        if (isMobile) {
            startObserving();
        } else if (document.querySelector(SELECTORS.player.container)) {
            startObserving();
        } else {
            const waitForPlayer = new MutationObserver(() => {
                if (document.querySelector(SELECTORS.player.container)) {
                    waitForPlayer.disconnect();
                    startObserving();
                }
            });
            waitForPlayer.observe(document.body, { childList: true, subtree: true });
        }

        // Re-attach on SPA navigation
        document.addEventListener('yt-navigate-finish', () => {
            setTimeout(() => {
                if (isMobile) {
                    // Reset any existing bottom sheet interception
                    document.querySelectorAll(SELECTORS.mobile.bottomSheet)
                        .forEach(el => { el._ytsIntercepted = false; });
                } else {
                    const settingsMenu = document.querySelector(SELECTORS.settingsMenu.menu);
                    if (settingsMenu) {
                        settingsMenu._ytsIntercepted = false;
                    }
                }
                attachInterceptor();
            }, 500);
        });

        // Also close our panel when YouTube's settings popup closes
        const popupObserver = new MutationObserver(() => {
            if (!panelEl) return;
            const settingsMenu = document.querySelector(SELECTORS.settingsMenu.menu);
            if (settingsMenu) {
                const isVisible = settingsMenu.style.display !== 'none' &&
                    settingsMenu.offsetParent !== null;
                // If YouTube's settings menu is gone but our panel is up, leave it —
                // we closed the YT menu intentionally. Only close if user dismissed elsewhere.
            }
        });

        // Observe settings button for aria-expanded changes
        const checkSettingsBtn = () => {
            const btn = document.querySelector(SELECTORS.settingsMenu.button);
            if (btn && !btn._ytsObserved) {
                btn._ytsObserved = true;
                const attrObserver = new MutationObserver(() => {
                    // If settings button is no longer "active" and our panel exists,
                    // it may mean user clicked away
                    if (panelEl && btn.getAttribute('aria-expanded') === 'false') {
                        // Don't close here — we handle it via outside-click
                    }
                });
                attrObserver.observe(btn, { attributes: true, attributeFilter: ['aria-expanded'] });
            }
        };
        setTimeout(checkSettingsBtn, 1000);
        document.addEventListener('yt-navigate-finish', () => setTimeout(checkSettingsBtn, 1000));

        console.log('[YT-Speed] Settings cog interceptor initialized');
    })();

    // --- Mobile speed boost (touch gestures) ---
    // Shorts: tap left half to activate 2x, tap or long press to deactivate.
    // Regular videos (mobile): long press to toggle 2x on/off.
    if (navigator.maxTouchPoints > 0) {
        let startX = 0;
        let startY = 0;
        let touchStartTime = 0;
        let swipedAway = false;
        let boostState = 'idle'; // 'idle' | 'boosted'
        let tapDebounceTimer = null;
        let longPressTimer = null;
        let gestureConsumed = false;
        let boostOverlay = null;
        let lastActiveVideo = null;

        function isOnShorts() {
            return window.location.pathname.includes('/shorts/');
        }

        function isOnVideo() {
            return window.location.pathname.startsWith('/watch') ||
                   window.location.pathname.includes('/shorts/');
        }

        // Find the active video element
        function getActiveVideo() {
            if (isOnShorts()) {
                const active = document.querySelector(SELECTORS.shorts.activeVideo);
                return active || document.querySelector(SELECTORS.player.video);
            }
            // Regular video: find the main player video
            const playerVideo = document.querySelector(SELECTORS.videoPlayer.video);
            return playerVideo || document.querySelector(SELECTORS.player.video);
        }

        function getBoostOverlay() {
            if (!boostOverlay) {
                boostOverlay = document.createElement('div');
                boostOverlay.className = 'yt-speed-longpress';
                document.body.appendChild(boostOverlay);
            }
            return boostOverlay;
        }

        function updateOverlay() {
            const overlay = getBoostOverlay();
            if (boostState === 'boosted') {
                overlay.textContent = SHORTS_BOOST_SPEED + 'x';
                overlay.classList.add('visible', 'yt-speed-boost-active');
            } else {
                overlay.textContent = '1x';
                overlay.classList.remove('yt-speed-boost-active');
                overlay.classList.add('visible');
                setTimeout(() => { overlay.classList.remove('visible'); }, SHORTS_NAV_RESET_OVERLAY_MS);
            }
        }

        function activateBoost() {
            if (boostState === 'boosted') return;
            const video = getActiveVideo();
            if (!video) return;
            boostState = 'boosted';
            isApplyingSpeed = true;
            video.playbackRate = SHORTS_BOOST_SPEED;
            setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
            updateOverlay();
            console.log('[YT-Speed] Boost ON');
        }

        function deactivateBoost() {
            if (boostState === 'idle') return;
            boostState = 'idle';
            const video = getActiveVideo();
            if (video) {
                const restoreSpeed = isOnShorts() ? DEFAULT_SPEED : getSpeed();
                isApplyingSpeed = true;
                video.playbackRate = restoreSpeed;
                setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
            }
            updateOverlay();
            console.log('[YT-Speed] Boost OFF');
        }

        function handleTap() {
            if (boostState === 'idle') {
                activateBoost();
            } else {
                deactivateBoost();
            }
        }

        function isExcludedTarget(target) {
            return target.closest(SELECTORS.touchExcluded);
        }

        // Check if touch is on/near the video area (for regular videos on mobile)
        function isTouchOnVideo(touch) {
            const video = getActiveVideo();
            if (!video) return false;
            const rect = video.getBoundingClientRect();
            return touch.clientY >= rect.top && touch.clientY <= rect.bottom &&
                   touch.clientX >= rect.left && touch.clientX <= rect.right;
        }

        document.addEventListener('touchstart', (e) => {
            if (!isOnVideo()) return;
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            if (isExcludedTarget(e.target)) return;

            const onShorts = isOnShorts();

            // Shorts: only left half
            if (onShorts && touch.clientX >= window.innerWidth / 2) return;

            // Regular videos: touch must be on the video area
            if (!onShorts && !isTouchOnVideo(touch)) return;

            startX = touch.clientX;
            startY = touch.clientY;
            touchStartTime = Date.now();
            swipedAway = false;
            gestureConsumed = false;

            if (onShorts) {
                // Shorts: long-press to deactivate when boosted
                if (boostState === 'boosted') {
                    longPressTimer = setTimeout(() => {
                        longPressTimer = null;
                        gestureConsumed = true;
                        deactivateBoost();
                    }, LONG_PRESS_MS);
                }
            } else {
                // Regular videos: long-press toggles 2x on/off
                longPressTimer = setTimeout(() => {
                    longPressTimer = null;
                    gestureConsumed = true;
                    handleTap();
                }, LONG_PRESS_MS);
            }
        }, { capture: true, passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isOnVideo()) return;
            const touch = e.touches[0];
            const dx = Math.abs(touch.clientX - startX);
            const dy = Math.abs(touch.clientY - startY);

            if (dx > SHORTS_MOVE_PX || dy > SHORTS_MOVE_PX) {
                swipedAway = true;
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }
        }, { capture: true, passive: true });

        document.addEventListener('touchend', (e) => {
            if (!isOnVideo()) return;

            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }

            if (gestureConsumed) {
                gestureConsumed = false;
                return;
            }

            // Shorts: tap on left half toggles boost
            if (isOnShorts()) {
                const elapsed = Date.now() - touchStartTime;
                if (elapsed < SHORTS_TAP_MAX_MS && !swipedAway) {
                    if (tapDebounceTimer) {
                        clearTimeout(tapDebounceTimer);
                        tapDebounceTimer = null;
                        return;
                    }
                    tapDebounceTimer = setTimeout(() => {
                        tapDebounceTimer = null;
                        handleTap();
                    }, DOUBLETAP_GUARD_MS);
                }
            }
            // Regular videos: only long-press triggers boost (handled in touchstart timer)
        }, { capture: true, passive: true });

        document.addEventListener('touchcancel', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            swipedAway = true;
            gestureConsumed = false;
        }, { capture: true, passive: true });

        // Reset boost on SPA navigation
        function resetBoostState() {
            if (boostState === 'boosted') {
                deactivateBoost();
            }
            clearTimeout(tapDebounceTimer);
            tapDebounceTimer = null;
        }

        document.addEventListener('yt-navigate-finish', resetBoostState);

        // MutationObserver for Shorts swipe navigation
        let shortsNavDebounce = null;
        const shortsContainer = () =>
            document.querySelector(SELECTORS.shorts.container)?.parentElement;

        function checkActiveVideoChanged() {
            const currentVideo = getActiveVideo();
            if (currentVideo && currentVideo !== lastActiveVideo) {
                lastActiveVideo = currentVideo;
                if (boostState === 'boosted') {
                    resetBoostState();
                    console.log('[YT-Speed] Video changed, reset boost');
                }
            }
        }

        const shortsNavObserver = new MutationObserver(() => {
            if (!isOnShorts()) return;
            clearTimeout(shortsNavDebounce);
            shortsNavDebounce = setTimeout(checkActiveVideoChanged, 200);
        });

        let observingShorts = false;
        function updateShortsObserver() {
            if (isOnShorts() && !observingShorts) {
                const container = shortsContainer();
                if (container) {
                    shortsNavObserver.observe(container, { childList: true });
                    observingShorts = true;
                    lastActiveVideo = getActiveVideo();
                }
            } else if (!isOnShorts() && observingShorts) {
                shortsNavObserver.disconnect();
                observingShorts = false;
            }
        }

        document.addEventListener('yt-navigate-finish', () => {
            setTimeout(updateShortsObserver, SPA_NAV_RESCAN_MS);
        });
        setTimeout(updateShortsObserver, 1000);
    }

    console.log('[YT-Speed] v13 loaded — stored speed:', getSpeed() + 'x');
})();
