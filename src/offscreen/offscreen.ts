chrome.runtime.onMessage.addListener(
  (
    msg: {
      target?: string;
      action?: string;
      viewportDataUrl?: string;
      cropRect?: { x: number; y: number; width: number; height: number };
      dpr?: number;
    },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { croppedDataUrl: string }) => void,
  ): boolean | undefined => {
    if (msg.target !== 'offscreen') return;

    if (msg.action === 'CROP_SCREENSHOT') {
      cropScreenshot(
        msg.viewportDataUrl!,
        msg.cropRect!,
        msg.dpr ?? 1,
      )
        .then((croppedDataUrl) => sendResponse({ croppedDataUrl }))
        .catch((err) => {
          console.error('[Nitpick Offscreen] Crop failed:', err);
          sendResponse({ croppedDataUrl: '' });
        });
      return true;
    }

    return undefined;
  },
);

async function cropScreenshot(
  viewportDataUrl: string,
  cropRect: { x: number; y: number; width: number; height: number },
  dpr: number,
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = viewportDataUrl;
  });

  const sx = cropRect.x * dpr;
  const sy = cropRect.y * dpr;
  const sw = cropRect.width * dpr;
  const sh = cropRect.height * dpr;

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  return canvas.toDataURL('image/png');
}
