/**
 * CSS custom property (variable) extraction from DOM elements.
 *
 * Extracts CSS variables from:
 * 1. Element's inline style (style="--var: value")
 * 2. Accessible stylesheets matching known design token prefixes
 *
 * Per D-18: CSS custom properties are part of the captured element data.
 * Per D-17: This data is captured silently for AI consumption only.
 */

/** Known design token prefixes used by common design systems */
const KNOWN_PREFIXES = [
  '--color',
  '--font',
  '--space',
  '--radius',
  '--shadow',
  '--border',
  '--bg',
  '--text',
];

/**
 * Extract CSS custom properties from an element.
 *
 * Reads custom properties from:
 * - The element's inline style (any `--*` property)
 * - Accessible stylesheets, filtered by known design token prefixes
 *
 * Cross-origin stylesheets that throw SecurityError are silently skipped.
 */
export function extractCSSVariables(
  el: Element,
  computedStyle: CSSStyleDeclaration
): Record<string, string> {
  const variables: Record<string, string> = {};

  // Extract from inline style
  const inlineStyle = (el as HTMLElement).style;
  if (inlineStyle) {
    for (let i = 0; i < inlineStyle.length; i++) {
      const prop = inlineStyle[i];
      if (prop.startsWith('--')) {
        variables[prop] = inlineStyle.getPropertyValue(prop).trim();
      }
    }
  }

  // Scan accessible stylesheets for known design token prefixes
  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (
                prop.startsWith('--') &&
                KNOWN_PREFIXES.some((p) => prop.startsWith(p))
              ) {
                const value = computedStyle.getPropertyValue(prop).trim();
                if (value) variables[prop] = value;
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheets throw SecurityError -- skip silently
      }
    }
  } catch {
    // Stylesheet access blocked entirely
  }

  return variables;
}
