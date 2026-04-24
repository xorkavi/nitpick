/**
 * Area element collection for drag selection.
 *
 * Per D-21: Capture data for ALL elements within the dragged region,
 * not just the topmost element.
 *
 * Strategy: Walk all elements in the document, check geometric
 * intersection with the selection rectangle, and include leaf-ish
 * elements (skip containers that have selected children).
 */

import type { ElementMetadata } from '../../shared/types';
import { inspectElement } from './element-data';

interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Find all leaf-ish elements whose bounding boxes intersect the given
 * selection rectangle. Returns full ElementMetadata for each.
 *
 * "Leaf-ish" means: if an element has children that also intersect
 * the rectangle, we skip the parent (it's a container) and include
 * the children instead. Elements with no children are always included.
 */
export function getElementsInRect(rect: SelectionRect): ElementMetadata[] {
  const all = document.querySelectorAll('*');
  const results: ElementMetadata[] = [];

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
        results.push(inspectElement(el));
      }
    }
  }

  return results;
}
