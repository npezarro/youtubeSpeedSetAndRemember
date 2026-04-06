// ==UserScript==
// @name         YouTube Speed Controller
// @namespace    https://github.com/npezarro/youtubeSpeedSetAndRemember
// @version      19.0
// @description  Floating speed toggle with expandable slider for all video types (watch, Shorts, fullscreen). Mobile + desktop. Keyboard shortcuts ([ / ]). Persists speed.
// @author       npezarro
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/npezarro/youtubeSpeedSetAndRemember/main/script.js
// @downloadURL  https://raw.githubusercontent.com/npezarro/youtubeSpeedSetAndRemember/main/script.js
// ==/UserScript==

(function () {
    'use strict';

    // ── Config ──────────────────────────────────────────────────────
    const SPEED_KEY = 'yt_speed';
    const DEFAULT_SPEED = 1.0;
    const MIN_SPEED = 0.25;
    const MAX_SPEED = 8.0;
    const SPEED_STEP = 0.25;
    const SHORTS_BOOST = 2.0;
    const SLIDER_MIN = 1.0;
    const SLIDER_MAX = 8.0;
    const PRESET_SPEEDS = [1.25, 1.5, 2, 2.5, 3, 4];
    const SLIDER_IDLE_TIMEOUT = 3000;

    // ── Storage ─────────────────────────────────────────────────────
    function getSpeed() {
        const val = parseFloat(GM_getValue(SPEED_KEY, DEFAULT_SPEED));
        return isNaN(val) ? DEFAULT_SPEED : Math.min(MAX_SPEED, Math.max(MIN_SPEED, val));
    }

    // Session speed for Shorts: persists across swipes until page leave
    let sessionSpeed = null;

    function setSpeed(rate) {
        const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, rate));
        GM_setValue(SPEED_KEY, clamped);
        if (isOnShorts()) sessionSpeed = clamped;
        return clamped;
    }

    // ── Helpers ──────────────────────────────────────────────────────
    let applyingSpeedCount = 0;

    function applyToAll(speed) {
        document.querySelectorAll('video').forEach(v => {
            applyingSpeedCount++;
            v.playbackRate = speed;
            setTimeout(() => { applyingSpeedCount--; }, 50);
        });
    }

    function isAdPlaying() {
        return !!(document.querySelector('.ad-showing') || document.querySelector('.ad-interrupting'));
    }

    function isMobile() {
        return location.hostname === 'm.youtube.com'
            || !!document.querySelector('ytm-app');
    }

    function isOnShorts() {
        return location.pathname.includes('/shorts/');
    }

    function isOnWatch() {
        return location.pathname.startsWith('/watch');
    }

    function formatSpeed(s) {
        return s % 1 === 0 ? s + 'x' : s.toFixed(2).replace(/0$/, '') + 'x';
    }

    // ── Track videos (persist speed) ────────────────────────────────
    const tracked = new WeakSet();
    let debounceTimer = null;

    function trackVideo(video) {
        if (tracked.has(video)) return;
        tracked.add(video);
        video.addEventListener('ratechange', () => {
            if (applyingSpeedCount > 0 || isAdPlaying()) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const r = video.playbackRate;
                if (r >= MIN_SPEED && r <= MAX_SPEED) setSpeed(r);
            }, 150);
        });
        if (!isAdPlaying() && !isOnShorts()) {
            applyingSpeedCount++;
            video.playbackRate = getSpeed();
            setTimeout(() => { applyingSpeedCount--; }, 50);
        }
    }

    function scanVideos() {
        document.querySelectorAll('video').forEach(trackVideo);
    }

    const observer = new MutationObserver(() => {
        scanVideos();
        if (toggleEl && !toggleEl.parentElement) {
            collapseSlider();
            injectToggle();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scanVideos();
    document.addEventListener('yt-navigate-finish', () => setTimeout(scanVideos, 300));

    // ── Health check ────────────────────────────────────────────────
    let healthFailCount = 0;
    document.addEventListener('yt-navigate-finish', () => {
        if (!isOnShorts() && !isOnWatch()) return;
        setTimeout(() => {
            if (toggleEl && toggleEl.offsetHeight === 0) {
                healthFailCount++;
                if (healthFailCount >= 3) {
                    console.warn('[YT-Speed] Toggle has zero height after 3 navigations — YouTube DOM may have changed');
                }
            } else {
                healthFailCount = 0;
            }
        }, 1000);
    });

    // ── Desktop keyboard shortcuts ──────────────────────────────────
    document.addEventListener('keydown', e => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

        let delta = 0;
        if (e.key === '[') delta = -SPEED_STEP;
        else if (e.key === ']') delta = SPEED_STEP;
        else return;

        e.preventDefault();
        e.stopPropagation();
        const s = setSpeed(getSpeed() + delta);
        applyToAll(s);
        showIndicator(s);
        updateToggle();
        if (sliderExpanded) updateSliderPosition(s);
    });

    // ── Speed indicator (center overlay for keyboard) ───────────────
    let indicatorEl = null;
    let indicatorTimer = null;

    function showIndicator(speed) {
        if (!indicatorEl) {
            indicatorEl = document.createElement('div');
            indicatorEl.className = 'yts-indicator';
            document.body.appendChild(indicatorEl);
        }
        indicatorEl.textContent = formatSpeed(speed);
        indicatorEl.classList.add('visible');
        clearTimeout(indicatorTimer);
        indicatorTimer = setTimeout(() => indicatorEl.classList.remove('visible'), 700);
    }

    // ── Slider state ────────────────────────────────────────────────
    let sliderExpanded = false;
    let sliderPanel = null;
    let sliderTrack = null;
    let sliderThumb = null;
    let sliderLabel = null;
    let sliderIdleTimer = null;
    let pointerCaptureTimeout = null;

    function collapseSlider() {
        sliderExpanded = false;
        if (sliderPanel) {
            sliderPanel.classList.remove('expanded');
        }
        if (toggleEl) {
            toggleEl.classList.remove('slider-open');
        }
        clearTimeout(sliderIdleTimer);
        clearTimeout(pointerCaptureTimeout);
        // Release any stuck pointer capture
        if (sliderThumb && sliderThumb.hasPointerCapture) {
            try { sliderThumb.releasePointerCapture(sliderThumb._capturedPointerId); } catch (_) {}
        }
    }

    function expandSlider() {
        sliderExpanded = true;
        if (!sliderPanel) buildSliderPanel();
        if (toggleEl) {
            toggleEl.classList.add('slider-open');
            // Ensure panel is child of toggle's parent container
            const container = toggleEl.parentElement;
            if (container && sliderPanel.parentElement !== container) {
                container.appendChild(sliderPanel);
            }
        }
        const video = document.querySelector('video');
        const currentRate = video ? video.playbackRate : getSpeed();
        updateSliderPosition(currentRate);
        sliderPanel.classList.add('expanded');
        resetSliderIdleTimer();
    }

    function resetSliderIdleTimer() {
        clearTimeout(sliderIdleTimer);
        sliderIdleTimer = setTimeout(collapseSlider, SLIDER_IDLE_TIMEOUT);
    }

    function speedToPercent(speed) {
        return Math.max(0, Math.min(1, (speed - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)));
    }

    function percentToSpeed(pct) {
        const raw = SLIDER_MIN + pct * (SLIDER_MAX - SLIDER_MIN);
        // Snap to nearest 0.25
        return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.round(raw * 4) / 4));
    }

    function updateSliderPosition(speed) {
        if (!sliderThumb || !sliderTrack) return;
        const pct = speedToPercent(speed);
        sliderThumb.style.left = (pct * 100) + '%';
        // Fill track up to thumb
        sliderTrack.style.setProperty('--fill', (pct * 100) + '%');
        if (sliderLabel) sliderLabel.textContent = formatSpeed(speed);
        // Update aria
        sliderThumb.setAttribute('aria-valuenow', speed);
        // Highlight active preset
        if (sliderPanel) {
            sliderPanel.querySelectorAll('.yts-preset').forEach(btn => {
                const presetSpeed = parseFloat(btn.dataset.speed);
                btn.classList.toggle('active', Math.abs(presetSpeed - speed) < 0.05);
            });
        }
    }

    function applySliderSpeed(speed) {
        const clamped = Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, speed));
        const s = setSpeed(clamped);
        applyToAll(s);
        updateToggle();
        updateSliderPosition(s);
        resetSliderIdleTimer();
    }

    function buildSliderPanel() {
        sliderPanel = document.createElement('div');
        sliderPanel.className = 'yts-slider-panel';

        // Current speed label
        sliderLabel = document.createElement('div');
        sliderLabel.className = 'yts-slider-label';
        sliderLabel.textContent = formatSpeed(getSpeed());
        sliderPanel.appendChild(sliderLabel);

        // Slider track container
        const trackContainer = document.createElement('div');
        trackContainer.className = 'yts-slider-track-container';
        trackContainer.style.cssText = 'touch-action: none;';

        sliderTrack = document.createElement('div');
        sliderTrack.className = 'yts-slider-track';

        sliderThumb = document.createElement('div');
        sliderThumb.className = 'yts-slider-thumb';
        sliderThumb.setAttribute('role', 'slider');
        sliderThumb.setAttribute('aria-valuemin', SLIDER_MIN);
        sliderThumb.setAttribute('aria-valuemax', SLIDER_MAX);
        sliderThumb.setAttribute('aria-valuenow', getSpeed());
        sliderThumb.setAttribute('aria-label', 'Playback speed');
        sliderThumb.setAttribute('tabindex', '0');

        sliderTrack.appendChild(sliderThumb);
        trackContainer.appendChild(sliderTrack);
        sliderPanel.appendChild(trackContainer);

        // Min/max labels
        const rangeLabels = document.createElement('div');
        rangeLabels.className = 'yts-range-labels';
        const minLabel = document.createElement('span');
        minLabel.textContent = SLIDER_MIN + 'x';
        const maxLabel = document.createElement('span');
        maxLabel.textContent = SLIDER_MAX + 'x';
        rangeLabels.appendChild(minLabel);
        rangeLabels.appendChild(maxLabel);
        sliderPanel.appendChild(rangeLabels);

        // Preset chips
        const presetRow = document.createElement('div');
        presetRow.className = 'yts-presets';
        PRESET_SPEEDS.forEach(speed => {
            const chip = document.createElement('button');
            chip.className = 'yts-preset';
            chip.dataset.speed = speed;
            chip.textContent = formatSpeed(speed);
            chip.addEventListener('click', e => {
                e.stopPropagation();
                e.preventDefault();
                applySliderSpeed(speed);
            });
            chip.addEventListener('touchend', e => {
                e.stopPropagation();
                e.preventDefault();
                applySliderSpeed(speed);
            });
            presetRow.appendChild(chip);
        });
        sliderPanel.appendChild(presetRow);

        // ── Pointer drag logic ──────────────────────────────────
        function getSpeedFromPointer(e) {
            const rect = sliderTrack.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            return percentToSpeed(pct);
        }

        let dragging = false;

        sliderThumb.addEventListener('pointerdown', e => {
            e.stopPropagation();
            e.preventDefault();
            dragging = true;
            sliderThumb._capturedPointerId = e.pointerId;
            sliderThumb.setPointerCapture(e.pointerId);
            sliderThumb.classList.add('dragging');
            clearTimeout(sliderIdleTimer);
            // Safety timeout to release capture
            clearTimeout(pointerCaptureTimeout);
            pointerCaptureTimeout = setTimeout(() => {
                if (dragging) {
                    dragging = false;
                    try { sliderThumb.releasePointerCapture(e.pointerId); } catch (_) {}
                    sliderThumb.classList.remove('dragging');
                    resetSliderIdleTimer();
                }
            }, 5000);
        });

        sliderThumb.addEventListener('pointermove', e => {
            if (!dragging) return;
            e.stopPropagation();
            const speed = getSpeedFromPointer(e);
            applySliderSpeed(speed);
        });

        sliderThumb.addEventListener('pointerup', e => {
            if (!dragging) return;
            dragging = false;
            e.stopPropagation();
            try { sliderThumb.releasePointerCapture(e.pointerId); } catch (_) {}
            sliderThumb.classList.remove('dragging');
            clearTimeout(pointerCaptureTimeout);
            resetSliderIdleTimer();
        });

        sliderThumb.addEventListener('lostpointercapture', () => {
            dragging = false;
            sliderThumb.classList.remove('dragging');
            clearTimeout(pointerCaptureTimeout);
            resetSliderIdleTimer();
        });

        // Allow clicking on track to jump
        trackContainer.addEventListener('pointerdown', e => {
            if (e.target === sliderThumb) return;
            e.stopPropagation();
            e.preventDefault();
            const speed = getSpeedFromPointer(e);
            applySliderSpeed(speed);
        });

        // Keyboard support on slider
        sliderThumb.addEventListener('keydown', e => {
            let speed = getSpeed();
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                speed = Math.min(SLIDER_MAX, speed + SPEED_STEP);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                speed = Math.max(SLIDER_MIN, speed - SPEED_STEP);
            } else if (e.key === 'Escape') {
                collapseSlider();
                return;
            } else {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            applySliderSpeed(speed);
        });

        // Prevent panel clicks from closing
        sliderPanel.addEventListener('click', e => e.stopPropagation());
        sliderPanel.addEventListener('touchend', e => e.stopPropagation());
        sliderPanel.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    }

    // Close slider when clicking outside
    document.addEventListener('click', () => {
        if (sliderExpanded) collapseSlider();
    });
    document.addEventListener('scroll', () => {
        if (sliderExpanded) collapseSlider();
    }, { passive: true });

    // ── Floating toggle button ──────────────────────────────────────
    let toggleEl = null;

    function isShortsBoostActive() {
        const video = document.querySelector('video');
        return video && Math.abs(video.playbackRate - SHORTS_BOOST) < 0.05;
    }

    function createToggle() {
        if (toggleEl) return toggleEl;
        toggleEl = document.createElement('div');
        toggleEl.className = 'yts-toggle';
        toggleEl.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            onToggleTap();
        });
        toggleEl.addEventListener('touchend', e => {
            e.stopPropagation();
            e.preventDefault();
            onToggleTap();
        });
        toggleEl.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
        return toggleEl;
    }

    function getPlayerContainer() {
        // Fullscreen: use the fullscreen element
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        if (fsEl) return fsEl;

        if (isOnShorts()) {
            if (isMobile()) {
                // Mobile Shorts (m.youtube.com) — 2026-04 DOM
                const mShortsPlayer = document.querySelector('#player-shorts-container')
                    || document.querySelector('#player-container-id')
                    || document.querySelector('.player-container');
                if (mShortsPlayer) return mShortsPlayer;
            } else {
                // Desktop Shorts — #shorts-player is the visible player
                const shortsPlayer = document.querySelector('#shorts-player');
                if (shortsPlayer) return shortsPlayer;
                const reel = document.querySelector('ytd-reel-video-renderer');
                if (reel) return reel;
            }
        }

        // Desktop watch — only use #movie_player when it's visible (it exists hidden on Shorts too)
        const player = document.querySelector('#movie_player');
        if (player && player.offsetHeight > 0) return player;
        // Mobile watch
        const mPlayer = document.querySelector('#player-container-id')
            || document.querySelector('.player-container')
            || document.querySelector('.html5-video-player');
        if (mPlayer) return mPlayer;

        return document.body;
    }

    function injectToggle() {
        if (!toggleEl) return;
        collapseSlider();

        // Shorts: inject into the right-side action bar (above like button)
        if (isOnShorts()) {
            // Desktop: #actions inside overlay renderer
            const desktopActions = document.querySelector('ytd-reel-player-overlay-renderer #actions');
            if (desktopActions) {
                if (toggleEl.parentElement !== desktopActions) {
                    desktopActions.insertBefore(toggleEl, desktopActions.firstChild);
                }
                return;
            }
            // Mobile (m.youtube.com): .reel-player-overlay-actions
            const mobileActions = document.querySelector('.reel-player-overlay-actions');
            if (mobileActions) {
                if (toggleEl.parentElement !== mobileActions) {
                    mobileActions.insertBefore(toggleEl, mobileActions.firstChild);
                }
                return;
            }
            // Fallback: overlay on player container (falls through below)
        }

        const container = getPlayerContainer();
        // Ensure container is positioned so absolute toggle works
        if (container.style && container !== document.body) {
            const pos = getComputedStyle(container).position;
            if (pos === 'static') container.style.position = 'relative';
        }
        container.appendChild(toggleEl);
    }

    function onToggleTap() {
        // All video types: tap to expand/collapse slider
        if (sliderExpanded) {
            collapseSlider();
        } else {
            expandSlider();
        }
    }

    function updateToggle() {
        if (!toggleEl) return;
        const video = document.querySelector('video');
        const currentRate = video ? video.playbackRate : getSpeed();
        toggleEl.textContent = formatSpeed(currentRate);
        toggleEl.classList.toggle('active', currentRate > 1.05);
    }

    function showToggle() {
        const el = createToggle();
        el.classList.add('visible');
        if (isOnShorts()) {
            el.classList.add('shorts');
            el.classList.remove('video');
        } else {
            el.classList.remove('shorts');
            el.classList.add('video');
        }
        injectToggle();
        updateToggle();
    }

    function hideToggle() {
        collapseSlider();
        if (toggleEl) {
            toggleEl.classList.remove('visible');
        }
    }

    // ── Page state management ───────────────────────────────────────
    function onNavigate() {
        if (isOnShorts() || isOnWatch()) {
            if (!isOnShorts()) sessionSpeed = null;
            setTimeout(showToggle, 500);
        } else {
            sessionSpeed = null;
            hideToggle();
        }
    }

    document.addEventListener('yt-navigate-finish', onNavigate);

    let shortsSwipeTimer = null;
    const shortsObserver = new MutationObserver(() => {
        if (!isOnShorts()) return;
        // Debounce: swipe triggers many mutations
        clearTimeout(shortsSwipeTimer);
        shortsSwipeTimer = setTimeout(() => {
            collapseSlider();
            if (sessionSpeed !== null) {
                applyToAll(sessionSpeed);
            }
            showToggle();
        }, 250);
    });

    function watchShortsSwipe() {
        // Desktop: ytd-shorts is the parent container for all reels
        // Mobile: look for the shorts sequence container
        const container = document.querySelector('ytd-shorts')
            || document.querySelector('ytm-shorts-player-renderer')?.parentElement
            || document.querySelector('ytd-reel-video-renderer')?.parentElement
            || document.querySelector('#shorts-container');
        if (container) {
            shortsObserver.observe(container, { childList: true, subtree: true });
        }
    }

    document.addEventListener('yt-navigate-finish', () => setTimeout(watchShortsSwipe, 500));
    setTimeout(onNavigate, 500);

    // ── Fullscreen support ─────────────────────────────────────────
    function onFullscreenChange() {
        // Re-inject toggle into the correct container on fullscreen enter/exit
        if (toggleEl && toggleEl.classList.contains('visible')) {
            setTimeout(() => {
                injectToggle();
                updateToggle();
            }, 200);
        }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    // ── Styles ──────────────────────────────────────────────────────
    GM_addStyle(`
        /* Center speed indicator (keyboard shortcuts) */
        .yts-indicator {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.75);
            color: #fff;
            font: 500 28px/1 'YouTube Noto', Roboto, Arial, sans-serif;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 100;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
        }
        .yts-indicator.visible { opacity: 1; }

        /* Floating speed toggle */
        .yts-toggle {
            position: absolute;
            z-index: 2147483647;
            background: rgba(0,0,0,0.55);
            color: #fff;
            font: 600 14px/1 'YouTube Noto', Roboto, Arial, sans-serif;
            padding: 6px 10px;
            border-radius: 20px;
            cursor: pointer;
            user-select: none;
            -webkit-user-select: none;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s, background 0.2s, transform 0.1s;
            -webkit-tap-highlight-color: transparent;
            touch-action: manipulation;
        }
        .yts-toggle.visible {
            opacity: 1;
            pointer-events: auto;
            animation: yts-fade 3s forwards;
        }
        @keyframes yts-fade {
            0%, 80% { opacity: 1; }
            100% { opacity: 0.7; }
        }
        .yts-toggle.visible:hover,
        .yts-toggle.visible:active {
            opacity: 1;
            animation: none;
            transform: scale(1.05);
        }
        .yts-toggle.active {
            background: rgba(62,166,255,0.8);
            opacity: 0.9 !important;
            animation: none;
        }
        .yts-toggle.slider-open {
            opacity: 1 !important;
            animation: none;
        }

        /* Shorts position: inside action bar (desktop #actions or mobile .reel-player-overlay-actions) */
        #actions > .yts-toggle.shorts,
        .reel-player-overlay-actions > .yts-toggle.shorts {
            position: static;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            padding: 0;
            margin-bottom: 12px;
            background: rgba(255,255,255,0.15);
            font-size: 11px;
            font-weight: 700;
        }

        /* Shorts position: fallback when not in action bar (absolute overlay) */
        .yts-toggle.shorts {
            top: 12px;
            right: 12px;
            bottom: auto;
            left: auto;
        }

        /* Regular video position: above controls bar */
        .yts-toggle.video {
            bottom: 70px;
            right: 14px;
            top: auto;
            left: auto;
        }

        /* Mobile: longform top-left */
        @media (max-width: 768px), (hover: none) and (pointer: coarse) {
            .yts-toggle.video {
                top: 0px;
                left: 8px;
                bottom: auto;
                right: auto;
            }
        }

        /* Slightly larger on mobile for easier tapping (not shorts — action bar sized) */
        @media (max-width: 768px), (hover: none) {
            .yts-toggle.video {
                padding: 8px 14px;
                font-size: 16px;
            }
        }

        /* ── Slider Panel ────────────────────────────── */
        .yts-slider-panel {
            position: absolute;
            z-index: 2147483647;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-radius: 12px;
            padding: 12px 16px;
            width: 240px;
            opacity: 0;
            pointer-events: none;
            transform: translateY(8px);
            transition: opacity 0.2s, transform 0.2s;
            /* Default position: above the toggle, bottom-right */
            bottom: 100px;
            right: 14px;
        }
        .yts-slider-panel.expanded {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }

        /* Mobile: panel below toggle */
        @media (max-width: 768px), (hover: none) and (pointer: coarse) {
            .yts-slider-panel {
                bottom: auto;
                top: 36px;
                left: 8px;
                right: auto;
            }
            /* Mobile Shorts: panel below toggle, right-aligned */
            .yts-toggle.shorts ~ .yts-slider-panel,
            .yts-toggle.shorts + .yts-slider-panel {
                top: 44px;
                right: 12px;
                left: auto;
            }
        }

        /* Shorts action bar: panel to the left */
        #actions .yts-slider-panel,
        .reel-player-overlay-actions .yts-slider-panel {
            position: absolute;
            bottom: auto;
            top: 0;
            right: 60px;
            left: auto;
        }

        .yts-slider-label {
            text-align: center;
            color: #fff;
            font: 600 18px/1 'YouTube Noto', Roboto, Arial, sans-serif;
            margin-bottom: 10px;
        }

        .yts-slider-track-container {
            position: relative;
            padding: 8px 0;
            cursor: pointer;
        }

        .yts-slider-track {
            position: relative;
            height: 4px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            --fill: 0%;
        }
        .yts-slider-track::before {
            content: '';
            position: absolute;
            top: 0; left: 0; bottom: 0;
            width: var(--fill);
            background: rgba(62, 166, 255, 0.9);
            border-radius: 2px;
        }

        .yts-slider-thumb {
            position: absolute;
            top: 50%;
            width: 16px;
            height: 16px;
            background: #fff;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            cursor: grab;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            transition: transform 0.1s;
            outline: none;
        }
        .yts-slider-thumb:focus-visible {
            box-shadow: 0 0 0 3px rgba(62,166,255,0.6), 0 1px 4px rgba(0,0,0,0.4);
        }
        .yts-slider-thumb.dragging {
            cursor: grabbing;
            transform: translate(-50%, -50%) scale(1.2);
        }

        /* Mobile: bigger thumb for touch */
        @media (max-width: 768px), (hover: none) {
            .yts-slider-thumb {
                width: 22px;
                height: 22px;
            }
        }

        .yts-range-labels {
            display: flex;
            justify-content: space-between;
            color: rgba(255,255,255,0.5);
            font: 400 10px/1 'YouTube Noto', Roboto, Arial, sans-serif;
            margin-top: 2px;
            margin-bottom: 8px;
        }

        /* Preset chips */
        .yts-presets {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            justify-content: center;
        }
        .yts-preset {
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
            border: none;
            border-radius: 14px;
            padding: 5px 10px;
            font: 500 12px/1 'YouTube Noto', Roboto, Arial, sans-serif;
            cursor: pointer;
            transition: background 0.15s;
            -webkit-tap-highlight-color: transparent;
        }
        .yts-preset:hover {
            background: rgba(255, 255, 255, 0.25);
        }
        .yts-preset.active {
            background: rgba(62, 166, 255, 0.8);
        }
    `);

    console.log('[YT-Speed] v18.3 loaded — stored speed:', getSpeed() + 'x');
})();
