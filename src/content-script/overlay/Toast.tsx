import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { showSuccessToast, createdIssueUrl } from '../signals';

export function Toast() {
  const isExiting = signal(false);

  useEffect(() => {
    if (!showSuccessToast.value) return;

    const dismissTimer = setTimeout(() => {
      isExiting.value = true;
      // Wait for exit animation before hiding
      const exitTimer = setTimeout(() => {
        showSuccessToast.value = false;
        isExiting.value = false;
      }, 200);
      return () => clearTimeout(exitTimer);
    }, 4000);

    return () => clearTimeout(dismissTimer);
  });

  if (!showSuccessToast.value) return null;

  const url = createdIssueUrl.value;

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
      <svg class="nitpick-toast-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.5" />
        <path d="M5.5 9.5L7.5 11.5L12.5 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span class="nitpick-toast-text">Issue created</span>
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
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2L10 10M2 10L10 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  );
}
