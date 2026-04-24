const POPOVER_WIDTH = 320;
const POPOVER_ESTIMATED_HEIGHT = 400;
const EDGE_MARGIN = 12;
const ANCHOR_GAP = 8;

export interface PopoverPosition {
  top: number;
  left: number;
}

export function calculatePopoverPosition(
  anchorRect: { left: number; top: number; width: number; height: number },
): PopoverPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorRect.left + anchorRect.width + ANCHOR_GAP;
  let top = anchorRect.top + anchorRect.height + ANCHOR_GAP;

  if (left + POPOVER_WIDTH > vw - EDGE_MARGIN) {
    left = anchorRect.left - POPOVER_WIDTH - ANCHOR_GAP;
  }

  if (top + POPOVER_ESTIMATED_HEIGHT > vh - EDGE_MARGIN) {
    top = anchorRect.top - POPOVER_ESTIMATED_HEIGHT - ANCHOR_GAP;
  }

  left = Math.max(EDGE_MARGIN, Math.min(left, vw - POPOVER_WIDTH - EDGE_MARGIN));
  top = Math.max(EDGE_MARGIN, top);

  return { top, left };
}
