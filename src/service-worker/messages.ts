import type { Message } from '../shared/messages';
import { getSettings, saveSettings } from './storage';

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

        default:
          return undefined;
      }
    },
  );
}
