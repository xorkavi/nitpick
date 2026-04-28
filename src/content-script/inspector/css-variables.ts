/**
 * CSS custom property (variable) extraction from DOM elements.
 *
 * Extracts CSS variables from:
 * 1. Element's inline style (style="--var: value")
 * 2. All --* variables referenced by matched CSS rules on the element
 * 3. Fallback: accessible stylesheets matching known design token prefixes
 *
 * Per D-18: CSS custom properties are part of the captured element data.
 * Per D-17: This data is captured silently for AI consumption only.
 */

/** Fallback prefixes when rule matching isn't possible */
const KNOWN_PREFIXES = [
  '--color',
  '--font',
  '--space',
  '--radius',
  '--shadow',
  '--border',
  '--bg',
  '--text',
  '--input',
  '--surface',
  '--accent',
  '--ring',
  '--outline',
  '--icon',
  '--placeholder',
  '--foreground',
  '--background',
  '--muted',
  '--destructive',
  '--primary',
  '--secondary',
  '--card',
  '--popover',
  // DevRev design system token families
  '--fg',
  '--control',
  '--feedback',
  '--object',
  '--tag',
  '--navigation',
  '--chart',
  '--avatar',
  '--button',
  '--menu',
  '--tab',
];

/**
 * Describes which CSS class applied a given property to the element.
 */
export interface CSSSourceRule {
  property: string;
  value: string;
  selector: string;
  className: string | null;
}

/**
 * Extract all CSS variable names referenced in a property value string.
 * Handles nested var() references like var(--a, var(--b, fallback)).
 */
function extractVarReferences(value: string): string[] {
  const refs: string[] = [];
  const regex = /var\(\s*(--[a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = regex.exec(value)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

/**
 * Extract CSS custom properties from an element.
 *
 * Strategy:
 * 1. Inline styles: any --* property on the element
 * 2. Matched rules: scan stylesheets for rules that match the element,
 *    and collect ALL --* variables from those rules (not just known prefixes)
 * 3. Var references: for each collected variable's value, recursively resolve
 *    any var() references so the full chain is captured
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

  // Collect all --* variables from rules that match this element
  const matchedVarNames = new Set<string>();

  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;

          let matches = false;
          try {
            matches = el.matches(rule.selectorText);
          } catch {
            continue;
          }

          if (matches) {
            // Collect all --* properties from this matched rule
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (prop.startsWith('--')) {
                matchedVarNames.add(prop);
              }
            }

            // Also check if any property VALUE references a var()
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              const val = rule.style.getPropertyValue(prop);
              for (const ref of extractVarReferences(val)) {
                matchedVarNames.add(ref);
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

  // Resolve matched variables to their computed values
  for (const varName of matchedVarNames) {
    if (variables[varName]) continue; // inline already captured
    const value = computedStyle.getPropertyValue(varName).trim();
    if (value) {
      variables[varName] = value;

      // Follow any var() references in the value to capture the full chain
      for (const ref of extractVarReferences(value)) {
        if (!variables[ref] && !matchedVarNames.has(ref)) {
          const refValue = computedStyle.getPropertyValue(ref).trim();
          if (refValue) variables[ref] = refValue;
        }
      }
    }
  }

  // Fallback: if no matched rules found (e.g. all sheets cross-origin),
  // scan with expanded known prefix list
  if (matchedVarNames.size === 0) {
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
  }

  return variables;
}

/**
 * Find which CSS rule applied a specific property to the element.
 *
 * For styling bugs, knowing that `background-color` came from the class
 * `.input-bg-idle` (not just the computed value) is critical for finding
 * the fix target in source code.
 *
 * Returns the most-specific matching rule (last match wins in CSS cascade).
 */
export function findSourceRule(
  el: Element,
  targetProperty: string
): CSSSourceRule | null {
  let bestMatch: CSSSourceRule | null = null;

  try {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (!(rule instanceof CSSStyleRule)) continue;

          let matches = false;
          try {
            matches = el.matches(rule.selectorText);
          } catch {
            continue;
          }

          if (!matches) continue;

          const value = rule.style.getPropertyValue(targetProperty);
          if (!value) continue;

          // Extract the class name from the selector (the greppable part)
          const classMatch = rule.selectorText.match(/\.([a-zA-Z_-][\w-]*)/);

          bestMatch = {
            property: targetProperty,
            value: value.trim(),
            selector: rule.selectorText,
            className: classMatch ? classMatch[1] : null,
          };
        }
      } catch {
        // Cross-origin stylesheet
      }
    }
  } catch {
    // Stylesheet access blocked
  }

  return bestMatch;
}
