import { hasCredentials } from './storage';
import { getMode, setMode, getActiveTabId, setActiveTabId } from './state';
import { setupMessageHandler } from './messages';

// Popup path -- CRXJS resolves this at build time
const POPUP_PATH = 'src/popup/index.html';

// Set popup mode based on credential state
async function updatePopupMode(): Promise<void> {
  const hasCreds = await hasCredentials();
  if (hasCreds) {
    // No popup -- onClicked fires for comment mode toggle
    await chrome.action.setPopup({ popup: '' });
  } else {
    // Show popup for setup
    await chrome.action.setPopup({ popup: POPUP_PATH });
  }
}

// Inject content script if not already present
async function injectContentScript(tabId: number): Promise<void> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' });
    if (response && (response as { pong?: boolean }).pong) return;
  } catch {
    // Not injected yet -- expected error
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['src/content-script/index.ts'],
  });
}

// Toggle comment mode for a tab
async function toggleCommentMode(tabId: number): Promise<void> {
  const mode = await getMode();
  const activeTab = await getActiveTabId();

  if (mode === 'inspecting' && activeTab === tabId) {
    // Deactivate
    await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_COMMENT_MODE' });
    await setMode('idle');
    await setActiveTabId(null);
    chrome.alarms.clear('keepalive');
  } else {
    // Activate
    await injectContentScript(tabId);
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
