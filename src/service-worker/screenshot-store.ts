/**
 * In-memory screenshot store.
 *
 * Holds viewport and cropped PNG data URLs in service worker memory until
 * issue submission. Per D-04, screenshots are stored in memory (not
 * chrome.storage) to avoid quota limits -- PNG data URLs can be 2-10MB.
 *
 * If the service worker restarts, screenshots are lost. This is acceptable
 * because the user hasn't submitted the issue yet and can re-select.
 */

import type { BrowserMetadata } from '../shared/types';

let viewportScreenshot: string | null = null;
let croppedScreenshot: string | null = null;
let browserMeta: BrowserMetadata | null = null;

export function storeScreenshots(viewport: string, cropped: string): void {
  viewportScreenshot = viewport;
  croppedScreenshot = cropped;
}

export function storeBrowserMetadata(metadata: BrowserMetadata): void {
  browserMeta = metadata;
}

export function getScreenshots(): {
  viewport: string | null;
  cropped: string | null;
} {
  return { viewport: viewportScreenshot, cropped: croppedScreenshot };
}

export function getBrowserMetadata(): BrowserMetadata | null {
  return browserMeta;
}

export function clearScreenshots(): void {
  viewportScreenshot = null;
  croppedScreenshot = null;
  browserMeta = null;
}
