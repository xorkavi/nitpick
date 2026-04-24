/**
 * WCAG 2.1 contrast ratio calculation.
 *
 * Implements the W3C relative luminance formula for calculating
 * the contrast ratio between two colors expressed as rgb()/rgba() strings.
 *
 * Source: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 *
 * Per D-20: Contrast ratio is the ONLY accessibility metric captured in v1.
 * Do NOT add ARIA attributes, alt text, or keyboard focus extraction.
 */

/**
 * Parse an rgb() or rgba() color string into [R, G, B] tuple.
 * Alpha channel is ignored since contrast ratio uses RGB values only.
 *
 * getComputedStyle always returns colors in rgb() or rgba() format,
 * so this covers all cases for computed style color values.
 */
export function parseRGB(colorString: string): [number, number, number] | null {
  const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

/**
 * Convert an sRGB channel value (0-255) to linear light.
 * Uses the correct W3C threshold of 0.04045 (not 0.03928).
 */
function linearize(channel: number): number {
  const sRGB = channel / 255;
  return sRGB <= 0.04045
    ? sRGB / 12.92
    : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * Calculate the relative luminance of a color.
 * Uses the WCAG coefficients: 0.2126 R + 0.7152 G + 0.0722 B
 */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate the WCAG contrast ratio between two colors.
 *
 * Returns a number between 1.0 (no contrast) and 21.0 (max contrast),
 * or null if either color string cannot be parsed.
 *
 * The ratio is always >= 1 regardless of which color is lighter,
 * because the formula uses max/min luminance.
 *
 * WCAG AA thresholds for reference:
 * - Normal text (< 18pt or < 14pt bold): 4.5:1
 * - Large text (>= 18pt or >= 14pt bold): 3:1
 */
export function calculateContrastRatio(
  foreground: string,
  background: string
): number | null {
  const fg = parseRGB(foreground);
  const bg = parseRGB(background);
  if (!fg || !bg) return null;

  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}
