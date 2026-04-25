import { COLORS } from '../shared/constants';

export async function captureScreenshots(
  tabId: number,
  boundingRect: { x: number; y: number; width: number; height: number },
  highlightRect?: { left: number; top: number; width: number; height: number },
  dpr: number = 1,
): Promise<{ viewport: string; cropped: string }> {
  // Step 1: Hide overlay, capture clean viewport for cropping (no blue highlight)
  await chrome.tabs.sendMessage(tabId, { action: 'HIDE_OVERLAY' });
  await new Promise(r => setTimeout(r, 50));
  const cleanDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });

  // Step 2: Show overlay back, capture viewport with highlight visible
  await chrome.tabs.sendMessage(tabId, { action: 'SHOW_OVERLAY' });
  await new Promise(r => setTimeout(r, 50));
  const viewportDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });

  // Step 3: Crop the clean capture (no overlay artifacts)
  await ensureOffscreenDocument();

  const croppedDataUrl = await new Promise<string>((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        target: 'offscreen',
        action: 'CROP_SCREENSHOT',
        viewportDataUrl: cleanDataUrl,
        cropRect: boundingRect,
        highlightRect: null,
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
