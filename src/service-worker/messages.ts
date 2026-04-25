import type { Message } from '../shared/messages';
import { getSettings, saveSettings } from './storage';
import { captureScreenshots } from './capture';
import {
  storeScreenshots,
  storeBrowserMetadata,
  getScreenshots,
  clearScreenshots,
} from './screenshot-store';
import {
  prefetchDevRevData,
  getCachedParts,
  getCachedUsers,
  getCachedSelf,
  getDevRevConfig,
  uploadArtifact,
  createIssue,
} from './devrev-api';

export function setupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (msg: Message, _sender, sendResponse): boolean | undefined => {
      switch (msg.action) {
        case 'PING':
          sendResponse({ pong: true });
          return;

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

        case 'CREATE_ISSUE': {
          (async () => {
            try {
              const config = await getDevRevConfig();
              const screenshots = getScreenshots();
              const artifactIds: string[] = [];

              // Upload screenshots as artifacts (D-11)
              if (screenshots.viewport) {
                const viewportId = await uploadArtifact(
                  config,
                  screenshots.viewport,
                  'viewport-screenshot.png',
                );
                artifactIds.push(viewportId);
              }
              if (screenshots.cropped) {
                const croppedId = await uploadArtifact(
                  config,
                  screenshots.cropped,
                  'detail-screenshot.png',
                );
                artifactIds.push(croppedId);
              }

              // Create the issue with artifact IDs attached
              const issueData = {
                ...msg.issueData,
                artifactIds,
              };
              const result = await createIssue(config, issueData);

              // Build web URL for the issue
              // Replace api. with app. in the base URL for the web link
              const webUrl = `${config.baseUrl.replace('://api.', '://app.').replace('://api.dev.', '://app.dev.')}/issues/${result.display_id}`;

              // Clear screenshots after successful submission
              clearScreenshots();

              sendResponse({
                action: 'ISSUE_CREATED',
                issueId: result.id,
                displayId: result.display_id,
                webUrl,
              });
            } catch (err) {
              console.error('[Nitpick] Issue creation failed:', err);
              sendResponse({
                action: 'ISSUE_ERROR',
                message:
                  err instanceof Error ? err.message : 'Issue creation failed',
              });
            }
          })();
          return true; // async
        }

        default:
          return undefined;
      }
    },
  );
}
