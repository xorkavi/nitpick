import { signal, computed } from '@preact/signals';

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
  part: string;
  owner: string;
  priority: string;
}>({ title: '', description: '', part: '', owner: '', priority: '' });
export const issueCardLoading = signal<boolean>(false);
export const popoverShaking = signal<boolean>(false);
