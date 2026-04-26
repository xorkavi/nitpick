import { hasCredentials } from './storage';
import { getMode, setMode, getActiveTabId, setActiveTabId } from './state';
import { setupMessageHandler } from './messages';
import { clearScreenshots, getBrowserMetadata } from './screenshot-store';
import { prefetchDevRevData, clearCache } from './devrev-api';
import { streamAnalysis } from './ai-analysis';

const POPUP_PATH = 'src/popup/index.html';

async function updatePopupMode(): Promise<void> {
  const hasCreds = await hasCredentials();
  if (hasCreds) {
    await chrome.action.setPopup({ popup: '' });
  } else {
    await chrome.action.setPopup({ popup: POPUP_PATH });
  }
}

export async function toggleCommentMode(tabId: number): Promise<void> {
  const mode = await getMode();
  const activeTab = await getActiveTabId();

  if (mode === 'inspecting' && activeTab === tabId) {
    await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_COMMENT_MODE' });
    await setMode('idle');
    await setActiveTabId(null);
    clearScreenshots();
    clearCache();
    chrome.alarms.clear('keepalive');
  } else {
    await chrome.tabs.sendMessage(tabId, { action: 'TOGGLE_COMMENT_MODE' });
    await setMode('inspecting');
    await setActiveTabId(tabId);
    chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });

    // D-14: Prefetch parts and users on comment mode activate
    prefetchDevRevData().catch((err) => {
      console.error('[Nitpick] DevRev prefetch failed:', err);
    });
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

// Port-based streaming for AI analysis (D-10: streaming via ports, not sendMessage)
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'ai-stream') {
    port.onMessage.addListener(async (msg: { action: string; comment: string; metadata: unknown; browserMetadata?: unknown }) => {
      if (msg.action === 'AI_ANALYZE') {
        const storedBrowserMeta = getBrowserMetadata();
        const browserMetadata = (msg.browserMetadata || storedBrowserMeta || {
          url: '',
          title: '',
          viewportWidth: 0,
          viewportHeight: 0,
          userAgent: '',
          devicePixelRatio: 1,
          platform: '',
        }) as import('../shared/types').BrowserMetadata;

        await streamAnalysis(
          port,
          msg.comment,
          msg.metadata as import('../shared/types').ElementMetadata | import('../shared/types').AreaMetadata,
          browserMetadata,
        );
      }
    });

    // Handle port disconnect gracefully (Research Pitfall 5)
    port.onDisconnect.addListener(() => {
      // Port closed -- stream will naturally stop
      // No cleanup needed; OpenAI stream will error on next write attempt
    });
  }
});
