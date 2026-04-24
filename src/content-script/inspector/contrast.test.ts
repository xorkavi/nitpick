import { describe, it, expect } from 'vitest';
import { parseRGB, calculateContrastRatio } from './contrast';

describe('parseRGB', () => {
  it('parses rgb() format', () => {
    expect(parseRGB('rgb(128, 64, 32)')).toEqual([128, 64, 32]);
  });

  it('parses rgba() format, ignoring alpha', () => {
    expect(parseRGB('rgba(128, 64, 32, 0.5)')).toEqual([128, 64, 32]);
  });

  it('parses rgb with no spaces', () => {
    expect(parseRGB('rgb(0,0,0)')).toEqual([0, 0, 0]);
  });

  it('returns null for invalid color string', () => {
    expect(parseRGB('not-a-color')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRGB('')).toBeNull();
  });

  it('returns null for hex color (not rgb format)', () => {
    expect(parseRGB('#ff0000')).toBeNull();
  });
});

describe('calculateContrastRatio', () => {
  it('returns 21.0 for black on white (maximum contrast)', () => {
    const result = calculateContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    expect(result).toBe(21);
  });

  it('returns 1.0 for white on white (minimum contrast)', () => {
    const result = calculateContrastRatio('rgb(255, 255, 255)', 'rgb(255, 255, 255)');
    expect(result).toBe(1);
  });

  it('returns 1.0 for black on black', () => {
    const result = calculateContrastRatio('rgb(0, 0, 0)', 'rgb(0, 0, 0)');
    expect(result).toBe(1);
  });

  it('returns null when foreground is invalid', () => {
    expect(calculateContrastRatio('invalid', 'rgb(0, 0, 0)')).toBeNull();
  });

  it('returns null when background is invalid', () => {
    expect(calculateContrastRatio('rgb(0, 0, 0)', 'invalid')).toBeNull();
  });

  it('handles rgba format correctly (uses RGB values only)', () => {
    const result = calculateContrastRatio('rgba(0, 0, 0, 0.5)', 'rgb(255, 255, 255)');
    expect(result).toBe(21);
  });

  it('returns a number between 1 and 21 for mid-range colors', () => {
    const result = calculateContrastRatio('rgb(128, 128, 128)', 'rgb(255, 255, 255)');
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(1);
    expect(result!).toBeLessThanOrEqual(21);
  });

  it('is symmetric (order of lighter/darker does not matter for ratio value)', () => {
    const ratio1 = calculateContrastRatio('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    const ratio2 = calculateContrastRatio('rgb(255, 255, 255)', 'rgb(0, 0, 0)');
    expect(ratio1).toBe(ratio2);
  });
});
