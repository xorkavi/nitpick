import {
  showCommentBubble,
  commentText,
  showIssueCard,
  issueCardLoading,
  issueFormData,
  popoverShaking,
  popoverAnchorPoint,
  aiStreamingDone,
  issueError,
  aiSuggestedPart,
  aiSuggestedOwner,
  lastSelectedMetadata,
  devrevSelf,
} from '../signals';
import { IssueCard } from './IssueCard';

const POPOVER_WIDTH = 320;
const EDGE_MARGIN = 12;
const GAP = 8;
const BOTTOM_THRESHOLD = 200;

export function CommentBubble() {
  if (!showCommentBubble.value) return null;

  const anchor = popoverAnchorPoint.value;
  if (!anchor) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchor.x + GAP;
  if (left + POPOVER_WIDTH > vw - EDGE_MARGIN) {
    left = anchor.x - POPOVER_WIDTH - GAP;
  }
  left = Math.max(EDGE_MARGIN, Math.min(left, vw - POPOVER_WIDTH - EDGE_MARGIN));

  const nearBottom = anchor.y > vh - BOTTOM_THRESHOLD;

  const posStyle: Record<string, string> = { left: `${left}px`, pointerEvents: 'auto' };

  if (nearBottom) {
    posStyle.bottom = `${vh - anchor.y + GAP}px`;
  } else {
    posStyle.top = `${anchor.y + GAP}px`;
  }

  function handleSend(): void {
    const text = commentText.value.trim();
    if (!text) return;

    // Show issue card with loading skeleton
    showIssueCard.value = true;
    issueCardLoading.value = true;
    aiStreamingDone.value = false;
    issueError.value = null;
    aiSuggestedPart.value = undefined;
    aiSuggestedOwner.value = undefined;

    // Set default owner to self (D-16)
    const self = devrevSelf.value;
    if (self) {
      issueFormData.value = {
        ...issueFormData.value,
        owner: self.display_name,
        ownerId: self.id,
      };
    }

    const metadata = lastSelectedMetadata.value;
    if (!metadata) {
      issueError.value = 'No element selected. Please select an element first.';
      issueCardLoading.value = false;
      return;
    }

    // Open port-based streaming connection (D-10)
    const port = chrome.runtime.connect({ name: 'ai-stream' });

    port.postMessage({
      action: 'AI_ANALYZE',
      comment: text,
      metadata,
    });

    port.onMessage.addListener((msg: {
      action: string;
      delta?: string;
      snapshot?: string;
      title?: string;
      description?: string;
      suggestedPart?: string;
      suggestedOwner?: string;
      message?: string;
    }) => {
      switch (msg.action) {
        case 'AI_CHUNK': {
          // Parse streaming content using TITLE/DESCRIPTION markers
          const content = msg.snapshot || '';
          const titleMarker = content.indexOf('TITLE:');
          const descMarker = content.indexOf('DESCRIPTION:');

          if (titleMarker !== -1 && descMarker !== -1) {
            const titleText = content.slice(titleMarker + 6, descMarker).trim();
            const descText = content.slice(descMarker + 12).trim();
            issueFormData.value = {
              ...issueFormData.value,
              title: titleText,
              description: descText,
            };
          } else if (titleMarker !== -1) {
            const titleText = content.slice(titleMarker + 6).trim();
            issueFormData.value = { ...issueFormData.value, title: titleText };
          }

          // Turn off skeleton once first token arrives (D-17)
          issueCardLoading.value = false;
          break;
        }
        case 'AI_DONE': {
          // Set final parsed values
          issueFormData.value = {
            ...issueFormData.value,
            title: msg.title || issueFormData.value.title,
            description: msg.description || issueFormData.value.description,
          };

          // Store AI suggestions (D-08, D-16: shown as recommendations, not auto-filled)
          aiSuggestedPart.value = msg.suggestedPart;
          aiSuggestedOwner.value = msg.suggestedOwner;

          aiStreamingDone.value = true;
          issueCardLoading.value = false;
          port.disconnect();
          break;
        }
        case 'AI_ERROR': {
          issueError.value = msg.message || 'AI analysis failed';
          issueCardLoading.value = false;
          port.disconnect();
          break;
        }
      }
    });

    // Handle port disconnect (Research Pitfall 5)
    port.onDisconnect.addListener(() => {
      if (!aiStreamingDone.value && !issueError.value) {
        issueError.value = 'Connection to AI lost. Please retry.';
        issueCardLoading.value = false;
      }
    });
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

  let containerClass = 'nitpick-popover-container';
  if (shaking) containerClass += ' nitpick-popover-container--shake';
  if (nearBottom) containerClass += ' nitpick-popover-container--flipped';

  return (
    <div
      class={containerClass}
      style={posStyle}
      onAnimationEnd={() => { popoverShaking.value = false; }}
    >
      {nearBottom ? (
        <>
          <IssueCard />
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
                  <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
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
                  <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <IssueCard />
        </>
      )}
    </div>
  );
}
