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
  popoverShaking,
  popoverAnchorPoint,
  screenshotsReady,
  croppedScreenshotUrl,
  viewportScreenshotUrl,
  aiStreamingDone,
  issueError,
  isCreatingIssue,
  createdIssueUrl,
  createdIssueDisplayId,
  showSuccessToast,
  lastSelectedMetadata,
  aiSuggestedPart,
  aiSuggestedOwner,
  userSearchResults,
  userSearchLoading,
  devrevSelf,
  devrevDataLoaded,
} from './signals';
import { inspectElement } from './inspector/element-data';
import { getElementsInRect, getAreaElementRef, clearAreaElementRefs } from './inspector/area-elements';

function detectActiveTheme(): string | null {
  return document.documentElement.getAttribute('data-theme')
    || document.body.getAttribute('data-theme')
    || null;
}

function detectColorScheme(): string {
  if (document.documentElement.classList.contains('light')) return 'light';
  if (document.documentElement.classList.contains('dark')) return 'dark';
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let rafId: number | null = null;

let isMouseDown = false;
let mouseDownPos: { x: number; y: number } | null = null;

function isOwnOverlay(e: Event): boolean {
  const target = e.target as Element | null;
  return !!target?.closest?.('nitpick-overlay');
}

function blockEvent(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

function handleMouseMove(e: MouseEvent): void {
  if (!isActive.value) return;

  mousePosition.value = { x: e.clientX, y: e.clientY };

  if (showCommentBubble.value) return;

  if (isMouseDown && mouseDownPos) {
    const dx = Math.abs(e.clientX - mouseDownPos.x);
    const dy = Math.abs(e.clientY - mouseDownPos.y);
    if (dx >= 4 || dy >= 4) {
      if (!isDragging.value) {
        hoveredElement.value = null;
        hoveredRect.value = null;
      }
      isDragging.value = true;
      dragEnd.value = { x: e.clientX, y: e.clientY };
    }
  }

  if (isDragging.value) return;

  if (rafId !== null) return;

  rafId = requestAnimationFrame(() => {
    rafId = null;

    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target === document.documentElement || target === document.body) {
      hoveredElement.value = null;
      hoveredRect.value = null;
      return;
    }

    let deepTarget: Element = target;
    while (deepTarget.shadowRoot && deepTarget.shadowRoot.mode === 'open') {
      const inner = deepTarget.shadowRoot.elementFromPoint(e.clientX, e.clientY);
      if (!inner || inner === deepTarget) break;
      deepTarget = inner;
    }

    if (deepTarget.closest?.('nitpick-overlay')) return;

    hoveredElement.value = deepTarget;
    hoveredRect.value = deepTarget.getBoundingClientRect();
  });
}

function handleMouseDown(e: MouseEvent): void {
  if (!isActive.value || e.button !== 0) return;
  if (isOwnOverlay(e)) return;
  blockEvent(e);

  if (showCommentBubble.value) return;

  isMouseDown = true;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  dragStart.value = { x: e.clientX, y: e.clientY };
}

function handleMouseUp(e: MouseEvent): void {
  if (!isActive.value) return;
  if (isOwnOverlay(e)) {
    isMouseDown = false;
    mouseDownPos = null;
    return;
  }
  blockEvent(e);

  if (showCommentBubble.value) return;

  if (isDragging.value && dragStart.value && dragEnd.value) {
    const rect = {
      left: Math.min(dragStart.value.x, dragEnd.value.x),
      top: Math.min(dragStart.value.y, dragEnd.value.y),
      width: Math.abs(dragEnd.value.x - dragStart.value.x),
      height: Math.abs(dragEnd.value.y - dragStart.value.y),
    };

    areaSelection.value = rect;
    selectedElement.value = null;
    selectedRect.value = null;
    popoverAnchorPoint.value = { x: rect.left + rect.width, y: rect.top + rect.height };
    showCommentBubble.value = true;

    const elements = getElementsInRect(rect);
    const areaMetadata = {
      selectionRect: rect,
      elements,
      pageContext: { url: window.location.href, title: document.title },
    };
    lastSelectedMetadata.value = areaMetadata;
    chrome.runtime.sendMessage({
      action: 'AREA_SELECTED',
      data: areaMetadata,
    });

    // Trigger screenshot capture for area selection (D-01)
    chrome.runtime.sendMessage({
      action: 'CAPTURE_SCREENSHOTS',
      boundingRect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
      dpr: window.devicePixelRatio,
      browserMetadata: {
        url: window.location.href,
        title: document.title,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        platform: navigator.platform,
        activeTheme: detectActiveTheme(),
        colorScheme: detectColorScheme(),
      },
    });
  }

  isDragging.value = false;
  isMouseDown = false;
  mouseDownPos = null;
  dragStart.value = null;
  dragEnd.value = null;
}

function handleClick(e: MouseEvent): void {
  if (!isActive.value) return;
  if (isOwnOverlay(e)) return;
  blockEvent(e);

  if (showCommentBubble.value) {
    if (commentText.value.trim()) {
      popoverShaking.value = true;
    }
    return;
  }

  const target = hoveredElement.value;
  if (!target) return;

  selectedElement.value = target;
  selectedRect.value = target.getBoundingClientRect();
  areaSelection.value = null;
  popoverAnchorPoint.value = { x: e.clientX, y: e.clientY };
  showCommentBubble.value = true;

  const metadata = inspectElement(target);
  lastSelectedMetadata.value = metadata;
  chrome.runtime.sendMessage({ action: 'ELEMENT_SELECTED', data: metadata });

  // Trigger screenshot capture (D-01: immediately on selection)
  const rect = target.getBoundingClientRect();
  chrome.runtime.sendMessage({
    action: 'CAPTURE_SCREENSHOTS',
    boundingRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    dpr: window.devicePixelRatio,
    browserMetadata: {
      url: window.location.href,
      title: document.title,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      platform: navigator.platform,
      activeTheme: document.documentElement.getAttribute('data-theme'),
      colorScheme: document.documentElement.classList.contains('light') ? 'light' : 'dark',
    },
  });
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

  // Prefetch DevRev data for dropdowns (D-14)
  chrome.runtime.sendMessage(
    { action: 'PREFETCH_DEVREV_DATA' },
    (response: { action?: string; parts?: unknown[]; users?: unknown[]; self?: unknown; orgName?: string; message?: string } | undefined) => {
      if (chrome.runtime.lastError) {
        console.warn('[Nitpick] DevRev prefetch failed:', chrome.runtime.lastError.message);
        return;
      }
      if (response && response.action === 'DEVREV_DATA_READY') {
        const self = (response.self || null) as import('../shared/types').DevRevUser | null;
        if (self && response.orgName) self.org_name = response.orgName;
        devrevSelf.value = self;
        devrevDataLoaded.value = true;
      } else if (response && response.action === 'ERROR') {
        console.warn('[Nitpick] DevRev prefetch error:', response.message);
      }
    },
  );
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
  issueFormData.value = {
    title: '', description: '',
    part: '', partId: '',
    owner: '', ownerId: '',
    priority: 'P2', priorityId: 'p2',
  };
  issueCardLoading.value = false;
  popoverAnchorPoint.value = null;

  // Phase 2 signal resets
  screenshotsReady.value = false;
  croppedScreenshotUrl.value = null;
  viewportScreenshotUrl.value = null;
  aiStreamingDone.value = false;
  issueError.value = null;
  isCreatingIssue.value = false;
  createdIssueUrl.value = null;
  createdIssueDisplayId.value = null;
  showSuccessToast.value = false;
  userSearchResults.value = [];
  userSearchLoading.value = false;
  lastSelectedMetadata.value = null;
  aiSuggestedPart.value = undefined;
  aiSuggestedOwner.value = undefined;

  isMouseDown = false;
  mouseDownPos = null;
  clearAreaElementRefs();

  document.removeEventListener('mousemove', handleMouseMove, { capture: true });
  document.removeEventListener('mousedown', handleMouseDown, { capture: true });
  document.removeEventListener('mouseup', handleMouseUp, { capture: true });
  document.removeEventListener('click', handleClick, { capture: true });
  document.removeEventListener('keydown', handleKeyDown, { capture: true });

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  unmountOverlay();

  chrome.runtime.sendMessage({ action: 'COMMENT_MODE_DEACTIVATED', tabId: 0 });
}

chrome.runtime.onMessage.addListener(
  (msg: { action: string; croppedScreenshotUrl?: string; viewportScreenshotUrl?: string }, _sender, sendResponse) => {
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
    if (msg.action === 'RELAY_SCREENSHOTS') {
      if (msg.croppedScreenshotUrl) {
        croppedScreenshotUrl.value = msg.croppedScreenshotUrl;
      }
      if (msg.viewportScreenshotUrl) {
        viewportScreenshotUrl.value = msg.viewportScreenshotUrl;
      }
      return;
    }
    if (msg.action === 'INSPECT_AREA_ELEMENT') {
      const index = (msg as unknown as { index: number }).index;
      const el = getAreaElementRef(index);
      if (el) {
        sendResponse({ metadata: inspectElement(el) });
      } else {
        sendResponse({ metadata: null });
      }
      return true;
    }
    if (msg.action === 'HIDE_OVERLAY') {
      const host = document.querySelector('nitpick-overlay') as HTMLElement | null;
      if (host) host.style.display = 'none';
      sendResponse({ ok: true });
      return;
    }
    if (msg.action === 'SHOW_OVERLAY') {
      const host = document.querySelector('nitpick-overlay') as HTMLElement | null;
      if (host) host.style.display = '';
      sendResponse({ ok: true });
      return;
    }
  },
);
