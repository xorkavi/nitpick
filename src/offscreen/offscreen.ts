/**
 * Offscreen document for canvas-based screenshot cropping.
 *
 * MV3 service workers have no DOM or Canvas API. This offscreen document
 * provides a headless DOM context where we can load images, draw to canvas,
 * and export cropped screenshots as PNG data URLs.
 *
 * CRITICAL: Uses the `dpr` value from the incoming message, NOT
 * `window.devicePixelRatio`, because offscreen documents may report DPR as 1.
 */

chrome.runtime.onMessage.addListener(
  (
    msg: {
      target?: string;
      action?: string;
      viewportDataUrl?: string;
      cropRect?: { x: number; y: number; width: number; height: number };
      highlightRect?: {
        left: number;
        top: number;
        width: number;
        height: number;
      } | null;
      highlightColor?: string;
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
        msg.highlightRect ?? null,
        msg.highlightColor ?? '#0D99FF',
        msg.dpr ?? 1,
      )
        .then((croppedDataUrl) => sendResponse({ croppedDataUrl }))
        .catch((err) => {
          console.error('[Nitpick Offscreen] Crop failed:', err);
          sendResponse({ croppedDataUrl: '' });
        });
      return true; // async response
    }

    return undefined;
  },
);

async function cropScreenshot(
  viewportDataUrl: string,
  cropRect: { x: number; y: number; width: number; height: number },
  highlightRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null,
  highlightColor: string,
  dpr: number,
): Promise<string> {
  // Load the viewport image
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = viewportDataUrl;
  });

  // captureVisibleTab returns at device pixel ratio resolution.
  // Multiply CSS-pixel crop coordinates by DPR to get physical pixels.
  const sx = cropRect.x * dpr;
  const sy = cropRect.y * dpr;
  const sw = cropRect.width * dpr;
  const sh = cropRect.height * dpr;

  // Create canvas at crop dimensions (physical pixels)
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;

  // Draw cropped region from the viewport image
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  // Draw selection highlight overlay (blue dashed border) if provided
  if (highlightRect) {
    const hx = (highlightRect.left - cropRect.x) * dpr;
    const hy = (highlightRect.top - cropRect.y) * dpr;
    const hw = highlightRect.width * dpr;
    const hh = highlightRect.height * dpr;

    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = 2 * dpr;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.strokeRect(hx, hy, hw, hh);
  }

  return canvas.toDataURL('image/png');
}
