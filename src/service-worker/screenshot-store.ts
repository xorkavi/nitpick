/**
 * Screenshot store backed by IndexedDB.
 *
 * Service workers in MV3 can be suspended at any time. In-memory variables
 * are lost on suspension. IndexedDB persists across restarts, so screenshots
 * survive Chrome's aggressive service worker lifecycle.
 *
 * Falls back to in-memory storage if IndexedDB is unavailable.
 */

import type { BrowserMetadata } from '../shared/types';

const DB_NAME = 'nitpick-screenshots';
const STORE_NAME = 'data';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // IndexedDB unavailable — silent fail, in-memory fallback still works
  }
}

async function dbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => { db.close(); resolve((req.result as T) ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
}

async function dbClear(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // Silent fail
  }
}

// In-memory cache for fast access (avoids async reads in hot paths)
let viewportScreenshot: string | null = null;
let croppedScreenshot: string | null = null;
let browserMeta: BrowserMetadata | null = null;

export async function storeScreenshots(viewport: string, cropped: string): Promise<void> {
  viewportScreenshot = viewport;
  croppedScreenshot = cropped;
  await Promise.all([
    dbPut('viewport', viewport),
    dbPut('cropped', cropped),
  ]);
}

export async function storeBrowserMetadata(metadata: BrowserMetadata): Promise<void> {
  browserMeta = metadata;
  await dbPut('browserMeta', metadata);
}

export function getScreenshots(): {
  viewport: string | null;
  cropped: string | null;
} {
  return { viewport: viewportScreenshot, cropped: croppedScreenshot };
}

export function getBrowserMetadata(): BrowserMetadata | null {
  return browserMeta;
}

export async function clearScreenshots(): Promise<void> {
  viewportScreenshot = null;
  croppedScreenshot = null;
  browserMeta = null;
  await dbClear();
}

export async function restoreFromDB(): Promise<void> {
  viewportScreenshot = await dbGet<string>('viewport');
  croppedScreenshot = await dbGet<string>('cropped');
  browserMeta = await dbGet<BrowserMetadata>('browserMeta');
}
