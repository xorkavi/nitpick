export const STORAGE_KEYS = {
  pat: 'nitpick_pat',
  openaiKey: 'nitpick_openai_key',
  domains: 'nitpick_domains',
} as const;

export const DEFAULT_DOMAINS = ['app.devrev.ai', 'devrev.ai', 'app.dev.devrev-eng.ai'];

export const COLORS = {
  selectionBlue: '#0D99FF',
  selectionBlueLight: 'rgba(13, 153, 255, 0.08)',
  surfaceWhite: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  borderLight: '#E5E5E5',
  accentPurple: '#7C3AED',
  accentPurpleHover: '#6D28D9',
  iconDefault: '#999999',
  iconHover: '#333333',
  destructive: '#DC2626',
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
} as const;

// Phase 2: Priority options and API endpoints

import type { PriorityOption, PriorityLevel } from './types';

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { id: 'p0', label: 'P0 - Urgent' },
  { id: 'p1', label: 'P1 - High' },
  { id: 'p2', label: 'P2 - Medium' },
  { id: 'p3', label: 'P3 - Low' },
];

export const DEFAULT_PRIORITY: PriorityLevel = 'p2';

export const DEVREV_API_BASE = 'https://api.devrev.ai';
export const DEVREV_DEV_API_BASE = 'https://api.dev.devrev-eng.ai';
