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
