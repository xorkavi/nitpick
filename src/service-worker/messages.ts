import type { Message } from '../shared/messages';
import { getSettings, saveSettings } from './storage';
import { captureScreenshots } from './capture';
import {
  storeScreenshots,
  storeBrowserMetadata,
} from './screenshot-store';
import {
  prefetchDevRevData,
  getCachedParts,
  getCachedUsers,
  getCachedSelf,
} from './devrev-api';

export function setupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (msg: Message, _sender, sendResponse): boolean | undefined => {
      switch (msg.action) {
        case 'GET_SETTINGS':
          getSettings().then((settings) => {
            sendResponse({ action: 'SETTINGS_RESULT', settings });
          });
          return true; // async response

        case 'SAVE_SETTINGS':
          saveSettings(msg.settings).then(() => {
            sendResponse({ action: 'SETTINGS_SAVED' });
          });
          return true; // async response

        case 'CAPTURE_SCREENSHOTS': {
          const { boundingRect, highlightRect, dpr, browserMetadata } = msg;
          captureScreenshots(
            _sender.tab!.id!,
            boundingRect,
            highlightRect,
            dpr,
          )
            .then(({ viewport, cropped }) => {
              storeScreenshots(viewport, cropped);
              storeBrowserMetadata(browserMetadata);
              sendResponse({
                action: 'SCREENSHOTS_READY',
                hasScreenshots: true,
              });
            })
            .catch((err) => {
              console.error('[Nitpick] Screenshot capture failed:', err);
              sendResponse({
                action: 'SCREENSHOTS_READY',
                hasScreenshots: false,
              });
            });
          return true; // async response
        }

        case 'PREFETCH_DEVREV_DATA': {
          prefetchDevRevData()
            .then(({ parts, users, self }) => {
              sendResponse({
                action: 'DEVREV_DATA_READY',
                parts,
                users,
                self,
              });
            })
            .catch((err) => {
              console.error('[Nitpick] DevRev prefetch failed:', err);
              sendResponse({
                action: 'ERROR',
                source: 'devrev-prefetch',
                message:
                  err instanceof Error ? err.message : 'Prefetch failed',
              });
            });
          return true; // async response
        }

        case 'GET_DEVREV_CACHE': {
          sendResponse({
            action: 'DEVREV_CACHE_RESULT',
            parts: getCachedParts(),
            users: getCachedUsers(),
            self: getCachedSelf(),
          });
          return true;
        }

        default:
          return undefined;
      }
    },
  );
}
