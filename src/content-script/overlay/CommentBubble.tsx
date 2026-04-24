/**
 * Comment bubble popover -- Step 1 of the two-step popover flow.
 *
 * Per D-06: Anchored to selection's bottom-right pin. Contains ONLY a
 * text input and blue send button. No emoji, @mention, or image
 * attachment icons.
 *
 * Per UI-SPEC Copywriting:
 * - Placeholder: "What looks wrong?"
 * - Send button: Arrow icon only, aria-label="Send comment"
 * - Dialog: role="dialog" aria-label="Describe the bug"
 *
 * Per UI-SPEC Interaction:
 * - Send button active (blue) when input non-empty
 * - Send button disabled (gray) when input empty
 * - Enter key submits (Shift+Enter does not)
 */

import {
  showCommentBubble,
  commentText,
  showIssueCard,
  issueCardLoading,
  selectedRect,
  areaSelection,
} from '../signals';
import { calculatePopoverPosition } from './PopoverAnchor';

export function CommentBubble() {
  if (!showCommentBubble.value) return null;

  // Get anchor rect from single selection or area selection
  const sRect = selectedRect.value;
  const aRect = areaSelection.value;
  const anchorRect = sRect
    ? { left: sRect.left, top: sRect.top, width: sRect.width, height: sRect.height }
    : aRect;
  if (!anchorRect) return null;

  const pos = calculatePopoverPosition(anchorRect);

  function handleSend(): void {
    const text = commentText.value.trim();
    if (!text) return;
    showIssueCard.value = true;
    issueCardLoading.value = true;

    // Simulate AI processing (actual AI call wired in Phase 2)
    // For now, the loading state persists until Phase 2 connects the AI pipeline
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = commentText.value.trim().length > 0;

  return (
    <div
      class="nitpick-comment-bubble"
      style={{ top: `${pos.top}px`, left: `${pos.left}px`, pointerEvents: 'auto' }}
      role="dialog"
      aria-label="Describe the bug"
    >
      <div class="nitpick-comment-input-row">
        <input
          type="text"
          class="nitpick-comment-input"
          placeholder="What looks wrong?"
          value={commentText.value}
          onInput={(e) => {
            commentText.value = (e.target as HTMLInputElement).value;
          }}
          onKeyDown={handleKeyDown}
          autoFocus
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
  );
}
