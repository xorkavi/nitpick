/**
 * DevRev REST API client.
 *
 * Provides typed wrappers for all DevRev endpoints Nitpick needs:
 * - parts.list (POST, paginated)
 * - dev-users.list (POST, paginated)
 * - dev-users.self (GET)
 * - artifacts.prepare + multipart upload
 * - works.create
 *
 * Includes:
 * - Base URL auto-resolution (prod vs dev environment)
 * - Module-level cache for prefetched parts, users, and self
 * - Data URL to Blob conversion for artifact upload
 */

import type { DevRevPart, DevRevUser, CreateIssuePayload } from '../shared/types';
import { DEVREV_API_BASE, DEVREV_DEV_API_BASE } from '../shared/constants';
import { getSettings } from './storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DevRevConfig {
  pat: string;
  baseUrl: string;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class DevRevError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'DevRevError';
  }
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

async function devrevFetch<T>(
  config: DevRevConfig,
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const url = `${config.baseUrl}${endpoint}`;
  const method = options.method ?? (options.body ? 'POST' : 'GET');

  const headers: Record<string, string> = {
    Authorization: config.pat,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    })) as { message?: string; type?: string; field_name?: string };
    const detail = error.field_name ? ` (${error.type}: ${error.field_name})` : '';
    throw new DevRevError(
      response.status,
      `${error.message ?? 'API request failed'}${detail}`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Base URL resolution (prod vs dev)
// ---------------------------------------------------------------------------

let baseUrlCache: string | null = null;

async function resolveBaseUrl(pat: string): Promise<string> {
  if (baseUrlCache) return baseUrlCache;

  // Try prod first
  try {
    const res = await fetch(`${DEVREV_API_BASE}/dev-users.self`, {
      method: 'GET',
      headers: {
        Authorization: pat,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      baseUrlCache = DEVREV_API_BASE;
      return baseUrlCache;
    }
  } catch {
    // prod unreachable, try dev
  }

  // Try dev
  try {
    const res = await fetch(`${DEVREV_DEV_API_BASE}/dev-users.self`, {
      method: 'GET',
      headers: {
        Authorization: pat,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      baseUrlCache = DEVREV_DEV_API_BASE;
      return baseUrlCache;
    }
  } catch {
    // dev also unreachable
  }

  // Default to prod if both fail -- will error on actual API call
  baseUrlCache = DEVREV_API_BASE;
  return baseUrlCache;
}

// ---------------------------------------------------------------------------
// Config helper
// ---------------------------------------------------------------------------

export async function getDevRevConfig(): Promise<DevRevConfig> {
  const settings = await getSettings();
  if (!settings.pat) {
    throw new DevRevError(0, 'DevRev PAT not configured');
  }
  const baseUrl = await resolveBaseUrl(settings.pat);
  return { pat: settings.pat, baseUrl };
}

// ---------------------------------------------------------------------------
// Parts list (POST, cursor-paginated)
// ---------------------------------------------------------------------------

async function fetchAllParts(config: DevRevConfig): Promise<DevRevPart[]> {
  const parts: DevRevPart[] = [];
  let cursor: string | undefined;

  do {
    const body: { limit: number; cursor?: string } = { limit: 50 };
    if (cursor) body.cursor = cursor;

    const response = await devrevFetch<{
      parts: DevRevPart[];
      next_cursor?: string;
    }>(config, '/parts.list', { body, method: 'POST' });

    parts.push(...response.parts);
    cursor = response.next_cursor;
  } while (cursor);

  return parts;
}

// ---------------------------------------------------------------------------
// Users list (POST, cursor-paginated)
// ---------------------------------------------------------------------------

async function fetchAllUsers(config: DevRevConfig): Promise<DevRevUser[]> {
  const users: DevRevUser[] = [];
  let cursor: string | undefined;

  do {
    const body: { limit: number; cursor?: string } = { limit: 50 };
    if (cursor) body.cursor = cursor;

    const response = await devrevFetch<{
      dev_users: DevRevUser[];
      next_cursor?: string;
    }>(config, '/dev-users.list', { body, method: 'POST' });

    users.push(...response.dev_users);
    cursor = response.next_cursor;
  } while (cursor);

  return users;
}

// ---------------------------------------------------------------------------
// Self (GET)
// ---------------------------------------------------------------------------

async function fetchSelf(config: DevRevConfig): Promise<DevRevUser> {
  const response = await devrevFetch<{
    dev_user: DevRevUser;
  }>(config, '/dev-users.self', { method: 'GET' });

  return response.dev_user;
}

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

let partsCache: DevRevPart[] | null = null;
let usersCache: DevRevUser[] | null = null;
let selfCache: DevRevUser | null = null;
let nitpickedTagId: string | null = null;

// ---------------------------------------------------------------------------
// Prefetch
// ---------------------------------------------------------------------------

export async function prefetchDevRevData(): Promise<{
  parts: DevRevPart[];
  users: DevRevUser[];
  self: DevRevUser | null;
}> {
  const config = await getDevRevConfig();

  const [partsResult, usersResult, selfResult, tagResult] = await Promise.allSettled([
    fetchAllParts(config),
    fetchAllUsers(config),
    fetchSelf(config),
    findNitpickedTag(config),
  ]);

  if (partsResult.status === 'fulfilled') partsCache = partsResult.value;
  if (usersResult.status === 'fulfilled') usersCache = usersResult.value;
  if (selfResult.status === 'fulfilled') selfCache = selfResult.value;
  if (tagResult.status === 'fulfilled') nitpickedTagId = tagResult.value;

  if (usersCache) {
    await resolveProfilePictures(config, usersCache).catch(() => {});
  }
  if (selfCache?.display_picture?.id) {
    await resolveProfilePictures(config, [selfCache]).catch(() => {});
  }

  return {
    parts: partsCache ?? [],
    users: usersCache ?? [],
    self: selfCache,
  };
}

async function findNitpickedTag(config: DevRevConfig): Promise<string | null> {
  try {
    const result = await devrevFetch<{
      tags: Array<{ id: string; name: string }>;
    }>(config, '/tags.list', { body: { name: ['nitpicked'] } });
    const tagId = result.tags?.[0]?.id ?? null;
    if (tagId) {
      console.log('[Nitpick] Found nitpicked tag:', tagId);
    } else {
      console.warn('[Nitpick] nitpicked tag not found in org');
    }
    return tagId;
  } catch (err) {
    console.warn('[Nitpick] Tag lookup failed:', err);
    return null;
  }
}

async function resolveProfilePictures(config: DevRevConfig, users: DevRevUser[]): Promise<void> {
  const withPics = users.filter(u => u.display_picture?.id);
  const batch = withPics.slice(0, 20);
  await Promise.allSettled(batch.map(async (user) => {
    try {
      const result = await devrevFetch<{ url: string }>(
        config, '/artifacts.locate', { body: { id: user.display_picture!.id } },
      );
      (user as DevRevUser & { profile_picture_url?: string }).profile_picture_url = result.url;
    } catch { /* skip */ }
  }));
}

// ---------------------------------------------------------------------------
// Cache getters
// ---------------------------------------------------------------------------

export function getCachedParts(): DevRevPart[] {
  return partsCache ?? [];
}

export function getCachedUsers(): DevRevUser[] {
  return usersCache ?? [];
}

export function getCachedSelf(): DevRevUser | null {
  return selfCache;
}

export function getNitpickedTagId(): string | null {
  return nitpickedTagId;
}

export function clearCache(): void {
  partsCache = null;
  usersCache = null;
  selfCache = null;
  baseUrlCache = null;
  nitpickedTagId = null;
}

// ---------------------------------------------------------------------------
// Data URL to Blob conversion
// ---------------------------------------------------------------------------

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// ---------------------------------------------------------------------------
// Artifact upload (prepare + multipart POST)
// ---------------------------------------------------------------------------

export interface UploadedArtifact {
  id: string;
  accessKey: string;
  fileName: string;
}

export async function uploadArtifact(
  config: DevRevConfig,
  dataUrl: string,
  fileName: string,
): Promise<UploadedArtifact> {
  const prepared = await devrevFetch<{
    id: string;
    url: string;
    form_data: Array<{ key: string; value: string }>;
    access_key: string;
  }>(config, '/artifacts.prepare', {
    body: { file_name: fileName, file_type: 'default' },
  });

  const blob = dataUrlToBlob(dataUrl);

  const formData = new FormData();
  for (const { key, value } of prepared.form_data) {
    formData.append(key, value);
  }
  formData.append('file', blob, fileName);

  const uploadResponse = await fetch(prepared.url, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new DevRevError(uploadResponse.status, 'Artifact upload failed');
  }

  return {
    id: prepared.id,
    accessKey: prepared.access_key,
    fileName,
  };
}

// ---------------------------------------------------------------------------
// Issue creation (works.create)
// ---------------------------------------------------------------------------

export async function createIssue(
  config: DevRevConfig,
  payload: CreateIssuePayload,
): Promise<{ id: string; display_id: string }> {
  const body: Record<string, unknown> = {
    type: 'issue',
    title: payload.title,
    body: payload.description,
    priority: payload.priority,
  };

  if (payload.partId) body.applies_to_part = payload.partId;
  if (payload.ownerId) body.owned_by = [payload.ownerId];
  if (payload.reportedById) body.reported_by = [payload.reportedById];
  if (payload.artifactIds?.length) body.artifacts = payload.artifactIds;

  const tagId = getNitpickedTagId();
  if (tagId) body.tags = [{ id: tagId }];

  const response = await devrevFetch<{
    work: { id: string; display_id: string };
  }>(config, '/works.create', { body });

  return {
    id: response.work.id,
    display_id: response.work.display_id,
  };
}
