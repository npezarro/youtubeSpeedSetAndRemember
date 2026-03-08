// ==UserScript==
// @name         YouTube Speed Controller
// @namespace    https://github.com/npezarro/youtubeSpeedSetAndRemember
// @version      9.0
// @description  Persists playback speed across sessions. Desktop keyboard shortcuts ([ / ]). Mobile Shorts long-press left side for 2x.
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
    const MAX_SPEED = 4.0;
    const SPEED_STEP = 0.25;
    const LONG_PRESS_MS = 400;
    const LONG_PRESS_2X = 2.0;
    const MOVE_THRESHOLD = 15;

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
            // Reset guard after a tick so the ratechange handler doesn't loop
            setTimeout(() => { isApplyingSpeed = false; }, 50);
        }
    }

    function onRateChange(video) {
        if (isApplyingSpeed) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (isAdPlaying()) {
                // Ad changed the rate — re-apply after ad ends (observer will catch it)
                return;
            }
            // User or YouTube changed the rate — persist it
            const current = video.playbackRate;
            if (current >= MIN_SPEED && current <= MAX_SPEED) {
                setSpeed(current);
            }
        }, 150);
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

    // Catch any video already in the DOM
    document.querySelectorAll('video').forEach(trackVideo);

    // --- SPA navigation: YouTube fires this on page transitions ---
    document.addEventListener('yt-navigate-finish', () => {
        // Small delay — YouTube may not have the new video element ready immediately
        setTimeout(() => {
            document.querySelectorAll('video').forEach(trackVideo);
        }, 300);
    });

    // --- Desktop keyboard shortcuts ---
    // [ = decrease speed, ] = increase speed
    document.addEventListener('keydown', (e) => {
        // Don't fire when typing in an input
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
        // Apply to all active videos
        document.querySelectorAll('video').forEach((v) => {
            isApplyingSpeed = true;
            v.playbackRate = newSpeed;
            setTimeout(() => { isApplyingSpeed = false; }, 50);
        });

        showSpeedIndicator(newSpeed);
    });

    // --- Speed indicator overlay ---
    GM_addStyle(`
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
        .yt-speed-longpress {
            position: fixed;
            top: 12px;
            left: 12px;
            background: rgba(0, 0, 0, 0.6);
            color: #fff;
            font-family: YouTube Noto, Roboto, Arial, sans-serif;
            font-size: 14px;
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
    `);

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
        }, 700);
    }

    // --- Shorts long-press (left side → 2x) ---
    // Only activate on touch-capable devices when viewing Shorts
    if (navigator.maxTouchPoints > 0) {
        let longPressTimer = null;
        let isLongPressing = false;
        let startX = 0;
        let startY = 0;
        let preLongPressSpeed = DEFAULT_SPEED;
        let longPressOverlay = null;

        function isOnShorts() {
            return window.location.pathname.includes('/shorts/');
        }

        function getLongPressOverlay() {
            if (!longPressOverlay) {
                longPressOverlay = document.createElement('div');
                longPressOverlay.className = 'yt-speed-longpress';
                longPressOverlay.textContent = LONG_PRESS_2X + 'x';
                document.body.appendChild(longPressOverlay);
            }
            return longPressOverlay;
        }

        function startLongPress() {
            isLongPressing = true;
            const video = document.querySelector('video');
            if (video) {
                preLongPressSpeed = video.playbackRate;
                isApplyingSpeed = true;
                video.playbackRate = LONG_PRESS_2X;
                setTimeout(() => { isApplyingSpeed = false; }, 50);
            }
            getLongPressOverlay().classList.add('visible');
        }

        function endLongPress() {
            if (!isLongPressing) return;
            isLongPressing = false;
            const video = document.querySelector('video');
            if (video) {
                isApplyingSpeed = true;
                video.playbackRate = preLongPressSpeed;
                setTimeout(() => { isApplyingSpeed = false; }, 50);
            }
            getLongPressOverlay().classList.remove('visible');
        }

        document.addEventListener('touchstart', (e) => {
            if (!isOnShorts()) return;
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            // Left half of screen only
            if (touch.clientX >= window.innerWidth / 2) return;

            // Don't interfere with interactive elements
            const target = e.target;
            if (target.closest('button, a, input, textarea, [role="button"], ytd-menu-renderer')) return;

            startX = touch.clientX;
            startY = touch.clientY;

            longPressTimer = setTimeout(() => {
                startLongPress();
            }, LONG_PRESS_MS);
        }, { capture: true, passive: true });

        document.addEventListener('touchmove', (e) => {
            if (longPressTimer || isLongPressing) {
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - startX);
                const dy = Math.abs(touch.clientY - startY);
                if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                    endLongPress();
                }
            }
        }, { capture: true, passive: true });

        document.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            endLongPress();
        }, { capture: true, passive: true });

        document.addEventListener('touchcancel', () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            endLongPress();
        }, { capture: true, passive: true });
    }

    console.log('[YT-Speed] v9 loaded — stored speed:', getSpeed() + 'x');
})();
