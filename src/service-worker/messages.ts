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
  getCachedSelf,
  getDevRevConfig,
  uploadArtifact,
  createIssue,
  searchParts,
  searchUsers,
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

              // Proactively relay cropped screenshot to content script
              if (_sender.tab?.id && cropped) {
                chrome.tabs.sendMessage(_sender.tab.id, {
                  action: 'RELAY_CROPPED_SCREENSHOT',
                  croppedScreenshotUrl: cropped,
                }).catch((err) => {
                  console.error('[Nitpick] Failed to relay screenshot:', err);
                });
              }
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
            .then(({ self }) => {
              sendResponse({ action: 'DEVREV_DATA_READY', self });
            })
            .catch((err) => {
              console.error('[Nitpick] DevRev prefetch failed:', err);
              sendResponse({
                action: 'ERROR',
                source: 'devrev-prefetch',
                message: err instanceof Error ? err.message : 'Prefetch failed',
              });
            });
          return true;
        }

        case 'SEARCH_PARTS': {
          (async () => {
            try {
              const config = await getDevRevConfig();
              const parts = await searchParts(config, msg.query ?? '', msg.limit ?? 20);
              sendResponse({ action: 'SEARCH_PARTS_RESULT', parts });
            } catch (err) {
              console.error('[Nitpick] Parts search failed:', err);
              sendResponse({ action: 'SEARCH_PARTS_RESULT', parts: [] });
            }
          })();
          return true;
        }

        case 'SEARCH_USERS': {
          (async () => {
            try {
              const config = await getDevRevConfig();
              const users = await searchUsers(config, msg.query ?? '', msg.limit ?? 20);
              sendResponse({ action: 'SEARCH_USERS_RESULT', users });
            } catch (err) {
              console.error('[Nitpick] Users search failed:', err);
              sendResponse({ action: 'SEARCH_USERS_RESULT', users: [] });
            }
          })();
          return true;
        }

        case 'CREATE_ISSUE': {
          (async () => {
            try {
              const config = await getDevRevConfig();
              const screenshots = getScreenshots();
              const uploadedArtifacts: Array<{ id: string; accessKey: string; fileName: string }> = [];

              if (screenshots.viewport) {
                const artifact = await uploadArtifact(
                  config,
                  screenshots.viewport,
                  'viewport-screenshot.png',
                );
                uploadedArtifacts.push(artifact);
              }
              if (screenshots.cropped) {
                const artifact = await uploadArtifact(
                  config,
                  screenshots.cropped,
                  'detail-screenshot.png',
                );
                uploadedArtifacts.push(artifact);
              }

              // Build inline markdown images using permanent download URLs
              let description = msg.issueData.description || '';
              if (uploadedArtifacts.length > 0) {
                const imageMarkdown = uploadedArtifacts
                  .map(a => `![${a.fileName}](${config.baseUrl}/internal/artifacts.download?id=${encodeURIComponent(a.id)}&key=${encodeURIComponent(a.accessKey)})`)
                  .join('\n');
                description = `${imageMarkdown}\n\n${description}`;
              }

              const issueData = {
                ...msg.issueData,
                description,
              };
              const result = await createIssue(config, issueData);

              // Build web URL for the issue
              // Replace api. with app. in the base URL for the web link
              const appBase = config.baseUrl.replace('://api.', '://app.');
              const webUrl = `${appBase}/devrev/works/${result.display_id}`;

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
