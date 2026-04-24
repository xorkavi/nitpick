/**
 * Popover positioning logic with viewport-aware flipping.
 *
 * Default: popover appears below and to the right of the anchor rect's
 * bottom-right corner. When near viewport edges, it flips horizontally
 * and/or vertically to remain fully visible.
 *
 * Per UI-SPEC:
 * - Popover max width: 320px
 * - Popover max height: 480px (scrollable if content overflows)
 * - Minimum distance from viewport edge: 12px
 * - Gap between anchor and popover: 8px
 */

const POPOVER_WIDTH = 320;
const POPOVER_MAX_HEIGHT = 480;
const EDGE_MARGIN = 12;
const ANCHOR_GAP = 8;

export interface PopoverPosition {
  top: number;
  left: number;
  flipX: boolean;
  flipY: boolean;
}

export function calculatePopoverPosition(
  anchorRect: { left: number; top: number; width: number; height: number },
): PopoverPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Default: below and to the right of bottom-right corner
  let left = anchorRect.left + anchorRect.width + ANCHOR_GAP;
  let top = anchorRect.top + anchorRect.height + ANCHOR_GAP;
  let flipX = false;
  let flipY = false;

  // Check right edge overflow
  if (left + POPOVER_WIDTH > vw - EDGE_MARGIN) {
    left = anchorRect.left - POPOVER_WIDTH - ANCHOR_GAP;
    flipX = true;
  }

  // Check bottom edge overflow
  if (top + POPOVER_MAX_HEIGHT > vh - EDGE_MARGIN) {
    top = anchorRect.top - POPOVER_MAX_HEIGHT - ANCHOR_GAP;
    flipY = true;
  }

  // Clamp to viewport
  left = Math.max(EDGE_MARGIN, Math.min(left, vw - POPOVER_WIDTH - EDGE_MARGIN));
  top = Math.max(EDGE_MARGIN, top);

  return { top, left, flipX, flipY };
}
