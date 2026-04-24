import { STORAGE_KEYS, DEFAULT_DOMAINS } from '../shared/constants';
import type { NitpickSettings } from '../shared/types';

export async function getSettings(): Promise<NitpickSettings> {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.pat,
    STORAGE_KEYS.openaiKey,
    STORAGE_KEYS.domains,
  ]);
  return {
    pat: (result[STORAGE_KEYS.pat] as string) || '',
    openaiKey: (result[STORAGE_KEYS.openaiKey] as string) || '',
    domains: (result[STORAGE_KEYS.domains] as string[]) || DEFAULT_DOMAINS,
  };
}

export async function saveSettings(
  settings: Partial<NitpickSettings>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (settings.pat !== undefined) updates[STORAGE_KEYS.pat] = settings.pat;
  if (settings.openaiKey !== undefined)
    updates[STORAGE_KEYS.openaiKey] = settings.openaiKey;
  if (settings.domains !== undefined)
    updates[STORAGE_KEYS.domains] = settings.domains;
  await chrome.storage.local.set(updates);
}

export async function hasCredentials(): Promise<boolean> {
  const { pat, openaiKey } = await getSettings();
  return Boolean(pat && openaiKey);
}
