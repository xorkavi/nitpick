export async function captureScreenshots(
  tabId: number,
  boundingRect: { x: number; y: number; width: number; height: number },
  dpr: number = 1,
): Promise<{ viewport: string; cropped: string }> {
  const viewportDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });

  await ensureOffscreenDocument();

  const croppedDataUrl = await new Promise<string>((resolve) => {
    chrome.runtime.sendMessage(
      {
        target: 'offscreen',
        action: 'CROP_SCREENSHOT',
        viewportDataUrl,
        cropRect: boundingRect,
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
