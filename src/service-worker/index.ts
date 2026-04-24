import { hasCredentials } from './storage';
import { getMode, setMode, getActiveTabId, setActiveTabId } from './state';
import { setupMessageHandler } from './messages';
import { clearScreenshots } from './screenshot-store';

const POPUP_PATH = 'src/popup/index.html';

async function updatePopupMode(): Promise<void> {
  const hasCreds = await hasCredentials();
  if (hasCreds) {
    await chrome.action.setPopup({ popup: '' });
  } else {
    await chrome.action.setPopup({ popup: POPUP_PATH });
  }
}

async function toggleCommentMode(tabId: number): Promise<void> {
  const mode = await getMode();
  const activeTab = await getActiveTabId();

  if (mode === 'inspecting' && activeTab === tabId) {
    await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_COMMENT_MODE' });
    await setMode('idle');
    await setActiveTabId(null);
    clearScreenshots();
    chrome.alarms.clear('keepalive');
  } else {
    await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_COMMENT_MODE' });
    await setMode('inspecting');
    await setActiveTabId(tabId);
    chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
  }
}

// --- Event Listeners ---

chrome.runtime.onInstalled.addListener(async () => {
  await updatePopupMode();
});

// Re-check popup mode on service worker startup
updatePopupMode();

// Toggle comment mode when icon clicked (only fires when popup is '')
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await toggleCommentMode(tab.id);
});

// Watch for credential changes to toggle popup mode
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    const relevantKeys = ['nitpick_pat', 'nitpick_openai_key'];
    const hasRelevantChange = relevantKeys.some((key) => key in changes);
    if (hasRelevantChange) {
      updatePopupMode();
    }
  }
});

// Keepalive alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    // No-op -- firing the alarm wakes the service worker
  }
});

// Initialize message handler
setupMessageHandler();
