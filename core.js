// Pure logic extracted from script.js for testing.
// script.js remains the single-file userscript; this module mirrors its constants and functions.

// ── Config ──────────────────────────────────────────────────────
export const SPEED_KEY = 'yt_speed';
export const DEFAULT_SPEED = 1.0;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 8.0;
export const SPEED_STEP = 0.25;
export const SHORTS_BOOST = 2.0;
export const SLIDER_MIN = 1.0;
export const SLIDER_MAX = 8.0;
export const PRESET_SPEEDS = [1.25, 1.5, 2, 2.5, 3, 4];
export const SLIDER_IDLE_TIMEOUT = 3000;

// ── Speed formatting ────────────────────────────────────────────
export function formatSpeed(s) {
    return s % 1 === 0 ? s + 'x' : s.toFixed(2).replace(/0$/, '') + 'x';
}

// ── Speed clamping ──────────────────────────────────────────────
export function clampSpeed(val, min = MIN_SPEED, max = MAX_SPEED, fallback = DEFAULT_SPEED) {
    const parsed = parseFloat(val);
    if (isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

// ── Slider math ─────────────────────────────────────────────────
export function speedToPercent(speed) {
    return Math.max(0, Math.min(1, (speed - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)));
}

export function percentToSpeed(pct) {
    const raw = SLIDER_MIN + pct * (SLIDER_MAX - SLIDER_MIN);
    // Snap to nearest 0.25
    return Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, Math.round(raw * 4) / 4));
}

// ── URL helpers ─────────────────────────────────────────────────
export function isOnShorts(pathname) {
    return pathname.includes('/shorts/');
}

export function isOnWatch(pathname) {
    return pathname.startsWith('/watch');
}

export function isMobile(hostname, hasYtmApp = false) {
    return hostname === 'm.youtube.com' || hasYtmApp;
}

// ── Keyboard shortcut logic ─────────────────────────────────────
export function getSpeedDelta(key) {
    if (key === '[') return -SPEED_STEP;
    if (key === ']') return SPEED_STEP;
    return 0;
}

export function shouldIgnoreKeydown(tagName, isContentEditable) {
    return tagName === 'INPUT' || tagName === 'TEXTAREA' || isContentEditable;
}

// ── Ad detection selector ───────────────────────────────────────
export const AD_SELECTORS = ['.ad-showing', '.ad-interrupting'];

// ── Slider keyboard navigation ──────────────────────────────────
export function getSliderKeyDelta(key) {
    if (key === 'ArrowRight' || key === 'ArrowUp') return SPEED_STEP;
    if (key === 'ArrowLeft' || key === 'ArrowDown') return -SPEED_STEP;
    return 0;
}
