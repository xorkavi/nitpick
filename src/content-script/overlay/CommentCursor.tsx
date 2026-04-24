import { mousePosition, isActive } from '../signals';

export function CommentCursor() {
  if (!isActive.value) return null;

  const { x, y } = mousePosition.value;

  return (
    <div
      class="nitpick-cursor"
      style={{ left: `${x}px`, top: `${y}px` }}
      aria-hidden="true"
    />
  );
}
