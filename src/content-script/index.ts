import { mountOverlay, unmountOverlay } from './overlay/ShadowHost';
import {
  isActive,
  hoveredElement,
  selectedElement,
  mousePosition,
  hoveredRect,
  selectedRect,
} from './signals';

let rafId: number | null = null;

function handleMouseMove(e: MouseEvent): void {
  // Update cursor position signal immediately
  mousePosition.value = { x: e.clientX, y: e.clientY };

  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (
      !target ||
      target === document.documentElement ||
      target === document.body
    ) {
      hoveredElement.value = null;
      hoveredRect.value = null;
      return;
    }

    // Recurse into open shadow roots per Research Pattern 4
    let deepTarget: Element = target;
    while (deepTarget.shadowRoot && deepTarget.shadowRoot.mode === 'open') {
      const inner = deepTarget.shadowRoot.elementFromPoint(
        e.clientX,
        e.clientY,
      );
      if (!inner || inner === deepTarget) break;
      deepTarget = inner;
    }

    // Skip if hovering over our own overlay
    if (deepTarget.closest?.('nitpick-overlay')) return;

    hoveredElement.value = deepTarget;
    hoveredRect.value = deepTarget.getBoundingClientRect();
  });
}

function handleClick(e: MouseEvent): void {
  if (!isActive.value) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const target = hoveredElement.value;
  if (!target) return;

  selectedElement.value = target;
  selectedRect.value = target.getBoundingClientRect();
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isActive.value) {
    deactivateCommentMode();
  }
}

function activateCommentMode(): void {
  if (isActive.value) return;
  isActive.value = true;
  mountOverlay();
  document.addEventListener('mousemove', handleMouseMove, { capture: true });
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
}

function deactivateCommentMode(): void {
  if (!isActive.value) return;
  isActive.value = false;
  hoveredElement.value = null;
  hoveredRect.value = null;
  selectedElement.value = null;
  selectedRect.value = null;
  mousePosition.value = { x: 0, y: 0 };

  document.removeEventListener('mousemove', handleMouseMove, {
    capture: true,
  });
  document.removeEventListener('click', handleClick, { capture: true });
  document.removeEventListener('keydown', handleKeyDown, { capture: true });

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  unmountOverlay();

  // Notify service worker
  chrome.runtime.sendMessage({ action: 'COMMENT_MODE_DEACTIVATED', tabId: 0 });
}

// Message listener for service worker communication
chrome.runtime.onMessage.addListener(
  (msg: { action: string }, _sender, sendResponse) => {
    if (msg.action === 'PING') {
      sendResponse({ pong: true });
      return;
    }
    if (msg.action === 'TOGGLE_COMMENT_MODE') {
      if (isActive.value) {
        deactivateCommentMode();
      } else {
        activateCommentMode();
      }
      return;
    }
  },
);
