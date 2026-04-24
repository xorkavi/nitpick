import type { NitpickMode } from '../shared/types';

const SESSION_KEYS = {
  mode: 'nitpick_mode',
  activeTabId: 'nitpick_active_tab',
} as const;

export async function getMode(): Promise<NitpickMode> {
  const result = await chrome.storage.session.get(SESSION_KEYS.mode);
  return (result[SESSION_KEYS.mode] as NitpickMode) || 'idle';
}

export async function setMode(mode: NitpickMode): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEYS.mode]: mode });
}

export async function getActiveTabId(): Promise<number | null> {
  const result = await chrome.storage.session.get(SESSION_KEYS.activeTabId);
  return (result[SESSION_KEYS.activeTabId] as number | undefined) ?? null;
}

export async function setActiveTabId(tabId: number | null): Promise<void> {
  if (tabId === null) {
    await chrome.storage.session.remove(SESSION_KEYS.activeTabId);
  } else {
    await chrome.storage.session.set({ [SESSION_KEYS.activeTabId]: tabId });
  }
}
