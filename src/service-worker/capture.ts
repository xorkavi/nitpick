/**
 * Screenshot capture orchestration.
 *
 * Coordinates chrome.tabs.captureVisibleTab (viewport screenshot) with the
 * offscreen document (canvas cropping + highlight overlay) to produce two
 * screenshots: full viewport and cropped element detail.
 */

import { COLORS } from '../shared/constants';

export async function captureScreenshots(
  tabId: number,
  boundingRect: { x: number; y: number; width: number; height: number },
  highlightRect?: { left: number; top: number; width: number; height: number },
  dpr: number = 1,
): Promise<{ viewport: string; cropped: string }> {
  // Step 1: Capture full viewport as PNG data URL (current window)
  const viewportDataUrl = await chrome.tabs.captureVisibleTab({
    format: 'png',
  });

  // Step 2: Ensure offscreen document exists for canvas operations
  await ensureOffscreenDocument();

  // Step 3: Send crop request to offscreen document
  const croppedDataUrl = await new Promise<string>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        target: 'offscreen',
        action: 'CROP_SCREENSHOT',
        viewportDataUrl,
        cropRect: boundingRect,
        highlightRect: highlightRect ?? null,
        highlightColor: COLORS.selectionBlue,
        dpr,
      },
      (response: { croppedDataUrl: string } | undefined) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response?.croppedDataUrl ?? '');
      },
    );
  });

  return { viewport: viewportDataUrl, cropped: croppedDataUrl };
}

async function ensureOffscreenDocument(): Promise<void> {
  // Only one offscreen document per extension
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
