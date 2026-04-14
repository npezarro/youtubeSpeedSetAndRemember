import { describe, it, expect } from 'vitest';
import {
  SPEED_KEY, DEFAULT_SPEED, MIN_SPEED, MAX_SPEED, SPEED_STEP,
  SHORTS_BOOST, SLIDER_MIN, SLIDER_MAX, PRESET_SPEEDS, SLIDER_IDLE_TIMEOUT,
  formatSpeed, clampSpeed, speedToPercent, percentToSpeed,
  isOnShorts, isOnWatch, isMobile,
  getSpeedDelta, shouldIgnoreKeydown,
  AD_SELECTORS, getSliderKeyDelta,
} from './core.js';

// ── Config constants ────────────────────────────────────────────
describe('Config constants', () => {
  it('has expected speed boundaries', () => {
    expect(MIN_SPEED).toBe(0.25);
    expect(MAX_SPEED).toBe(8.0);
    expect(DEFAULT_SPEED).toBe(1.0);
    expect(SPEED_STEP).toBe(0.25);
  });

  it('slider range is 1x–8x', () => {
    expect(SLIDER_MIN).toBe(1.0);
    expect(SLIDER_MAX).toBe(8.0);
  });

  it('shorts boost is 2x', () => {
    expect(SHORTS_BOOST).toBe(2.0);
  });

  it('has 6 preset speeds', () => {
    expect(PRESET_SPEEDS).toEqual([1.25, 1.5, 2, 2.5, 3, 4]);
    expect(PRESET_SPEEDS.length).toBe(6);
  });

  it('all presets are within slider range', () => {
    for (const s of PRESET_SPEEDS) {
      expect(s).toBeGreaterThanOrEqual(SLIDER_MIN);
      expect(s).toBeLessThanOrEqual(SLIDER_MAX);
    }
  });

  it('slider idle timeout is 3 seconds', () => {
    expect(SLIDER_IDLE_TIMEOUT).toBe(3000);
  });

  it('speed key is yt_speed', () => {
    expect(SPEED_KEY).toBe('yt_speed');
  });
});

// ── formatSpeed ─────────────────────────────────────────────────
describe('formatSpeed', () => {
  it('formats integer speeds without decimal', () => {
    expect(formatSpeed(1)).toBe('1x');
    expect(formatSpeed(2)).toBe('2x');
    expect(formatSpeed(8)).toBe('8x');
  });

  it('formats quarter-step speeds', () => {
    expect(formatSpeed(1.25)).toBe('1.25x');
    expect(formatSpeed(1.75)).toBe('1.75x');
    expect(formatSpeed(2.25)).toBe('2.25x');
  });

  it('formats half-step speeds trimming trailing zero', () => {
    expect(formatSpeed(1.5)).toBe('1.5x');
    expect(formatSpeed(2.5)).toBe('2.5x');
    expect(formatSpeed(0.5)).toBe('0.5x');
  });

  it('formats 0.25', () => {
    expect(formatSpeed(0.25)).toBe('0.25x');
  });

  it('formats the default speed', () => {
    expect(formatSpeed(DEFAULT_SPEED)).toBe('1x');
  });
});

// ── clampSpeed ──────────────────────────────────────────────────
describe('clampSpeed', () => {
  it('passes through valid speeds', () => {
    expect(clampSpeed(1.5)).toBe(1.5);
    expect(clampSpeed(4)).toBe(4);
    expect(clampSpeed(0.25)).toBe(0.25);
  });

  it('clamps above max to max', () => {
    expect(clampSpeed(10)).toBe(MAX_SPEED);
    expect(clampSpeed(100)).toBe(MAX_SPEED);
  });

  it('clamps below min to min', () => {
    expect(clampSpeed(0)).toBe(MIN_SPEED);
    expect(clampSpeed(-1)).toBe(MIN_SPEED);
    expect(clampSpeed(0.1)).toBe(MIN_SPEED);
  });

  it('returns fallback for NaN input', () => {
    expect(clampSpeed(NaN)).toBe(DEFAULT_SPEED);
    expect(clampSpeed('abc')).toBe(DEFAULT_SPEED);
    expect(clampSpeed(undefined)).toBe(DEFAULT_SPEED);
  });

  it('parses string numbers', () => {
    expect(clampSpeed('2.5')).toBe(2.5);
    expect(clampSpeed('0.25')).toBe(0.25);
  });

  it('accepts custom min/max/fallback', () => {
    expect(clampSpeed(5, 1, 3, 2)).toBe(3);
    expect(clampSpeed(0, 1, 3, 2)).toBe(1);
    expect(clampSpeed(NaN, 1, 3, 2)).toBe(2);
  });

  it('boundary values are inclusive', () => {
    expect(clampSpeed(MIN_SPEED)).toBe(MIN_SPEED);
    expect(clampSpeed(MAX_SPEED)).toBe(MAX_SPEED);
  });
});

// ── speedToPercent ──────────────────────────────────────────────
describe('speedToPercent', () => {
  it('maps slider min to 0', () => {
    expect(speedToPercent(SLIDER_MIN)).toBe(0);
  });

  it('maps slider max to 1', () => {
    expect(speedToPercent(SLIDER_MAX)).toBe(1);
  });

  it('maps midpoint correctly', () => {
    const mid = (SLIDER_MIN + SLIDER_MAX) / 2; // 4.5
    expect(speedToPercent(mid)).toBeCloseTo(0.5, 10);
  });

  it('clamps below min to 0', () => {
    expect(speedToPercent(0)).toBe(0);
    expect(speedToPercent(-1)).toBe(0);
  });

  it('clamps above max to 1', () => {
    expect(speedToPercent(100)).toBe(1);
    expect(speedToPercent(9)).toBe(1);
  });

  it('is monotonically increasing', () => {
    let prev = -1;
    for (let s = SLIDER_MIN; s <= SLIDER_MAX; s += 0.25) {
      const pct = speedToPercent(s);
      expect(pct).toBeGreaterThan(prev);
      prev = pct;
    }
  });
});

// ── percentToSpeed ──────────────────────────────────────────────
describe('percentToSpeed', () => {
  it('maps 0 to slider min', () => {
    expect(percentToSpeed(0)).toBe(SLIDER_MIN);
  });

  it('maps 1 to slider max', () => {
    expect(percentToSpeed(1)).toBe(SLIDER_MAX);
  });

  it('snaps to nearest 0.25', () => {
    // 0.1 → raw = 1 + 0.1 * 7 = 1.7 → snap to 1.75
    expect(percentToSpeed(0.1)).toBe(1.75);
    // 0.5 → raw = 1 + 0.5 * 7 = 4.5 → snap to 4.5
    expect(percentToSpeed(0.5)).toBe(4.5);
  });

  it('clamps below 0 to slider min', () => {
    expect(percentToSpeed(-0.5)).toBe(SLIDER_MIN);
  });

  it('clamps above 1 to slider max', () => {
    expect(percentToSpeed(1.5)).toBe(SLIDER_MAX);
  });

  it('all outputs are multiples of 0.25', () => {
    for (let pct = 0; pct <= 1; pct += 0.01) {
      const speed = percentToSpeed(pct);
      expect(speed * 4 % 1).toBeCloseTo(0, 10);
    }
  });

  it('roundtrips with speedToPercent at snap points', () => {
    for (let s = SLIDER_MIN; s <= SLIDER_MAX; s += 0.25) {
      const pct = speedToPercent(s);
      expect(percentToSpeed(pct)).toBe(s);
    }
  });
});

// ── URL helpers ─────────────────────────────────────────────────
describe('isOnShorts', () => {
  it('returns true for shorts URLs', () => {
    expect(isOnShorts('/shorts/abc123')).toBe(true);
    expect(isOnShorts('/shorts/xyz?feature=share')).toBe(true);
  });

  it('returns false for non-shorts URLs', () => {
    expect(isOnShorts('/watch?v=abc123')).toBe(false);
    expect(isOnShorts('/')).toBe(false);
    expect(isOnShorts('/results?search_query=test')).toBe(false);
    expect(isOnShorts('/channel/UCabc')).toBe(false);
  });
});

describe('isOnWatch', () => {
  it('returns true for watch URLs', () => {
    expect(isOnWatch('/watch?v=abc123')).toBe(true);
    expect(isOnWatch('/watch')).toBe(true);
  });

  it('returns false for non-watch URLs', () => {
    expect(isOnWatch('/shorts/abc')).toBe(false);
    expect(isOnWatch('/')).toBe(false);
    expect(isOnWatch('/results?search_query=test')).toBe(false);
  });
});

describe('isMobile', () => {
  it('returns true for m.youtube.com', () => {
    expect(isMobile('m.youtube.com', false)).toBe(true);
  });

  it('returns true when ytm-app is present', () => {
    expect(isMobile('www.youtube.com', true)).toBe(true);
  });

  it('returns false for desktop without ytm-app', () => {
    expect(isMobile('www.youtube.com', false)).toBe(false);
  });
});

// ── Keyboard shortcuts ──────────────────────────────────────────
describe('getSpeedDelta', () => {
  it('[ decreases speed by SPEED_STEP', () => {
    expect(getSpeedDelta('[')).toBe(-SPEED_STEP);
  });

  it('] increases speed by SPEED_STEP', () => {
    expect(getSpeedDelta(']')).toBe(SPEED_STEP);
  });

  it('returns 0 for other keys', () => {
    expect(getSpeedDelta('a')).toBe(0);
    expect(getSpeedDelta('Enter')).toBe(0);
    expect(getSpeedDelta('ArrowUp')).toBe(0);
    expect(getSpeedDelta(' ')).toBe(0);
  });
});

describe('shouldIgnoreKeydown', () => {
  it('ignores INPUT elements', () => {
    expect(shouldIgnoreKeydown('INPUT', false)).toBe(true);
  });

  it('ignores TEXTAREA elements', () => {
    expect(shouldIgnoreKeydown('TEXTAREA', false)).toBe(true);
  });

  it('ignores contentEditable elements', () => {
    expect(shouldIgnoreKeydown('DIV', true)).toBe(true);
  });

  it('allows keyboard on regular elements', () => {
    expect(shouldIgnoreKeydown('DIV', false)).toBe(false);
    expect(shouldIgnoreKeydown('BODY', false)).toBe(false);
    expect(shouldIgnoreKeydown('VIDEO', false)).toBe(false);
  });
});

// ── Slider keyboard navigation ──────────────────────────────────
describe('getSliderKeyDelta', () => {
  it('ArrowRight increases', () => {
    expect(getSliderKeyDelta('ArrowRight')).toBe(SPEED_STEP);
  });

  it('ArrowUp increases', () => {
    expect(getSliderKeyDelta('ArrowUp')).toBe(SPEED_STEP);
  });

  it('ArrowLeft decreases', () => {
    expect(getSliderKeyDelta('ArrowLeft')).toBe(-SPEED_STEP);
  });

  it('ArrowDown decreases', () => {
    expect(getSliderKeyDelta('ArrowDown')).toBe(-SPEED_STEP);
  });

  it('returns 0 for non-arrow keys', () => {
    expect(getSliderKeyDelta('Escape')).toBe(0);
    expect(getSliderKeyDelta('Enter')).toBe(0);
    expect(getSliderKeyDelta('Tab')).toBe(0);
  });
});

// ── AD_SELECTORS ────────────────────────────────────────────────
describe('AD_SELECTORS', () => {
  it('includes ad-showing and ad-interrupting', () => {
    expect(AD_SELECTORS).toContain('.ad-showing');
    expect(AD_SELECTORS).toContain('.ad-interrupting');
    expect(AD_SELECTORS.length).toBe(2);
  });
});

// ── Integration: speed step arithmetic ──────────────────────────
describe('Speed step arithmetic', () => {
  it('stepping up from 1x gives 1.25x', () => {
    expect(clampSpeed(1.0 + SPEED_STEP)).toBe(1.25);
  });

  it('stepping down from 1x gives 0.75x', () => {
    expect(clampSpeed(1.0 - SPEED_STEP)).toBe(0.75);
  });

  it('stepping up from max stays at max', () => {
    expect(clampSpeed(MAX_SPEED + SPEED_STEP)).toBe(MAX_SPEED);
  });

  it('stepping down from min stays at min', () => {
    expect(clampSpeed(MIN_SPEED - SPEED_STEP)).toBe(MIN_SPEED);
  });

  it('walking from min to max covers expected range', () => {
    let speed = MIN_SPEED;
    let steps = 0;
    while (speed < MAX_SPEED) {
      speed = clampSpeed(speed + SPEED_STEP);
      steps++;
    }
    expect(speed).toBe(MAX_SPEED);
    // (8.0 - 0.25) / 0.25 = 31 steps
    expect(steps).toBe(31);
  });

  it('preset speeds are all formatted consistently', () => {
    for (const s of PRESET_SPEEDS) {
      const formatted = formatSpeed(s);
      expect(formatted).toMatch(/^\d+(\.\d{1,2})?x$/);
    }
  });
});
