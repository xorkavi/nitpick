/**
 * Element metadata inspector.
 *
 * Extracts a complete ElementMetadata object from any DOM element:
 * - Curated computed CSS styles (~47 visual properties)
 * - DOM path with id-anchored termination
 * - CSS custom properties
 * - WCAG contrast ratio
 * - Page context (URL + title)
 *
 * Per D-17: This data is captured SILENTLY. Users never see raw CSS/DOM data.
 *           It is consumed only by AI in Phase 2.
 * Per D-18: Capture all computed CSS styles (via curated list), applied class
 *           names, CSS custom properties, full DOM selector path, element
 *           dimensions and position.
 * Per D-19: Page context uses URL + document.title, NOT DOM breadcrumb heuristics.
 * Per D-20: Contrast ratio is the ONLY accessibility metric. Do NOT capture
 *           ARIA roles, labels, alt text, or keyboard focus data.
 */

import type { ElementMetadata } from '../../shared/types';
import { calculateContrastRatio } from './contrast';
import { extractCSSVariables } from './css-variables';

/**
 * Curated CSS properties relevant to visual bug reporting.
 *
 * ~47 properties covering colors, typography, spacing, box model, borders,
 * layout, and visual effects. Avoids serializing all 300+ computed style
 * properties (see Research Pitfall 7).
 */
export const VISUAL_PROPERTIES = [
  // Colors
  'color',
  'background-color',
  'border-color',
  'outline-color',
  'opacity',
  // Typography
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'white-space',
  'word-break',
  // Spacing
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  // Box model
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-sizing',
  // Borders
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-radius',
  // Layout
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'overflow',
  'z-index',
  // Visual
  'box-shadow',
  'text-shadow',
  'cursor',
  'visibility',
  'transform',
  'transition',
] as const;

/**
 * Regex matching common Tailwind CSS utility class prefixes.
 * These are filtered from DOM path generation to keep paths meaningful.
 */
const TAILWIND_UTILITY_RE = /^(flex|grid|p-|m-|w-|h-|text-|bg-)/;

/**
 * Generate a human-readable DOM path from an element up to the nearest
 * ancestor with an ID (or the document root).
 *
 * Rules:
 * - If element has an id, stop there: tagName#id
 * - Include up to 2 meaningful class names per element (filter out Tailwind utilities)
 * - Add :nth-child(N) when siblings of the same tag type exist
 * - Join with " > "
 */
export function generateDOMPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break; // ID is unique, stop here
    }

    if (current.classList.length > 0) {
      // Include up to 2 most meaningful classes (skip Tailwind utilities)
      const classes = Array.from(current.classList)
        .filter((c) => !TAILWIND_UTILITY_RE.test(c))
        .slice(0, 2);
      if (classes.length > 0) {
        selector += '.' + classes.join('.');
      }
    }

    // Add nth-child if ambiguous (siblings of same tag type exist)
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Extract complete ElementMetadata from a DOM element.
 *
 * Calls getComputedStyle exactly once per element, then extracts:
 * - Tag, id, classes, truncated text content
 * - DOM path via generateDOMPath
 * - Bounding rect from getBoundingClientRect
 * - Curated computed styles from VISUAL_PROPERTIES
 * - CSS custom properties via extractCSSVariables
 * - Contrast ratio via calculateContrastRatio
 * - Page context (URL + title) per D-19
 */
export function inspectElement(el: Element): ElementMetadata {
  const rect = el.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(el);

  // Extract curated computed styles (only non-empty values)
  const computedStyles: Record<string, string> = {};
  for (const prop of VISUAL_PROPERTIES) {
    const value = computedStyle.getPropertyValue(prop);
    if (value) computedStyles[prop] = value;
  }

  // Extract CSS custom properties
  const cssVariables = extractCSSVariables(el, computedStyle);

  // Calculate contrast ratio between text color and background color
  const contrastRatio = calculateContrastRatio(
    computedStyle.getPropertyValue('color'),
    computedStyle.getPropertyValue('background-color')
  );

  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id,
    classList: Array.from(el.classList),
    textContent: (el.textContent || '').trim().slice(0, 200),
    domPath: generateDOMPath(el),
    boundingRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    computedStyles,
    cssVariables,
    contrastRatio,
    pageContext: {
      url: window.location.href,
      title: document.title,
    },
  };
}
