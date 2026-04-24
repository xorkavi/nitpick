import { selectedRect } from '../signals';

export function SelectionBox() {
  const rect = selectedRect.value;
  if (!rect) return null;

  return (
    <div
      class="nitpick-selection-box"
      style={{
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }}
      role="region"
      aria-label="Selected element"
    >
      <div class="nitpick-anchor nitpick-anchor--tl" />
      <div class="nitpick-anchor nitpick-anchor--tr" />
      <div class="nitpick-anchor nitpick-anchor--bl" />
      <div class="nitpick-anchor nitpick-anchor--br" />
    </div>
  );
}
