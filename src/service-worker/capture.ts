import { COLORS } from '../shared/constants';

async function sendAndWait(tabId: number, action: string): Promise<void> {
  return new Promise<void>((resolve) => {
    chrome.tabs.sendMessage(tabId, { action }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
      resolve();
    });
  });
}

export async function captureScreenshots(
  tabId: number,
  boundingRect: { x: number; y: number; width: number; height: number },
  highlightRect?: { left: number; top: number; width: number; height: number },
  dpr: number = 1,
): Promise<{ viewport: string; cropped: string }> {
  await ensureOffscreenDocument();

  // Hide overlay and wait for confirmation + paint
  await sendAndWait(tabId, 'HIDE_OVERLAY');
  await new Promise(r => setTimeout(r, 150));

  // Capture clean page (no overlay at all)
  const cleanDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });

  // Restore overlay immediately
  await sendAndWait(tabId, 'SHOW_OVERLAY');

  // Both operations use the same clean capture — no race conditions
  const [croppedDataUrl, viewportDataUrl] = await Promise.all([
    // Crop: just the element area, clean
    offscreenCrop(cleanDataUrl, boundingRect, dpr),
    // Viewport: draw highlight onto the clean capture
    highlightRect
      ? offscreenDrawHighlight(cleanDataUrl, highlightRect, dpr)
      : Promise.resolve(cleanDataUrl),
  ]);

  return { viewport: viewportDataUrl, cropped: croppedDataUrl };
}

function offscreenCrop(
  viewportDataUrl: string,
  cropRect: { x: number; y: number; width: number; height: number },
  dpr: number,
): Promise<string> {
  return new Promise<string>((resolve) => {
    chrome.runtime.sendMessage(
      {
        target: 'offscreen',
        action: 'CROP_SCREENSHOT',
        viewportDataUrl,
        cropRect,
        highlightRect: null,
        highlightColor: COLORS.selectionBlue,
        dpr,
      },
      (response: { croppedDataUrl?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          console.error('[Nitpick] Crop failed:', chrome.runtime.lastError.message);
          resolve('');
          return;
        }
        resolve(response?.croppedDataUrl ?? '');
      },
    );
  });
}

function offscreenDrawHighlight(
  viewportDataUrl: string,
  highlightRect: { left: number; top: number; width: number; height: number },
  dpr: number,
): Promise<string> {
  return new Promise<string>((resolve) => {
    chrome.runtime.sendMessage(
      {
        target: 'offscreen',
        action: 'DRAW_HIGHLIGHT',
        viewportDataUrl,
        highlightRect,
        highlightColor: COLORS.selectionBlue,
        dpr,
      },
      (response: { resultDataUrl?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          console.error('[Nitpick] Highlight draw failed:', chrome.runtime.lastError.message);
          resolve(viewportDataUrl);
          return;
        }
        resolve(response?.resultDataUrl ?? viewportDataUrl);
      },
    );
  });
}

async function ensureOffscreenDocument(): Promise<void> {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: [chrome.offscreen.Reason.BLOBS],
    justification: 'Crop screenshot using Canvas API',
  });
}
