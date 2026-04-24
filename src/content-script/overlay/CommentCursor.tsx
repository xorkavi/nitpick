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
      width="24"
      height="32"
      viewBox="0 0 24 32"
      fill="none"
    >
      <path
        d="M1 1L1 22L7.5 16.5L12 25L16 23L11.5 14.5L20 14.5L1 1Z"
        fill="#0D99FF"
        stroke="white"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  );
}
