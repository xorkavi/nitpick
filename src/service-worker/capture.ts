import { COLORS } from '../shared/constants';

export async function captureScreenshots(
  tabId: number,
  boundingRect: { x: number; y: number; width: number; height: number },
  highlightRect?: { left: number; top: number; width: number; height: number },
  dpr: number = 1,
): Promise<{ viewport: string; cropped: string }> {
  // Single clean capture with overlay hidden — no comment bubble or highlight leaks
  await chrome.tabs.sendMessage(tabId, { action: 'HIDE_OVERLAY' });
  await new Promise(r => setTimeout(r, 80));
  const cleanDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
  await chrome.tabs.sendMessage(tabId, { action: 'SHOW_OVERLAY' });

  await ensureOffscreenDocument();

  // Crop: clean, no highlight
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
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(response?.croppedDataUrl ?? '');
      },
    );
  });

  // Viewport: draw selection highlight onto clean capture via offscreen canvas
  const viewportDataUrl = highlightRect
    ? await new Promise<string>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            target: 'offscreen',
            action: 'DRAW_HIGHLIGHT',
            viewportDataUrl: cleanDataUrl,
            highlightRect,
            highlightColor: COLORS.selectionBlue,
            dpr,
          },
          (response: { resultDataUrl: string } | undefined) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(response?.resultDataUrl ?? cleanDataUrl);
          },
        );
      })
    : cleanDataUrl;

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
