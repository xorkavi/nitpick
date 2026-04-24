import {
  showCommentBubble,
  commentText,
  showIssueCard,
  issueCardLoading,
  popoverShaking,
  popoverAnchorPoint,
} from '../signals';
import { IssueCard } from './IssueCard';

const POPOVER_WIDTH = 320;
const EDGE_MARGIN = 12;
const GAP = 8;

export function CommentBubble() {
  if (!showCommentBubble.value) return null;

  const anchor = popoverAnchorPoint.value;
  if (!anchor) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchor.x + GAP;
  let top = anchor.y + GAP;

  if (left + POPOVER_WIDTH > vw - EDGE_MARGIN) {
    left = anchor.x - POPOVER_WIDTH - GAP;
  }

  if (top + 400 > vh - EDGE_MARGIN) {
    top = anchor.y - 400 - GAP;
  }

  left = Math.max(EDGE_MARGIN, Math.min(left, vw - POPOVER_WIDTH - EDGE_MARGIN));
  top = Math.max(EDGE_MARGIN, top);

  function handleSend(): void {
    const text = commentText.value.trim();
    if (!text) return;
    showIssueCard.value = true;
    issueCardLoading.value = true;
    setTimeout(() => { issueCardLoading.value = false; }, 1500);
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    commentText.value = el.value;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  const canSend = commentText.value.trim().length > 0;
  const shaking = popoverShaking.value;

  const containerClass = shaking
    ? 'nitpick-popover-container nitpick-popover-container--shake'
    : 'nitpick-popover-container';

  return (
    <div
      class={containerClass}
      style={{ top: `${top}px`, left: `${left}px`, pointerEvents: 'auto' }}
      onAnimationEnd={() => { popoverShaking.value = false; }}
    >
      <div class="nitpick-comment-bubble" role="dialog" aria-label="Describe the bug">
        <div class="nitpick-comment-input-row">
          <textarea
            class="nitpick-comment-input"
            placeholder="What looks wrong?"
            value={commentText.value}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={1}
          />
          <button
            class={`nitpick-send-btn ${canSend ? 'nitpick-send-btn--active' : ''}`}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send comment"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
      <IssueCard />
    </div>
  );
}
