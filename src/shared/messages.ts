import type {
  ElementMetadata,
  AreaMetadata,
  NitpickSettings,
  BrowserMetadata,
  DevRevPart,
  DevRevUser,
  CreateIssuePayload,
} from './types';

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
  | { action: 'ERROR'; source: string; message: string }
  // Phase 2: Screenshot capture
  | {
      action: 'CAPTURE_SCREENSHOTS';
      boundingRect: { x: number; y: number; width: number; height: number };
      highlightRect?: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
      dpr: number;
      browserMetadata: BrowserMetadata;
    }
  | { action: 'SCREENSHOTS_READY'; hasScreenshots: boolean }
  // Phase 3: Screenshot relay to content script
  | { action: 'RELAY_CROPPED_SCREENSHOT'; croppedScreenshotUrl: string }
  // Phase 2: DevRev data prefetch
  | { action: 'PREFETCH_DEVREV_DATA' }
  | { action: 'DEVREV_DATA_READY'; self: DevRevUser }
  // Phase 2: Live parts search
  | { action: 'SEARCH_PARTS'; query: string; limit?: number }
  | { action: 'SEARCH_PARTS_RESULT'; parts: DevRevPart[] }
  // Phase 2: Live users search
  | { action: 'SEARCH_USERS'; query: string; limit?: number }
  | { action: 'SEARCH_USERS_RESULT'; users: DevRevUser[] }
  // Phase 2: Issue creation
  | { action: 'CREATE_ISSUE'; issueData: CreateIssuePayload }
  | {
      action: 'ISSUE_CREATED';
      issueId: string;
      displayId: string;
      webUrl: string;
    }
  | { action: 'ISSUE_ERROR'; message: string }
  // Overlay visibility control (for screenshot capture)
  | { action: 'HIDE_OVERLAY' }
  | { action: 'SHOW_OVERLAY' };

// Phase 2: Port-based AI streaming messages (not in Message union)
export type AIPortMessage =
  | {
      action: 'AI_ANALYZE';
      comment: string;
      metadata: ElementMetadata | AreaMetadata;
      browserMetadata: BrowserMetadata;
    }
  | { action: 'AI_CHUNK'; delta: string; snapshot: string }
  | {
      action: 'AI_DONE';
      title: string;
      description: string;
      suggestedPart?: string;
      suggestedOwner?: string;
    }
  | { action: 'AI_ERROR'; message: string };

export async function sendMessage(msg: Message): Promise<unknown> {
  return chrome.runtime.sendMessage(msg);
}

export async function sendTabMessage(
  tabId: number,
  msg: Message,
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, msg);
}
