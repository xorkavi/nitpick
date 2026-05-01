/**
 * Area element collection for drag selection.
 *
 * Per D-21: Capture data for ALL elements within the dragged region,
 * not just the topmost element.
 *
 * Strategy: Walk all elements in the document, check geometric
 * intersection with the selection rectangle, and include leaf-ish
 * elements (skip containers that have selected children).
 *
 * Two-pass triage: stores Element refs so the content script can
 * run full inspectElement() on whichever element the AI picks as
 * the primary target.
 */

import type { ElementMetadata } from '../../shared/types';
import { inspectElement } from './element-data';

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

let lastAreaElementRefs: Element[] = [];

/**
 * Return the stored Element refs from the last area selection.
 * Used by the two-pass triage flow: AI picks an index, content script
 * looks up the ref and runs inspectElement() on it.
 */
export function getAreaElementRef(index: number): Element | null {
  return lastAreaElementRefs[index] ?? null;
}

export function clearAreaElementRefs(): void {
  lastAreaElementRefs = [];
}

/**
 * Find all leaf-ish elements whose bounding boxes intersect the given
 * selection rectangle. Returns full ElementMetadata for each.
 *
 * "Leaf-ish" means: if an element has children that also intersect
 * the rectangle, we skip the parent (it's a container) and include
 * the children instead. Elements with no children are always included.
 *
 * Also stores Element refs for two-pass triage via getAreaElementRef().
 */
export function getElementsInRect(rect: SelectionRect): ElementMetadata[] {
  const all = document.querySelectorAll('*');
  const results: ElementMetadata[] = [];
  const refs: Element[] = [];

  for (const el of all) {
    // Skip invisible elements
    if (
      !(el as HTMLElement).offsetParent &&
      el.tagName !== 'BODY' &&
      el.tagName !== 'HTML'
    )
      continue;

    // Skip our own overlay
    if (el.closest?.('nitpick-overlay')) continue;

    const elRect = el.getBoundingClientRect();

    // Skip zero-size elements
    if (elRect.width === 0 || elRect.height === 0) continue;

    // Check geometric intersection
    if (
      elRect.right > rect.left &&
      elRect.left < rect.left + rect.width &&
      elRect.bottom > rect.top &&
      elRect.top < rect.top + rect.height
    ) {
      // Include leaf-ish elements -- skip containers that have selected children
      const children = el.children;
      const hasSelectedChild = Array.from(children).some((child) => {
        const childRect = child.getBoundingClientRect();
        return (
          childRect.width > 0 &&
          childRect.height > 0 &&
          childRect.right > rect.left &&
          childRect.left < rect.left + rect.width &&
          childRect.bottom > rect.top &&
          childRect.top < rect.top + rect.height
        );
      });

      if (!hasSelectedChild || el.children.length === 0) {
        refs.push(el);
        results.push(inspectElement(el));
      }
    }
  }

  lastAreaElementRefs = refs;
  return results;
}
