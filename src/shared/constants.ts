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
