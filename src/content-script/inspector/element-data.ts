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

import type { ElementMetadata, AncestorInfo, SiblingInfo, ChildInfo } from '../../shared/types';
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
function isTailwindUtility(cls: string): boolean {
  if (/^-?[a-z]+-\[/.test(cls)) return true; // arbitrary value: p-[12px], text-[#fff]
  if (/^-?(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|w|h|min-w|min-h|max-w|max-h|gap|space-x|space-y|top|right|bottom|left|inset|z|order|basis|grow|shrink|col-span|row-span|col-start|col-end|row-start|row-end|text|font|leading|tracking|bg|from|via|to|border|rounded|shadow|opacity|blur|brightness|contrast|ring|outline|transition|duration|delay|ease|translate-x|translate-y|rotate|scale|skew-x|skew-y|origin|cursor|line-clamp|decoration|indent|columns|aspect)-/.test(cls)) return true;
  const EXACT = new Set(['flex','grid','inline','block','inline-block','inline-flex','inline-grid','contents','hidden','table','flow-root','absolute','relative','fixed','sticky','static','visible','invisible','collapse','truncate','overflow-hidden','overflow-auto','overflow-scroll','overflow-visible','overline','underline','no-underline','uppercase','lowercase','capitalize','normal-case','italic','not-italic','antialiased','subpixel-antialiased','sr-only','not-sr-only','isolate','break-normal','break-words','break-all','pointer-events-none','pointer-events-auto','resize','select-none','select-text','select-all','select-auto','snap-none','snap-start','snap-end','snap-center','whitespace-normal','whitespace-nowrap','whitespace-pre','whitespace-pre-line','whitespace-pre-wrap','flex-row','flex-col','flex-row-reverse','flex-col-reverse','flex-wrap','flex-nowrap','flex-wrap-reverse','flex-1','flex-auto','flex-initial','flex-none','grid-flow-row','grid-flow-col','grid-flow-dense','place-content-center','place-content-start','place-content-end','place-items-center','place-items-start','place-items-end','items-start','items-end','items-center','items-baseline','items-stretch','justify-start','justify-end','justify-center','justify-between','justify-around','justify-evenly','self-auto','self-start','self-end','self-center','self-stretch','self-baseline','object-contain','object-cover','object-fill','object-none','object-scale-down','float-right','float-left','float-none','clear-left','clear-right','clear-both','clear-none','box-border','box-content','table-auto','table-fixed','border-collapse','border-separate','animate-none','animate-spin','animate-ping','animate-pulse','animate-bounce','will-change-auto','will-change-scroll','will-change-contents','will-change-transform','transform-gpu']);
  return EXACT.has(cls);
}

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
      const classes = Array.from(current.classList)
        .filter((c) => !isTailwindUtility(c))
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

const INTERESTING_HTML_ATTRS = ['role', 'aria-label', 'aria-expanded', 'type', 'name', 'href', 'src', 'alt', 'title', 'placeholder', 'value', 'disabled', 'size', 'variant'];

function extractDataAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

function extractHtmlAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const name of INTERESTING_HTML_ATTRS) {
    const val = el.getAttribute(name);
    if (val !== null) attrs[name] = val;
  }
  return attrs;
}

function getReactComponentName(el: Element): string | null {
  try {
    const keys = Object.keys(el);
    const fiberKey = keys.find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    if (!fiberKey) return null;
    let fiber = (el as unknown as Record<string, unknown>)[fiberKey] as Record<string, unknown> | null;
    for (let i = 0; i < 10 && fiber; i++) {
      const type = fiber.type as ((...args: unknown[]) => unknown) | { displayName?: string; name?: string } | null;
      if (typeof type === 'function' || (typeof type === 'object' && type !== null)) {
        const name = (type as { displayName?: string }).displayName
          || (type as { name?: string }).name
          || null;
        if (name && name.length > 1 && name[0] === name[0].toUpperCase()) {
          return name;
        }
      }
      fiber = fiber.return as Record<string, unknown> | null;
    }
  } catch {
    // Fiber access can fail — best-effort only
  }
  return null;
}

const ANCESTOR_STYLE_PROPERTIES = [
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'display', 'position', 'flex-direction', 'gap', 'align-items', 'justify-content',
  'overflow', 'max-width', 'max-height', 'min-width', 'min-height',
  'width', 'height',
] as const;

function buildAncestorChain(el: Element, depth: number = 4): AncestorInfo[] {
  const chain: AncestorInfo[] = [];
  let current = el.parentElement;
  for (let i = 0; i < depth && current && current !== document.documentElement; i++) {
    const cs = window.getComputedStyle(current);
    const styles: Record<string, string> = {};
    for (const prop of ANCESTOR_STYLE_PROPERTIES) {
      const val = cs.getPropertyValue(prop);
      if (val) styles[prop] = val;
    }
    chain.push({
      tagName: current.tagName.toLowerCase(),
      classList: Array.from(current.classList),
      dataAttributes: extractDataAttributes(current),
      reactComponentName: getReactComponentName(current),
      computedStyles: styles,
    });
    current = current.parentElement;
  }
  return chain;
}

function buildSiblingContext(el: Element, max: number = 5): SiblingInfo[] {
  const parent = el.parentElement;
  if (!parent) return [];
  const siblings: SiblingInfo[] = [];
  for (const child of parent.children) {
    if (child === el) continue;
    if (siblings.length >= max) break;
    const childRect = child.getBoundingClientRect();
    if (childRect.width === 0 || childRect.height === 0) continue;
    const cs = window.getComputedStyle(child);
    const styles: Record<string, string> = {};
    for (const prop of CHILD_SIBLING_STYLE_PROPERTIES) {
      const val = cs.getPropertyValue(prop);
      if (val) styles[prop] = val;
    }
    siblings.push({
      tagName: child.tagName.toLowerCase(),
      textContent: (child.textContent || '').trim().slice(0, 80),
      classList: Array.from(child.classList),
      dataAttributes: extractDataAttributes(child),
      htmlAttributes: extractHtmlAttributes(child),
      reactComponentName: getReactComponentName(child),
      computedStyles: styles,
    });
  }
  return siblings;
}

const CHILD_SIBLING_STYLE_PROPERTIES = [
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'font-size', 'font-weight', 'line-height', 'color', 'background-color',
  'opacity', 'z-index', 'border-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'display', 'position', 'overflow', 'white-space', 'text-overflow',
  'flex-direction', 'gap', 'align-items', 'justify-content',
] as const;

function buildChildContext(el: Element, max: number = 8): ChildInfo[] {
  const children: ChildInfo[] = [];
  for (const child of el.children) {
    if (children.length >= max) break;
    const childRect = child.getBoundingClientRect();
    if (childRect.width === 0 || childRect.height === 0) continue;
    const cs = window.getComputedStyle(child);
    const styles: Record<string, string> = {};
    for (const prop of CHILD_SIBLING_STYLE_PROPERTIES) {
      const val = cs.getPropertyValue(prop);
      if (val) styles[prop] = val;
    }
    children.push({
      tagName: child.tagName.toLowerCase(),
      textContent: (child.textContent || '').trim().slice(0, 80),
      classList: Array.from(child.classList),
      dataAttributes: extractDataAttributes(child),
      htmlAttributes: extractHtmlAttributes(child),
      reactComponentName: getReactComponentName(child),
      computedStyles: styles,
    });
  }
  return children;
}

export function inspectElement(el: Element): ElementMetadata {
  const rect = el.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(el);

  const computedStyles: Record<string, string> = {};
  for (const prop of VISUAL_PROPERTIES) {
    const value = computedStyle.getPropertyValue(prop);
    if (value) computedStyles[prop] = value;
  }

  const cssVariables = extractCSSVariables(el, computedStyle);

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
    dataAttributes: extractDataAttributes(el),
    htmlAttributes: extractHtmlAttributes(el),
    reactComponentName: getReactComponentName(el),
    ancestorChain: buildAncestorChain(el),
    siblingContext: buildSiblingContext(el),
    childContext: buildChildContext(el),
    contrastRatio,
    pageContext: {
      url: window.location.href,
      title: document.title,
    },
  };
}
