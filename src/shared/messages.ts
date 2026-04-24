import type { ElementMetadata, AreaMetadata, NitpickSettings } from './types';

export type Message =
  | { action: 'PING' }
  | { action: 'PONG' }
  | { action: 'TOGGLE_COMMENT_MODE' }
  | { action: 'COMMENT_MODE_ACTIVATED'; tabId: number }
  | { action: 'COMMENT_MODE_DEACTIVATED'; tabId: number }
  | { action: 'ELEMENT_SELECTED'; data: ElementMetadata }
  | { action: 'AREA_SELECTED'; data: AreaMetadata }
  | { action: 'GET_SETTINGS' }
  | { action: 'SETTINGS_RESULT'; settings: NitpickSettings }
  | { action: 'SAVE_SETTINGS'; settings: Partial<NitpickSettings> }
  | { action: 'SETTINGS_SAVED' }
  | { action: 'ERROR'; source: string; message: string };

export async function sendMessage(msg: Message): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

export async function sendTabMessage(
  tabId: number,
  msg: Message,
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, msg);
}
