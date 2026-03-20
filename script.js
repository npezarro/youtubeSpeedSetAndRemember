// ==UserScript==
// @name         YouTube Speed Controller
// @namespace    https://github.com/npezarro/youtubeSpeedSetAndRemember
// @version      14.0
// @description  Floating speed toggle for Shorts (2x) and regular videos. Desktop keyboard shortcuts ([ / ]). Persists speed across sessions.
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

    // ── Config ──────────────────────────────────────────────────────
    const SPEED_KEY = 'yt_speed';
    const DEFAULT_SPEED = 1.0;
    const MIN_SPEED = 0.25;
    const MAX_SPEED = 8.0;
    const SPEED_STEP = 0.25;
    const SHORTS_BOOST = 2.0;

    // Cycle speeds for the regular video toggle (tap cycles through these)
    const CYCLE_SPEEDS = [1.0, 1.5, 2.0, 3.0];

    // ── Storage ─────────────────────────────────────────────────────
    function getSpeed() {
        const val = parseFloat(GM_getValue(SPEED_KEY, DEFAULT_SPEED));
        return isNaN(val) ? DEFAULT_SPEED : Math.min(MAX_SPEED, Math.max(MIN_SPEED, val));
    }

    function setSpeed(rate) {
        const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, rate));
        GM_setValue(SPEED_KEY, clamped);
        return clamped;
    }

    // ── Helpers ──────────────────────────────────────────────────────
    let isApplyingSpeed = false;

    function applyToAll(speed) {
        document.querySelectorAll('video').forEach(v => {
            isApplyingSpeed = true;
            v.playbackRate = speed;
            setTimeout(() => { isApplyingSpeed = false; }, 50);
        });
    }

    function isAdPlaying() {
        return !!(document.querySelector('.ad-showing') || document.querySelector('.ad-interrupting'));
    }

    function isOnShorts() {
        return location.pathname.includes('/shorts/');
    }

    function isOnWatch() {
        return location.pathname.startsWith('/watch');
    }

    function formatSpeed(s) {
        return s % 1 === 0 ? s + 'x' : s.toFixed(1) + 'x';
    }

    // ── Track videos (persist speed) ────────────────────────────────
    const tracked = new WeakSet();
    let debounceTimer = null;

    function trackVideo(video) {
        if (tracked.has(video)) return;
        tracked.add(video);
        video.addEventListener('ratechange', () => {
            if (isApplyingSpeed || isAdPlaying()) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const r = video.playbackRate;
                if (r >= MIN_SPEED && r <= MAX_SPEED) setSpeed(r);
            }, 150);
        });
        if (!isAdPlaying() && !isOnShorts()) {
            isApplyingSpeed = true;
            video.playbackRate = getSpeed();
            setTimeout(() => { isApplyingSpeed = false; }, 50);
        }
    }

    function scanVideos() {
        document.querySelectorAll('video').forEach(trackVideo);
    }

    const observer = new MutationObserver(() => scanVideos());
    observer.observe(document.body, { childList: true, subtree: true });
    scanVideos();
    document.addEventListener('yt-navigate-finish', () => setTimeout(scanVideos, 300));

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

    // ── Floating toggle button ──────────────────────────────────────
    let toggleEl = null;
    let shortsBoostActive = false;

    function createToggle() {
        if (toggleEl) return toggleEl;
        toggleEl = document.createElement('div');
        toggleEl.className = 'yts-toggle';
        toggleEl.addEventListener('click', e => {
            e.stopPropagation();
            e.preventDefault();
            onToggleTap();
        });
        // Prevent YouTube from intercepting touches on our button
        toggleEl.addEventListener('touchend', e => {
            e.stopPropagation();
            e.preventDefault();
            onToggleTap();
        });
        toggleEl.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
        document.body.appendChild(toggleEl);
        return toggleEl;
    }

    function onToggleTap() {
        if (isOnShorts()) {
            // Shorts: simple 1x/2x toggle
            shortsBoostActive = !shortsBoostActive;
            const speed = shortsBoostActive ? SHORTS_BOOST : DEFAULT_SPEED;
            applyToAll(speed);
            updateToggle();
        } else {
            // Regular video: cycle through CYCLE_SPEEDS
            const current = getSpeed();
            let nextIdx = 0;
            for (let i = 0; i < CYCLE_SPEEDS.length; i++) {
                if (Math.abs(CYCLE_SPEEDS[i] - current) < 0.05) {
                    nextIdx = (i + 1) % CYCLE_SPEEDS.length;
                    break;
                }
            }
            const s = setSpeed(CYCLE_SPEEDS[nextIdx]);
            applyToAll(s);
            updateToggle();
        }
    }

    function updateToggle() {
        if (!toggleEl) return;
        if (isOnShorts()) {
            const speed = shortsBoostActive ? SHORTS_BOOST : DEFAULT_SPEED;
            toggleEl.textContent = formatSpeed(speed);
            toggleEl.classList.toggle('active', shortsBoostActive);
        } else {
            toggleEl.textContent = formatSpeed(getSpeed());
            toggleEl.classList.toggle('active', getSpeed() > 1.05);
        }
    }

    function showToggle() {
        const el = createToggle();
        el.classList.add('visible');
        if (isOnShorts()) {
            // Top right for Shorts
            el.classList.add('shorts');
            el.classList.remove('video');
        } else {
            // Below the video controls area for regular videos
            el.classList.remove('shorts');
            el.classList.add('video');
        }
        updateToggle();
    }

    function hideToggle() {
        if (toggleEl) {
            toggleEl.classList.remove('visible');
        }
    }

    // ── Page state management ───────────────────────────────────────
    function onNavigate() {
        if (isOnShorts() || isOnWatch()) {
            // Reset Shorts boost on navigation
            if (isOnShorts() && shortsBoostActive) {
                shortsBoostActive = false;
            }
            setTimeout(showToggle, 500);
        } else {
            hideToggle();
        }
    }

    document.addEventListener('yt-navigate-finish', onNavigate);
    // Also handle Shorts swipe (video change within Shorts)
    const shortsObserver = new MutationObserver(() => {
        if (!isOnShorts()) return;
        // Reset boost when swiping to new Short
        if (shortsBoostActive) {
            shortsBoostActive = false;
            applyToAll(DEFAULT_SPEED);
            updateToggle();
        }
    });

    function watchShortsSwipe() {
        const container = document.querySelector('ytd-shorts, ytd-reel-video-renderer')?.parentElement;
        if (container) {
            shortsObserver.observe(container, { childList: true });
        }
    }

    document.addEventListener('yt-navigate-finish', () => setTimeout(watchShortsSwipe, 500));

    // Initial page load
    setTimeout(onNavigate, 500);

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
            z-index: 999999;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
        }
        .yts-indicator.visible { opacity: 1; }

        /* Floating speed toggle */
        .yts-toggle {
            position: fixed;
            z-index: 999999;
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
            opacity: 0.7;
            pointer-events: auto;
        }
        .yts-toggle.visible:hover,
        .yts-toggle.visible:active {
            opacity: 1;
            transform: scale(1.05);
        }
        .yts-toggle.active {
            background: rgba(62,166,255,0.8);
            opacity: 0.9 !important;
        }

        /* Shorts position: top right, below action buttons */
        .yts-toggle.shorts {
            top: 14px;
            right: 14px;
        }

        /* Regular video position: top right of viewport on mobile,
           or top right of player on desktop */
        .yts-toggle.video {
            top: 14px;
            right: 14px;
        }

        /* Slightly larger on mobile for easier tapping */
        @media (max-width: 768px), (hover: none) {
            .yts-toggle {
                padding: 8px 14px;
                font-size: 16px;
            }
        }
    `);

    console.log('[YT-Speed] v14 loaded — stored speed:', getSpeed() + 'x');
})();
