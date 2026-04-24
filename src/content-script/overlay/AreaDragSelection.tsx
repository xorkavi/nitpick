/**
 * Area drag selection rectangle overlay.
 *
 * Per D-03: Blue dashed rectangle with circle anchors at top-left and
 * bottom-right ONLY (2 anchors, not 4). This differentiates area drag
 * selection from hover/click selection which uses 4 corner anchors.
 *
 * Shows during active drag (isDragging + dragRect) and after drag
 * completes (areaSelection).
 */

import { isDragging, dragRect, areaSelection } from '../signals';

export function AreaDragSelection() {
  // Show during active drag
  const activeDrag = isDragging.value ? dragRect.value : null;
  // Show completed area selection
  const completed = areaSelection.value;

  const rect = activeDrag || completed;
  if (!rect) return null;

  return (
    <div
      class="nitpick-drag-selection"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
      aria-hidden="true"
    >
      <div class="nitpick-anchor nitpick-anchor--tl" />
      <div class="nitpick-anchor nitpick-anchor--br" />
    </div>
  );
}
