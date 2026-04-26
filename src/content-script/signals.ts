import { signal, computed } from '@preact/signals';
import type { DevRevPart, DevRevUser, DevRevTag, ElementMetadata, AreaMetadata } from '../shared/types';

// Comment mode active state
export const isActive = signal<boolean>(false);

// Currently hovered element (null when no hover)
export const hoveredElement = signal<Element | null>(null);

// Currently selected element (persists after click until deselected)
export const selectedElement = signal<Element | null>(null);

// Mouse position for comment cursor (viewport coordinates)
export const mousePosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });

// Hovered element bounding rect (updated on hover)
export const hoveredRect = signal<DOMRect | null>(null);

// Selected element bounding rect (updated on click)
export const selectedRect = signal<DOMRect | null>(null);

// Computed: whether we have an active selection
export const hasSelection = computed(() => selectedElement.value !== null);

// Area drag state
export const isDragging = signal<boolean>(false);
export const dragStart = signal<{ x: number; y: number } | null>(null);
export const dragEnd = signal<{ x: number; y: number } | null>(null);
export const dragRect = computed(() => {
  const start = dragStart.value;
  const end = dragEnd.value;
  if (!start || !end) return null;
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
});

// Area selection result (set after drag completes)
export const areaSelection = signal<{
  left: number;
  top: number;
  width: number;
  height: number;
} | null>(null);

// Comment bubble / issue card state
export const showCommentBubble = signal<boolean>(false);
export const commentText = signal<string>('');
export const showIssueCard = signal<boolean>(false);
export const issueFormData = signal<{
  title: string;
  description: string;
  part: string;       // display label
  partId: string;     // DevRev ID
  owner: string;      // display label
  ownerId: string;    // DevRev ID
  priority: string;   // display label
  priorityId: string; // 'p0' | 'p1' | 'p2' | 'p3'
}>({
  title: '', description: '',
  part: '', partId: '',
  owner: '', ownerId: '',
  priority: 'P2', priorityId: 'p2',
});
export const issueCardLoading = signal<boolean>(false);
export const popoverShaking = signal<boolean>(false);

export const popoverAnchorPoint = signal<{ x: number; y: number } | null>(null);

// Phase 2: Last selected metadata for AI retry
export const lastSelectedMetadata = signal<ElementMetadata | AreaMetadata | null>(null);

// Phase 2: AI-suggested Part/Owner IDs
export const aiSuggestedPart = signal<string | undefined>(undefined);
export const aiSuggestedOwner = signal<string | undefined>(undefined);

// Phase 2: Screenshot state
export const screenshotsReady = signal<boolean>(false);

// Phase 3: Screenshot data URLs for thumbnail display
export const croppedScreenshotUrl = signal<string | null>(null);
export const viewportScreenshotUrl = signal<string | null>(null);

// Phase 2: AI streaming state
export const aiStreamingDone = signal<boolean>(false);
export const issueError = signal<string | null>(null);

// Phase 2: DevRev cached data (self only — parts and users use live search)
export const devrevSelf = signal<DevRevUser | null>(null);
export const devrevDataLoaded = signal<boolean>(false);

// Phase 2: Live parts search
export const partSearchResults = signal<DevRevPart[]>([]);
export const partSearchLoading = signal<boolean>(false);

// Phase 2: Live users search
export const userSearchResults = signal<DevRevUser[]>([]);
export const userSearchLoading = signal<boolean>(false);

// Phase 3: Tags search and selection
export const tagSearchResults = signal<DevRevTag[]>([]);
export const tagSearchLoading = signal<boolean>(false);
export const selectedTags = signal<DevRevTag[]>([]);

// Phase 2: Issue creation state
export const isCreatingIssue = signal<boolean>(false);
export const createdIssueUrl = signal<string | null>(null);
export const createdIssueDisplayId = signal<string | null>(null);
export const showSuccessToast = signal<boolean>(false);
