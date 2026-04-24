import { mountOverlay, unmountOverlay } from './overlay/ShadowHost';
import {
  isActive,
  hoveredElement,
  selectedElement,
  mousePosition,
  hoveredRect,
  selectedRect,
  isDragging,
  dragStart,
  dragEnd,
  areaSelection,
  showCommentBubble,
  commentText,
  showIssueCard,
  issueFormData,
  issueCardLoading,
} from './signals';
import { inspectElement } from './inspector/element-data';
import { getElementsInRect } from './inspector/area-elements';

let rafId: number | null = null;

// Drag detection state (local, not signals)
let isMouseDown = false;
let mouseDownPos: { x: number; y: number } | null = null;

function handleMouseMove(e: MouseEvent): void {
  // Update cursor position signal immediately
  mousePosition.value = { x: e.clientX, y: e.clientY };

  // Handle drag tracking when mouse button is held
  if (isMouseDown && mouseDownPos) {
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    // 4px minimum drag threshold per UI-SPEC D-174
    if (dx >= 4 || dy >= 4) {
      isDragging.value = true;
      dragEnd.value = { x: e.clientX, y: e.clientY };
    }
  }

  // Skip hover detection while dragging
  if (isDragging.value) return;

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

function handleMouseDown(e: MouseEvent): void {
  if (!isActive.value || e.button !== 0) return;
  isMouseDown = true;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  dragStart.value = { x: e.clientX, y: e.clientY };
}

function handleMouseUp(e: MouseEvent): void {
  if (!isActive.value) return;

  if (isDragging.value && dragStart.value && dragEnd.value) {
    // Area selection complete
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const rect = {
      left: Math.min(dragStart.value.x, dragEnd.value.x),
      top: Math.min(dragStart.value.y, dragEnd.value.y),
      width: Math.abs(dragEnd.value.x - dragStart.value.x),
      height: Math.abs(dragEnd.value.y - dragStart.value.y),
    };

    areaSelection.value = rect;
    selectedElement.value = null; // Clear single selection
    selectedRect.value = null;
    showCommentBubble.value = true;

    // Collect all elements in area per D-21
    const elements = getElementsInRect(rect);
    // Send to service worker
    chrome.runtime.sendMessage({
      action: 'AREA_SELECTED',
      data: {
        selectionRect: rect,
        elements,
        pageContext: { url: window.location.href, title: document.title },
      },
    });
  }

  // Reset drag state
  isDragging.value = false;
  isMouseDown = false;
  mouseDownPos = null;
  dragStart.value = null;
  dragEnd.value = null;
}

function handleClick(e: MouseEvent): void {
  if (!isActive.value) return;
  if (showCommentBubble.value) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const target = hoveredElement.value;
  if (!target) return;

  selectedElement.value = target;
  selectedRect.value = target.getBoundingClientRect();
  showCommentBubble.value = true;
  areaSelection.value = null;

  const metadata = inspectElement(target);
  chrome.runtime.sendMessage({ action: 'ELEMENT_SELECTED', data: metadata });
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
  document.addEventListener('mousedown', handleMouseDown, { capture: true });
  document.addEventListener('mouseup', handleMouseUp, { capture: true });
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
  isDragging.value = false;
  dragStart.value = null;
  dragEnd.value = null;
  areaSelection.value = null;
  showCommentBubble.value = false;
  commentText.value = '';
  showIssueCard.value = false;
  issueFormData.value = { title: '', description: '', part: '', owner: '', priority: '' };
  issueCardLoading.value = false;

  isMouseDown = false;
  mouseDownPos = null;

  document.removeEventListener('mousemove', handleMouseMove, {
    capture: true,
  });
  document.removeEventListener('mousedown', handleMouseDown, {
    capture: true,
  });
  document.removeEventListener('mouseup', handleMouseUp, { capture: true });
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
