// ==UserScript==
// @name         YouTube Speed Controller
// @namespace    https://github.com/npezarro/youtubeSpeedSetAndRemember
// @version      11.0
// @description  Persists playback speed across sessions. Desktop keyboard shortcuts ([ / ]). Mobile Shorts tap left side to toggle 2x. Settings cog custom speed menu (0.25x–8x).
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
    // Timing constants (ms)
    const APPLY_SPEED_GUARD_MS = 50;     // guard window after programmatic speed change
    const RATE_CHANGE_DEBOUNCE_MS = 150; // debounce for user-initiated rate changes
    const SPA_NAV_RESCAN_MS = 300;       // delay before rescanning videos after SPA nav
    const SPEED_INDICATOR_MS = 700;      // how long the speed indicator stays visible
    const LONG_PRESS_MS = 400;           // hold duration for Shorts hold-mode
    const MOVE_THRESHOLD = 15;           // movement threshold for hold-mode cancel

    // Shorts tap-to-toggle config
    const SHORTS_SPEED_MODE  = 'tap';    // 'tap' or 'hold'
    const SHORTS_TAP_MAX_MS  = 200;      // max touch duration to count as tap
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
        document.querySelectorAll('video').forEach((v) => {
            isApplyingSpeed = true;
            v.playbackRate = speed;
            setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
        });
    }

    // --- Ad detection ---
    function isAdPlaying() {
        return !!(document.querySelector('.ad-showing') || document.querySelector('.ad-interrupting'));
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
            root.querySelectorAll('video').forEach(trackVideo);
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
    document.querySelectorAll('video').forEach(trackVideo);

    // --- SPA navigation ---
    document.addEventListener('yt-navigate-finish', () => {
        setTimeout(() => {
            document.querySelectorAll('video').forEach(trackVideo);
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
        // Only on desktop YouTube
        if (location.hostname === 'm.youtube.com') return;

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
            const player = document.querySelector('#movie_player, .html5-video-player');
            if (!player) return true; // default dark
            return !player.classList.contains('ytp-light');
        }

        // Find the "Playback speed" menu item in YouTube's settings panel
        function findSpeedMenuItem() {
            const menuItems = document.querySelectorAll('.ytp-settings-menu .ytp-menuitem');
            for (const item of menuItems) {
                const label = item.querySelector('.ytp-menuitem-label');
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
            // Also close YouTube's settings popup
            const settingsBtn = document.querySelector('.ytp-settings-button');
            if (settingsBtn) settingsBtn.click();
        }

        // Go back to YouTube's top-level settings menu
        function goBack() {
            closePanel();
            // Reopen YouTube's settings by clicking the cog
            const settingsBtn = document.querySelector('.ytp-settings-button');
            if (settingsBtn) {
                settingsBtn.click();
                // Need a double-click: one to close, one to reopen
                setTimeout(() => settingsBtn.click(), 50);
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
            const player = document.querySelector('#movie_player, .html5-video-player');
            if (player) {
                player.appendChild(panelEl);
            } else {
                document.body.appendChild(panelEl);
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
        function interceptSpeedClick(e) {
            const menuItem = e.target.closest('.ytp-menuitem');
            if (!menuItem) return;

            // Check if this is the speed menu item
            const label = menuItem.querySelector('.ytp-menuitem-label');
            if (!label) return;
            const text = label.textContent.trim().toLowerCase();
            if (!text.includes('playback speed') && !text.includes('speed') && !text.includes('vitesse')) return;

            // It's the speed item — intercept!
            e.stopPropagation();
            e.preventDefault();

            // Close YouTube's settings popup
            const settingsBtn = document.querySelector('.ytp-settings-button');
            if (settingsBtn) settingsBtn.click();

            // Show our custom panel
            setTimeout(() => showPanel(), 50);
        }

        // Attach the interceptor to the settings menu container
        // Use MutationObserver to catch when the settings menu appears
        function attachInterceptor() {
            const settingsMenu = document.querySelector('.ytp-settings-menu');
            if (settingsMenu && !settingsMenu._ytsIntercepted) {
                settingsMenu._ytsIntercepted = true;
                settingsMenu.addEventListener('click', interceptSpeedClick, { capture: true });
            }
        }

        // Watch for settings menu appearing
        const settingsObserver = new MutationObserver(() => {
            attachInterceptor();
        });

        // Observe the player or body for settings menu appearance
        function startObserving() {
            const player = document.querySelector('#movie_player, .html5-video-player');
            const target = player || document.body;
            settingsObserver.observe(target, { childList: true, subtree: true });
            attachInterceptor(); // try immediately too
        }

        // Wait for the player to exist
        if (document.querySelector('#movie_player, .html5-video-player')) {
            startObserving();
        } else {
            const waitForPlayer = new MutationObserver(() => {
                if (document.querySelector('#movie_player, .html5-video-player')) {
                    waitForPlayer.disconnect();
                    startObserving();
                }
            });
            waitForPlayer.observe(document.body, { childList: true, subtree: true });
        }

        // Re-attach on SPA navigation
        document.addEventListener('yt-navigate-finish', () => {
            setTimeout(() => {
                // Reset interception flag on new settings menus
                const settingsMenu = document.querySelector('.ytp-settings-menu');
                if (settingsMenu) {
                    settingsMenu._ytsIntercepted = false;
                    attachInterceptor();
                }
            }, 500);
        });

        // Also close our panel when YouTube's settings popup closes
        const popupObserver = new MutationObserver(() => {
            if (!panelEl) return;
            const settingsMenu = document.querySelector('.ytp-settings-menu');
            if (settingsMenu) {
                const isVisible = settingsMenu.style.display !== 'none' &&
                    settingsMenu.offsetParent !== null;
                // If YouTube's settings menu is gone but our panel is up, leave it —
                // we closed the YT menu intentionally. Only close if user dismissed elsewhere.
            }
        });

        // Observe settings button for aria-expanded changes
        const checkSettingsBtn = () => {
            const btn = document.querySelector('.ytp-settings-button');
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

    // --- Shorts speed boost (left side) ---
    if (navigator.maxTouchPoints > 0) {
        let startX = 0;
        let startY = 0;
        let touchStartTime = 0;
        let swipedAway = false;
        let preLongPressSpeed = DEFAULT_SPEED;
        let shortsBoostActive = false;
        let tapDebounceTimer = null;
        let longPressTimer = null;
        let isLongPressing = false;
        let boostOverlay = null;

        function isOnShorts() {
            return window.location.pathname.includes('/shorts/');
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
            if (shortsBoostActive) {
                overlay.textContent = SHORTS_BOOST_SPEED + 'x';
                overlay.classList.add('visible', 'yt-speed-boost-active');
            } else {
                overlay.textContent = '1x';
                overlay.classList.remove('yt-speed-boost-active');
                overlay.classList.add('visible');
                setTimeout(() => { overlay.classList.remove('visible'); }, SHORTS_NAV_RESET_OVERLAY_MS);
            }
        }

        function toggleShortsBoost() {
            shortsBoostActive = !shortsBoostActive;
            const video = document.querySelector('video');
            if (!video) return;
            isApplyingSpeed = true;
            if (shortsBoostActive) {
                preLongPressSpeed = video.playbackRate;
                video.playbackRate = SHORTS_BOOST_SPEED;
            } else {
                video.playbackRate = preLongPressSpeed;
            }
            setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
            updateOverlay();
            console.log(`[YT-Speed] Shorts boost ${shortsBoostActive ? 'ON' : 'OFF'}`);
        }

        // Hold mode helpers (fallback)
        function startLongPress() {
            isLongPressing = true;
            const video = document.querySelector('video');
            if (video) {
                preLongPressSpeed = video.playbackRate;
                isApplyingSpeed = true;
                video.playbackRate = SHORTS_BOOST_SPEED;
                setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
            }
            const overlay = getBoostOverlay();
            overlay.textContent = SHORTS_BOOST_SPEED + 'x';
            overlay.classList.add('visible');
        }

        function endLongPress() {
            if (!isLongPressing) return;
            isLongPressing = false;
            const video = document.querySelector('video');
            if (video) {
                isApplyingSpeed = true;
                video.playbackRate = preLongPressSpeed;
                setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
            }
            getBoostOverlay().classList.remove('visible');
        }

        function isExcludedTarget(target) {
            return target.closest(
                'button, a, input, textarea, [role="button"], ytd-menu-renderer, ' +
                '.ytd-engagement-panel-section-list-renderer, #comments-button'
            );
        }

        document.addEventListener('touchstart', (e) => {
            if (!isOnShorts()) return;
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            if (touch.clientX >= window.innerWidth / 2) return;
            if (isExcludedTarget(e.target)) return;

            startX = touch.clientX;
            startY = touch.clientY;
            touchStartTime = Date.now();
            swipedAway = false;

            if (SHORTS_SPEED_MODE === 'hold') {
                longPressTimer = setTimeout(() => { startLongPress(); }, LONG_PRESS_MS);
            }
        }, { capture: true, passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!isOnShorts()) return;
            const touch = e.touches[0];
            const dx = Math.abs(touch.clientX - startX);
            const dy = Math.abs(touch.clientY - startY);

            if (SHORTS_SPEED_MODE === 'tap') {
                if (dx > SHORTS_MOVE_PX || dy > SHORTS_MOVE_PX) {
                    swipedAway = true;
                }
            } else {
                if ((longPressTimer || isLongPressing) && (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD)) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                    endLongPress();
                }
            }
        }, { capture: true, passive: true });

        document.addEventListener('touchend', (e) => {
            if (!isOnShorts()) return;

            if (SHORTS_SPEED_MODE === 'tap') {
                const elapsed = Date.now() - touchStartTime;
                if (elapsed < SHORTS_TAP_MAX_MS && !swipedAway) {
                    // Cancel any pending tap (double-tap guard)
                    if (tapDebounceTimer) {
                        clearTimeout(tapDebounceTimer);
                        tapDebounceTimer = null;
                        // Double-tap detected — let YouTube handle it
                        return;
                    }
                    // Start debounce — commit toggle if no second tap arrives
                    tapDebounceTimer = setTimeout(() => {
                        tapDebounceTimer = null;
                        toggleShortsBoost();
                    }, DOUBLETAP_GUARD_MS);
                }
            } else {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                endLongPress();
            }
        }, { capture: true, passive: true });

        document.addEventListener('touchcancel', () => {
            if (SHORTS_SPEED_MODE === 'hold') {
                clearTimeout(longPressTimer);
                longPressTimer = null;
                endLongPress();
            }
            swipedAway = true;
        }, { capture: true, passive: true });

        // Reset boost state on navigation (prevents leaking across Shorts)
        document.addEventListener('yt-navigate-finish', () => {
            if (shortsBoostActive) {
                shortsBoostActive = false;
                const video = document.querySelector('video');
                if (video) {
                    isApplyingSpeed = true;
                    video.playbackRate = preLongPressSpeed;
                    setTimeout(() => { isApplyingSpeed = false; }, APPLY_SPEED_GUARD_MS);
                }
                getBoostOverlay().classList.remove('visible', 'yt-speed-boost-active');
            }
            clearTimeout(tapDebounceTimer);
            tapDebounceTimer = null;
        });
    }

    console.log('[YT-Speed] v11 loaded — stored speed:', getSpeed() + 'x');
})();
