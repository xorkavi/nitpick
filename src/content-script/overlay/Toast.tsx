import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { showSuccessToast, createdIssueUrl, createdIssueDisplayId } from '../signals';

export function Toast() {
  const isExiting = useSignal(false);

  useEffect(() => {
    if (!showSuccessToast.value) return;

    const dismissTimer = setTimeout(() => {
      isExiting.value = true;
      const exitTimer = setTimeout(() => {
        showSuccessToast.value = false;
        isExiting.value = false;
      }, 200);
      return () => clearTimeout(exitTimer);
    }, 6000);

    return () => clearTimeout(dismissTimer);
  });

  if (!showSuccessToast.value) return null;

  const url = createdIssueUrl.value;
  const displayId = createdIssueDisplayId.value;

  function handleLinkClick(e: MouseEvent): void {
    e.preventDefault();
    if (url) {
      window.open(url, '_blank');
    }
  }

  function handleDismiss(): void {
    isExiting.value = true;
    setTimeout(() => {
      showSuccessToast.value = false;
      isExiting.value = false;
    }, 200);
  }

  return (
    <div class={`nitpick-toast ${isExiting.value ? 'nitpick-toast--exiting' : ''}`}>
      <div class="nitpick-toast-progress" />
      <svg class="nitpick-toast-icon" width="16" height="16" viewBox="0 0 32 32" fill="currentColor">
        <path d="M23.735 9.825c-3.91 3.96-7.42 8.87-9.69 13.94h-1.6l-4.18-4.93 1.71-1.45a20.9 20.9 0 0 1 2.938 4.51l.45-.01c.728-1.924 3.43-8.283 8.782-13.65z"/>
      </svg>
      <span class="nitpick-toast-text">
        {displayId ? `${displayId} created. Link copied to clipboard.` : 'Issue created'}
      </span>
      {url && (
        <a
          href={url}
          class="nitpick-toast-link"
          onClick={handleLinkClick}
        >
          View in DevRev
        </a>
      )}
      <button class="nitpick-toast-close" onClick={handleDismiss} aria-label="Dismiss">
        <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
          <path d="M17.208 16.194a100 100 0 0 1 6.662 6.081l-1.59 1.59c-1.2-1.16-2.32-2.39-3.45-3.62-.894-1.006-1.789-2.004-2.65-3.04H15.8a93 93 0 0 1-6.081 6.66l-1.59-1.59c1.17-1.19 2.4-2.32 3.63-3.45 1.006-.885 1.995-1.78 3.032-2.641v-.378A100 100 0 0 1 8.13 9.725l1.59-1.59c1.2 1.16 2.32 2.4 3.45 3.62.894 1.006 1.789 2.003 2.65 3.04h.378a93 93 0 0 1 6.082-6.66l1.59 1.59c-1.17 1.19-2.4 2.32-3.63 3.45-1.006.894-1.995 1.78-3.031 2.641z"/>
        </svg>
      </button>
    </div>
  );
}
