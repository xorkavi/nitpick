import { mousePosition, isActive, showCommentBubble } from '../signals';

export function CommentCursor() {
  if (!isActive.value) return null;
  if (showCommentBubble.value) return null;

  const { x, y } = mousePosition.value;

  return (
    <svg
      class="nitpick-cursor"
      style={{ left: `${x}px`, top: `${y}px` }}
      aria-hidden="true"
      width="28"
      height="28"
      viewBox="0 0 42 42"
      fill="none"
    >
      <path
        d="M0 21C0 9.40202 9.40202 0 21 0V0C32.598 0 42 9.40202 42 21V21C42 32.598 32.598 42 21 42H1C0.447716 42 0 41.5523 0 41V21Z"
        fill="#009CFF"
      />
    </svg>
  );
}
