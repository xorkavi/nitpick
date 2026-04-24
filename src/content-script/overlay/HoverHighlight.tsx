import { hoveredRect, selectedElement, hoveredElement } from '../signals';

export function HoverHighlight() {
  const rect = hoveredRect.value;
  if (!rect) return null;

  // Don't show hover highlight on the already-selected element
  if (selectedElement.value && hoveredElement.value === selectedElement.value) {
    return null;
  }

  return (
    <div
      class="nitpick-hover-highlight"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
      aria-hidden="true"
    >
      <div class="nitpick-anchor nitpick-anchor--tl" />
      <div class="nitpick-anchor nitpick-anchor--tr" />
      <div class="nitpick-anchor nitpick-anchor--bl" />
      <div class="nitpick-anchor nitpick-anchor--br" />
    </div>
  );
}
