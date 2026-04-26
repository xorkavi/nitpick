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

export async function searchParts(
  config: DevRevConfig,
  query: string,
  limit: number = 20,
): Promise<DevRevPart[]> {
  const response = await devrevFetch<{
    results: Array<{
      type: string;
      part?: DevRevPart & { type?: string };
    }>;
  }>(config, '/internal/search.typeahead', {
    body: {
      query,
      fields: ['name'],
      namespaces: ['enhancement', 'feature', 'capability', 'product'],
      limit,
    },
  });

  return response.results
    .filter(r => r.part)
    .map(r => ({
      id: r.part!.id,
      display_id: r.part!.display_id,
      name: r.part!.name,
      description: r.part!.description,
      owned_by: r.part!.owned_by,
      part_type: r.part!.type,
    }));
}

// ---------------------------------------------------------------------------
// Live user search (via typeahead)
// ---------------------------------------------------------------------------

export async function searchUsers(
  config: DevRevConfig,
  query: string,
  limit: number = 20,
): Promise<DevRevUser[]> {
  const response = await devrevFetch<{
    results: Array<{
      type: string;
      user?: DevRevUser & { type?: string };
    }>;
  }>(config, '/internal/search.typeahead', {
    body: {
      query,
      fields: ['full_name', 'display_name', 'email'],
      namespaces: ['dev_user'],
      limit,
    },
  });

  return response.results
    .filter(r => r.user)
    .map(r => ({
      id: r.user!.id,
      display_id: r.user!.display_id,
      display_name: r.user!.display_name,
      email: r.user!.email,
      full_name: r.user!.full_name,
      thumbnail: r.user!.thumbnail,
    }));
}

// ---------------------------------------------------------------------------
// Tags search (POST /tags.list)
// ---------------------------------------------------------------------------

export async function searchTags(
  query: string,
  limit: number = 20,
): Promise<import('../shared/types').DevRevTag[]> {
  const config = await getDevRevConfig();
  const body: Record<string, unknown> = { limit };
  if (query) body.name = [query];

  const response = await devrevFetch<{
    tags: Array<{
      id: string;
      name: string;
      description?: string;
      allowed_values?: string[];
      style_new?: { color?: string };
    }>;
  }>(config, '/tags.list', { body });

  return response.tags.map(t => ({
    id: t.id,
    name: t.name,
    color: t.style_new?.color,
    description: t.description,
    allowed_values: t.allowed_values,
  }));
}

// ---------------------------------------------------------------------------
// Self (GET)
// ---------------------------------------------------------------------------

async function fetchSelf(config: DevRevConfig): Promise<DevRevUser> {
  const response = await devrevFetch<{
    dev_user: DevRevUser;
  }>(config, '/internal/dev-users.self', { method: 'GET' });

  return response.dev_user;
}

async function fetchOrgName(config: DevRevConfig): Promise<string | null> {
  try {
    const response = await devrevFetch<{
      dev_org: { display_name?: string };
    }>(config, '/dev-orgs.get', { method: 'GET' });
    return response.dev_org?.display_name ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Module-level cache (self + tag only)
// ---------------------------------------------------------------------------

let selfCache: DevRevUser | null = null;
let nitpickedTagId: string | null = null;
let orgNameCache: string | null = null;

// ---------------------------------------------------------------------------
// Prefetch (self + org + tag — parts and users use live search)
// ---------------------------------------------------------------------------

export async function prefetchDevRevData(): Promise<{
  self: DevRevUser | null;
  orgName: string | null;
}> {
  const config = await getDevRevConfig();

  const [selfResult, tagResult, orgResult] = await Promise.allSettled([
    fetchSelf(config),
    findNitpickedTag(config),
    fetchOrgName(config),
  ]);

  if (selfResult.status === 'fulfilled') selfCache = selfResult.value;
  if (tagResult.status === 'fulfilled') nitpickedTagId = tagResult.value;
  if (orgResult.status === 'fulfilled') orgNameCache = orgResult.value;

  return { self: selfCache, orgName: orgNameCache };
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

// ---------------------------------------------------------------------------
// Cache getters
// ---------------------------------------------------------------------------

export function getCachedSelf(): DevRevUser | null {
  return selfCache;
}

export function getNitpickedTagId(): string | null {
  return nitpickedTagId;
}

export function clearCache(): void {
  selfCache = null;
  baseUrlCache = null;
  nitpickedTagId = null;
  thumbnailCache.clear();
}

// ---------------------------------------------------------------------------
// Authenticated thumbnail fetch (returns data URL)
// ---------------------------------------------------------------------------

const thumbnailCache = new Map<string, string>();

export async function fetchThumbnail(url: string): Promise<string | null> {
  if (!url) return null;
  if (thumbnailCache.has(url)) return thumbnailCache.get(url)!;

  try {
    const config = await getDevRevConfig();
    const response = await fetch(url, {
      headers: { Authorization: config.pat },
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        thumbnailCache.set(url, dataUrl);
        resolve(dataUrl);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
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
  }>(config, '/internal/artifacts.prepare', {
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

  const tags: Array<{ id: string }> = [];
  const nitpickedId = getNitpickedTagId();
  if (nitpickedId) tags.push({ id: nitpickedId });
  if (payload.tagIds) payload.tagIds.forEach(id => tags.push({ id }));
  if (tags.length > 0) body.tags = tags;

  const response = await devrevFetch<{
    work: { id: string; display_id: string };
  }>(config, '/works.create', { body });

  return {
    id: response.work.id,
    display_id: response.work.display_id,
  };
}
